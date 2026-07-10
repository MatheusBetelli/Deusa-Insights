import { Injectable } from "@nestjs/common";
import { LeadStatus, PotentialLevel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function formatCnae(code?: string | null) {
  const digits = code?.replace(/\D/g, "") ?? "";
  if (digits.length !== 7) return code ?? null;
  return digits.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3");
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [
      potentialClients,
      activeClients,
      inactiveClients,
      criticalOpportunities,
      monitoredCities,
      monitoredCnaes,
      topLead,
      topCnae,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: {
          status: { notIn: [LeadStatus.CONVERTED, LeadStatus.INACTIVE, LeadStatus.NOT_INTERESTED] },
          company: { situacaoCadastral: "ATIVA" },
        },
      }),
      this.prisma.lead.count({ where: { status: LeadStatus.CONVERTED } }),
      this.prisma.lead.count({ where: { status: LeadStatus.INACTIVE } }),
      this.prisma.lead.count({
        where: {
          potentialLevel: PotentialLevel.CRITICAL,
          company: { situacaoCadastral: "ATIVA" },
        },
      }),
      this.prisma.city.count({ where: { isActive: true } }),
      this.prisma.cnae.count({ where: { isTarget: true } }),
      this.prisma.lead.findFirst({
        include: { company: { select: { cidade: true } } },
        orderBy: { score: "desc" },
      }),
      this.prisma.cnae.findFirst({ where: { isTarget: true }, orderBy: { code: "asc" } }),
    ]);

    return {
      potentialClients,
      activeClients,
      inactiveClients,
      criticalOpportunities,
      monitoredCities,
      monitoredCnaes,
      priorityCity: topLead?.company.cidade ?? null,
      priorityCnae: formatCnae(topCnae?.code),
    };
  }
}
