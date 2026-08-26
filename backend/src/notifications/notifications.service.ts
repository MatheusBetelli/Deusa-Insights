import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { buildCnaeWhereInput } from "../common/opportunity-filter";
import {
  hasFullPortfolioAccess,
  LeadAccessActor,
  scopeLeadWhere,
} from "../common/lead-access.policy";

export type NotificationItem = {
  id: string;
  type: "HIGH_SCORE_UNASSIGNED" | "IMPORT_COMPLETED" | "ACTION_REQUIRED" | "PIPELINE_UPDATE";
  title: string;
  message: string;
  createdAt: string;
  targetUrl: string;
  category: "OPPORTUNITY" | "IMPORT" | "ACTION";
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalNotifications(actor: LeadAccessActor): Promise<NotificationItem[]> {
    const items: NotificationItem[] = [];

    if (hasFullPortfolioAccess(actor)) {
      const [unassigned, imports] = await Promise.all([
        this.getUnassignedNotification(),
        this.getImportNotifications(),
      ]);
      if (unassigned) items.push(unassigned);
      items.push(...imports);
    }

    const actionRequired = await this.getActionRequiredNotification(actor);
    if (actionRequired) items.push(actionRequired);

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }

  private async getUnassignedNotification(): Promise<NotificationItem | null> {
    const where = {
      assignedToId: null,
      assignedToId_legacy: null,
      OR: [
        { potentialLevel: "CRITICAL" as const },
        { potentialLevel: "HIGH" as const },
        { score: { gte: 70 } },
      ],
      company: {
        situacaoCadastral: "ATIVA",
        ...buildCnaeWhereInput(),
      },
    };
    const count = await this.prisma.lead.count({ where });
    if (count === 0) return null;

    const newest = await this.prisma.lead.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return {
      id: "notif-high-score-unassigned",
      type: "HIGH_SCORE_UNASSIGNED",
      title: `${count} lead${count > 1 ? "s" : ""} de alto potencial sem responsável`,
      message: "Aguardando distribuição para a equipe comercial",
      createdAt: (newest?.createdAt || new Date()).toISOString(),
      targetUrl: "/leads-b2b",
      category: "OPPORTUNITY",
    };
  }

  private async getImportNotifications(): Promise<NotificationItem[]> {
    const jobs = await this.prisma.importJob.findMany({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    return jobs.map((job) => ({
      id: `notif-import-${job.id}`,
      type: "IMPORT_COMPLETED",
      title: `Importação de ${job.cityName}/${job.uf} concluída`,
      message: `${job.totalSaved} empresa${job.totalSaved !== 1 ? "s" : ""} processada${job.totalSaved !== 1 ? "s" : ""}`,
      createdAt: (job.finishedAt || job.createdAt).toISOString(),
      targetUrl: "/importar-cnpjs",
      category: "IMPORT",
    }));
  }

  private async getActionRequiredNotification(
    actor: LeadAccessActor,
  ): Promise<NotificationItem | null> {
    const where = scopeLeadWhere(
      {
        status: "NEW",
        company: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
      },
      actor,
    );
    const newLeadsCount = await this.prisma.lead.count({
      where,
    });
    if (newLeadsCount === 0) return null;

    const newestLead = await this.prisma.lead.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return {
      id: "notif-action-new-leads",
      type: "ACTION_REQUIRED",
      title: `${newLeadsCount} oportunidade${newLeadsCount > 1 ? "s" : ""} aguardando primeira abordagem`,
      message: "Leads ativos prontos para contato inicial",
      createdAt: (newestLead?.createdAt ?? new Date(0)).toISOString(),
      targetUrl: "/leads-b2b",
      category: "ACTION",
    };
  }
}
