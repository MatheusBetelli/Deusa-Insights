import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MapOpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const leads = await this.prisma.lead.findMany({
      where: {
        company: {
          latitude: { not: null },
          longitude: { not: null },
          situacaoCadastral: "ATIVA",
        },
      },
      include: { company: true },
      orderBy: { score: "desc" },
    });

    return leads.map((lead) => ({
      id: lead.id,
      companyName: lead.company.nomeFantasia || lead.company.razaoSocial,
      cnpj: lead.company.cnpj,
      city: lead.company.cidade,
      uf: lead.company.uf,
      bairro: lead.company.bairro,
      latitude: lead.company.latitude,
      longitude: lead.company.longitude,
      score: lead.score,
      status: lead.status,
      potentialLevel: lead.potentialLevel,
      // Rastreabilidade de coordenadas — usada pelo frontend para exibir
      // aviso de localização aproximada quando origemCoordenada for "municipio_centroide_jitter"
      origemCoordenada: lead.company.origemCoordenada,
      statusVerificacaoEndereco: lead.company.statusVerificacaoEndereco,
      confiancaVerificacao: lead.company.confiancaVerificacao,
    }));
  }
}

