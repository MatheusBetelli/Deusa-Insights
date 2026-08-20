import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { buildCnaeWhereInput } from "../common/opportunity-filter";

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

  async getOperationalNotifications(): Promise<NotificationItem[]> {
    const items: NotificationItem[] = [];

    // 1. Leads de alto potencial sem responsável (apenas dentro do escopo comercial Deusa)
    const unassignedCount = await this.prisma.lead.count({
      where: {
        assignedToId: null,
        OR: [
          { potentialLevel: "CRITICAL" },
          { potentialLevel: "HIGH" },
          { score: { gte: 70 } },
        ],
        company: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
      },
    });

    if (unassignedCount > 0) {
      const newestUnassigned = await this.prisma.lead.findFirst({
        where: {
          assignedToId: null,
          OR: [
            { potentialLevel: "CRITICAL" },
            { potentialLevel: "HIGH" },
            { score: { gte: 70 } },
          ],
          company: {
            situacaoCadastral: "ATIVA",
            ...buildCnaeWhereInput(),
          },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      items.push({
        id: "notif-high-score-unassigned",
        type: "HIGH_SCORE_UNASSIGNED",
        title: `${unassignedCount} lead${unassignedCount > 1 ? "s" : ""} de alto potencial sem responsável`,
        message: "Aguardando distribuição para a equipe comercial",
        createdAt: (newestUnassigned?.createdAt || new Date()).toISOString(),
        targetUrl: "/leads-b2b",
        category: "OPPORTUNITY",
      });
    }

    // 2. Importações de CNPJs concluídas recentemente
    const recentJobs = await this.prisma.importJob.findMany({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    for (const job of recentJobs) {
      items.push({
        id: `notif-import-${job.id}`,
        type: "IMPORT_COMPLETED",
        title: `Importação de ${job.cityName}/${job.uf} concluída`,
        message: `${job.totalSaved} empresa${job.totalSaved !== 1 ? "s" : ""} processada${job.totalSaved !== 1 ? "s" : ""}`,
        createdAt: (job.finishedAt || job.createdAt).toISOString(),
        targetUrl: "/importar-cnpjs",
        category: "IMPORT",
      });
    }

    // 3. Novas oportunidades aguardando primeira abordagem comercial (apenas dentro do escopo comercial Deusa)
    const newLeadsCount = await this.prisma.lead.count({
      where: {
        status: "NEW",
        company: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
      },
    });

    if (newLeadsCount > 0) {
      const newestLead = await this.prisma.lead.findFirst({
        where: {
          status: "NEW",
          company: {
            situacaoCadastral: "ATIVA",
            ...buildCnaeWhereInput(),
          },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      items.push({
        id: "notif-action-new-leads",
        type: "ACTION_REQUIRED",
        title: `${newLeadsCount} oportunidade${newLeadsCount > 1 ? "s" : ""} aguardando primeira abordagem`,
        message: "Leads ativos prontos para contato inicial",
        createdAt: (newestLead?.createdAt ?? new Date(0)).toISOString(),
        targetUrl: "/leads-b2b",
        category: "ACTION",
      });
    }

    // Ordenar por data mais recente
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return items;
  }
}
