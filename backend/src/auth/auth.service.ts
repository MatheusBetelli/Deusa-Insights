import { BadRequestException, Injectable, Optional, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLoggerService } from "../common/audit-logger.service";
import { resolveEmailDelivery } from "../common/email-recipient";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SetPasswordDto } from "./dto/set-password.dto";
import { escapeHtml } from "../common/html-safety";

const DUMMY_PASSWORD_HASH = "$2b$12$LHnUBoIInYMJZXnrv95KwOp0eaXS0xp/NCr8/Tzrf5dNJKZlSPLHK";

type PasswordResetTokenPayload = {
  sub?: unknown;
  type?: unknown;
  ver?: unknown;
};

function removeTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || (user.status && user.status !== UserStatus.ACTIVE) || !passwordMatches) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      type: "access",
      ver: user.updatedAt.getTime(),
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException("Usuário não encontrado");
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException("A confirmação da nova senha não confere");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Usuário não encontrado");

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException("Senha atual inválida");

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updateResult = await this.prisma.user.updateMany({
      where: { id: userId, updatedAt: user.updatedAt },
      data: { passwordHash },
    });
    if (updateResult.count !== 1) {
      throw new BadRequestException(
        "A conta foi alterada durante a troca de senha. Tente novamente.",
      );
    }

    return { message: "Senha alterada com sucesso" };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (user && (!user.status || user.status === UserStatus.ACTIVE)) {
      const resetToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          type: "password_reset",
          ver: user.updatedAt.getTime(),
        },
        { expiresIn: "1h" },
      );

      const frontendUrl = removeTrailingSlashes(
        process.env.FRONTEND_URL || "http://localhost:8080",
      );
      const resetLink = `${frontendUrl}/reset-password#token=${encodeURIComponent(resetToken)}`;
      await this.sendPasswordResetEmail(user, resetLink);
    }

    return {
      message:
        "Se o e-mail estiver cadastrado em nosso sistema, um link para redefinição de senha foi enviado.",
    };
  }

  private async sendPasswordResetEmail(
    user: { name: string; email: string },
    resetLink: string,
  ): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      if (process.env.NODE_ENV !== "production") {
        const redactedResetLink = resetLink.replace(/token=[^&]+/, "token=<redacted>");
        console.log(`\n======================================================`);
        console.log(`[LINK DE REDEFINIÇÃO DE SENHA GERADO - MODO DEV]`);
        console.log(`Link gerado para ${user.email}: ${redactedResetLink}`);
        console.log(`======================================================\n`);
      }
      return;
    }

    const safeResetLink = escapeHtml(resetLink);
    const safeUserName = escapeHtml(user.name);
    const safeTargetEmail = escapeHtml(user.email);
    const delivery = resolveEmailDelivery(user.email);
    const relayNotice = delivery.isRelay
      ? `<p style="color: #92400e; font-size: 13px; line-height: 1.5; background: #fffbeb; padding: 10px 12px; border-radius: 6px;">Este link foi solicitado para <strong>${safeTargetEmail}</strong>. Encaminhe esta mensagem ao usuário correto.</p>`
      : "";

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "deusa-analytics-backend/1.0",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: [delivery.recipientEmail],
          subject: delivery.isRelay
            ? `Redefinição de senha para ${user.email} - Deusa Analytics`
            : "Redefinição de Senha - Deusa Analytics",
          html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #1061AF; margin-top: 0;">Deusa Analytics</h2>
                <h3 style="color: #0f172a;">Solicitação de Redefinição de Senha</h3>
                <p style="color: #334155; font-size: 15px; line-height: 1.5;">Olá, <strong>${safeUserName}</strong>!</p>
                <p style="color: #334155; font-size: 15px; line-height: 1.5;">Recebemos uma solicitação para redefinir a senha da sua conta corporativa.</p>
                ${relayNotice}
                <div style="margin: 28px 0; text-align: center;">
                  <a href="${safeResetLink}" style="background-color: #1061AF; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 97, 175, 0.2);">Redefinir Minha Senha</a>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0;">Se você não solicitou a redefinição de senha, ignore este e-mail com segurança. Este link expira em 1 hora.</p>
              </div>
            `,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend retornou HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(
        "[Resend Email Error]:",
        error instanceof Error ? error.message : "Falha ao enviar e-mail",
      );
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException("A confirmação da nova senha não confere.");
    }

    let payload: PasswordResetTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<PasswordResetTokenPayload>(dto.token, {
        algorithms: ["HS256"],
      });
    } catch {
      throw new BadRequestException("O link de redefinição de senha é inválido ou expirou.");
    }

    if (payload.type !== "password_reset" || typeof payload.sub !== "string") {
      throw new BadRequestException("Token de redefinição de senha inválido.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || (user.status && user.status !== UserStatus.ACTIVE)) {
      throw new UnauthorizedException("Usuário não encontrado.");
    }
    if (typeof payload.ver !== "number" || payload.ver !== user.updatedAt.getTime()) {
      throw new BadRequestException("Este link de redefinição já foi utilizado ou invalidado.");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updateResult = await this.prisma.user.updateMany({
      where: { id: user.id, updatedAt: user.updatedAt },
      data: { passwordHash },
    });
    if (updateResult.count !== 1) {
      throw new BadRequestException("Este link de redefinição já foi utilizado ou invalidado.");
    }

    return {
      message: "Sua senha foi redefinida com sucesso! Você já pode fazer login com sua nova senha.",
    };
  }

  async setPassword(dto: SetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException("A confirmação da nova senha não confere.");
    }

    const tokenHash = hashInvitationToken(dto.token);
    const now = new Date();
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true, revokedAt: true },
    });
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now) {
      throw new BadRequestException("O convite é inválido, já foi utilizado ou expirou.");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.userInvitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException("O convite é inválido, já foi utilizado ou expirou.");
        }

        const activated = await tx.user.updateMany({
          where: { id: invitation.userId, status: UserStatus.INVITED },
          data: { passwordHash, status: UserStatus.ACTIVE },
        });
        if (activated.count !== 1) {
          throw new BadRequestException("O convite não pode mais ativar esta conta.");
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("O convite não pôde ser processado. Tente solicitar outro.");
    }

    this.auditLogger?.logEvent({
      action: "USER_INVITATION_ACTIVATED",
      outcome: "SUCCESS",
      userId: invitation.userId,
      details: "Conta ativada após definição de senha por convite",
    });

    return { message: "Senha definida com sucesso. Você já pode fazer login." };
  }
}
