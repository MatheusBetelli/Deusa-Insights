import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { AuditLoggerService } from "../common/audit-logger.service";
import { resolveEmailDelivery } from "../common/email-recipient";
import { escapeHtml } from "../common/html-safety";
import { CreateInvitationDto } from "./dto/create-invitation.dto";

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

type InvitationActor = { id: string; email?: string };
type InvitationInput = {
  userId?: string;
  name?: string;
  email?: string;
  role?: UserRole;
};
type InvitationAction = "USER_INVITATION_CREATED" | "USER_INVITATION_RESENT";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getInvitationTtlHours(): number {
  const configured = Number(process.env.INVITATION_TTL_HOURS ?? "48");
  return Number.isFinite(configured) && configured >= 1 && configured <= 168 ? configured : 48;
}

function removeTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

function getEmailProviderErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "O serviço de e-mail recusou a configuração. Verifique a chave e o remetente verificado.";
  }
  if (status === 422) {
    return "O remetente ou destinatário do convite é inválido. Verifique o e-mail configurado.";
  }
  if (status === 429) {
    return "O serviço de e-mail atingiu um limite temporário. Tente novamente mais tarde.";
  }
  return "Não foi possível enviar o convite por e-mail.";
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_PUBLIC_SELECT,
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });
  }

  async createInvitation(dto: CreateInvitationDto, actor: InvitationActor) {
    return this.issueInvitation(
      {
        name: dto.name.trim(),
        email: normalizeEmail(dto.email),
        role: dto.role,
      },
      actor,
      "USER_INVITATION_CREATED",
    );
  }

  async resendInvitation(userId: string, actor: InvitationActor) {
    return this.issueInvitation({ userId }, actor, "USER_INVITATION_RESENT");
  }

  private async issueInvitation(
    input: InvitationInput,
    actor: InvitationActor,
    action: InvitationAction,
  ) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInvitationToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + getInvitationTtlHours() * 60 * 60 * 1000);
    const unusablePasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const existing = input.userId
          ? await tx.user.findUnique({ where: { id: input.userId }, select: USER_PUBLIC_SELECT })
          : await tx.user.findUnique({
              where: { email: input.email },
              select: USER_PUBLIC_SELECT,
            });

        if (input.userId && !existing) {
          throw new NotFoundException("Usuário não encontrado.");
        }
        if (existing?.status === UserStatus.ACTIVE) {
          throw new BadRequestException("Este e-mail já possui uma conta ativa.");
        }
        if (existing?.status === UserStatus.BLOCKED) {
          throw new BadRequestException("Esta conta está bloqueada e não pode receber convite.");
        }

        const currentUser = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                ...(input.name ? { name: input.name } : {}),
                ...(input.email ? { email: input.email } : {}),
                ...(input.role ? { role: input.role } : {}),
                passwordHash: unusablePasswordHash,
                status: UserStatus.INVITED,
              },
              select: USER_PUBLIC_SELECT,
            })
          : await tx.user.create({
              data: {
                name: input.name as string,
                email: input.email as string,
                passwordHash: unusablePasswordHash,
                role: input.role as UserRole,
                status: UserStatus.INVITED,
              },
              select: USER_PUBLIC_SELECT,
            });

        await tx.userInvitation.updateMany({
          where: { userId: currentUser.id, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.userInvitation.create({
          data: {
            userId: currentUser.id,
            tokenHash,
            expiresAt,
            createdById: actor.id,
          },
        });

        return currentUser;
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        throw new BadRequestException("Não foi possível criar o convite para este e-mail.");
      }
      throw error;
    }

    const inviteLink = this.buildInvitationLink(token);
    let inviteSent: boolean;
    try {
      inviteSent = await this.sendInvitationEmail(user, inviteLink, expiresAt);
    } catch (error) {
      this.logger.error(
        `Falha no envio de convite (${action}) para usuário ${user.id}: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      );
      throw error;
    }

    this.auditLogger?.logEvent({
      action,
      outcome: "SUCCESS",
      userId: actor.id,
      userEmail: actor.email,
      details: `Convite emitido para usuário ${user.id}; expira em ${expiresAt.toISOString()}`,
    });

    const response = {
      ...user,
      inviteSent,
      expiresAt,
    };
    if ((process.env.NODE_ENV ?? "development").trim().toLowerCase() !== "production") {
      return { ...response, inviteLink };
    }
    return response;
  }

  private buildInvitationLink(token: string): string {
    const configuredUrl = removeTrailingSlashes(
      process.env.FRONTEND_URL?.trim() || "http://localhost:8080",
    );
    let frontendUrl: URL;
    try {
      frontendUrl = new URL(configuredUrl);
    } catch {
      throw new ServiceUnavailableException("FRONTEND_URL está inválida para o envio do convite.");
    }

    const isProduction =
      (process.env.NODE_ENV ?? "development").trim().toLowerCase() === "production";
    if (
      frontendUrl.username ||
      frontendUrl.password ||
      (isProduction && frontendUrl.protocol !== "https:")
    ) {
      throw new ServiceUnavailableException(
        "FRONTEND_URL deve ser uma origem HTTPS válida para o envio do convite.",
      );
    }

    return `${configuredUrl}/set-password?token=${encodeURIComponent(token)}`;
  }

  private async sendInvitationEmail(
    user: { name: string; email: string },
    inviteLink: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const isProduction =
      (process.env.NODE_ENV ?? "development").trim().toLowerCase() === "production";
    if (!apiKey) {
      if (isProduction) {
        throw new ServiceUnavailableException("Serviço de e-mail não configurado para convites.");
      }
      return false;
    }

    const safeInviteLink = escapeHtml(inviteLink);
    const safeUserName = escapeHtml(user.name);
    const safeTargetEmail = escapeHtml(user.email);
    const delivery = resolveEmailDelivery(user.email);
    const relayNotice = delivery.isRelay
      ? `<p style="color: #92400e; font-size: 13px; line-height: 1.5; background: #fffbeb; padding: 10px 12px; border-radius: 6px;">Este convite foi solicitado para <strong>${safeTargetEmail}</strong>. Encaminhe esta mensagem ao usuário correto.</p>`
      : "";

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "deusa-analytics-backend/1.0",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev",
          to: [delivery.recipientEmail],
          subject: delivery.isRelay
            ? `Convite de acesso para ${user.email} - Deusa Analytics`
            : "Convite de acesso - Deusa Analytics",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;">
              <h2 style="color: #1061AF; margin-top: 0;">Deusa Analytics</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Olá, <strong>${safeUserName}</strong>!</p>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Você recebeu um convite para acessar a plataforma. Defina sua própria senha pelo botão abaixo.</p>
              ${relayNotice}
              <div style="margin: 28px 0; text-align: center;">
                <a href="${safeInviteLink}" style="background: #1061AF; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Definir minha senha</a>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0;">Este convite expira em ${expiresAt.toISOString()}. Se você não esperava este e-mail, ignore-o.</p>
            </div>
          `,
        }),
      });
      if (!response.ok) {
        const providerRequestId = response.headers.get("x-resend-request-id");
        this.logger.error(
          `Resend recusou convite: HTTP ${response.status}${
            providerRequestId ? `, requestId ${providerRequestId}` : ""
          }`,
        );
        throw new ServiceUnavailableException(getEmailProviderErrorMessage(response.status));
      }
      return true;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Não foi possível enviar o convite por e-mail.", {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async deleteUser(id: string, currentUserId?: string) {
    if (currentUserId && id === currentUserId) {
      throw new BadRequestException("Você não pode excluir o seu próprio usuário logado.");
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id },
            select: { id: true, email: true, role: true },
          });
          if (!user) {
            throw new NotFoundException("Usuário não encontrado.");
          }
          const adminCount =
            user.role === UserRole.ADMIN
              ? await tx.user.count({ where: { role: UserRole.ADMIN } })
              : 2;
          if (user.role === UserRole.ADMIN && adminCount <= 1) {
            throw new BadRequestException(
              "O último administrador do sistema não pode ser removido.",
            );
          }

          const mapping = await tx.userMapping.findUnique({ where: { cuid: id } });
          const profile =
            mapping || !user.email
              ? null
              : await tx.profile.findUnique({
                  where: { email: user.email },
                  select: { id: true },
                });
          const profileId = mapping?.uuid ?? profile?.id;
          await tx.lead.updateMany({
            where: {
              OR: [
                { assignedToId_legacy: id },
                ...(profileId ? [{ assignedToId: profileId }] : []),
              ],
            },
            data: { assignedToId: null, assignedToId_legacy: null },
          });
          await tx.leadInteraction.updateMany({
            where: { userId_legacy: id },
            data: { userId_legacy: null },
          });
          if (mapping) {
            await tx.userMapping.delete({ where: { cuid: id } });
          }

          return tx.user.delete({
            where: { id },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2034") {
        throw new BadRequestException(
          "A lista de administradores foi alterada simultaneamente. Atualize a tela e tente novamente.",
        );
      }
      throw error;
    }
  }
}
