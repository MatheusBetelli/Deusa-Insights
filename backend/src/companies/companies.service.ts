import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizeCnpj } from "../common/cnpj";
import { CNPJ_PROVIDER, CnpjProvider, ExternalCompany } from "../imports/providers/cnpj-provider.interface";
import { PrismaService } from "../prisma/prisma.service";
import { CompanyQueryDto } from "./dto/company-query.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { GeocodingService } from "../common/geocoding.service";

function normalizeCnae(code?: string | null) {
  return code?.replace(/\D/g, "") || undefined;
}

const safeAssignedToSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CNPJ_PROVIDER) private readonly cnpjProvider: CnpjProvider,
    private readonly geocodingService: GeocodingService,
  ) {}

  findAll(query: CompanyQueryDto) {
    const where: Prisma.CompanyWhereInput = {};
    const and: Prisma.CompanyWhereInput[] = [];

    if (query.city) where.cidade = { equals: query.city, mode: "insensitive" };
    if (query.uf) where.uf = query.uf.toUpperCase();
    if (query.situacaoCadastral) where.situacaoCadastral = { equals: query.situacaoCadastral, mode: "insensitive" };
    if (query.cnae) {
      const cnae = normalizeCnae(query.cnae);
      and.push({
        OR: [{ cnaePrincipal: cnae }, { cnaes: { some: { cnaeCode: cnae } } }],
      });
    }
    if (query.search) {
      and.push({
        OR: [
          { cnpj: { contains: normalizeCnpj(query.search) } },
          { razaoSocial: { contains: query.search, mode: "insensitive" } },
          { nomeFantasia: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (and.length > 0) where.AND = and;

    return this.prisma.company.findMany({
      where,
      include: { cnaes: true, lead: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { cnaes: true, lead: { include: { assignedTo: { select: safeAssignedToSelect } } } },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return company;
  }

  create(dto: CreateCompanyDto) {
    return this.upsertCompany({
      cnpj: dto.cnpj,
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia,
      situacaoCadastral: dto.situacaoCadastral,
      porte: dto.porte,
      matrizFilial: dto.matrizFilial,
      dataAbertura: dto.dataAbertura,
      cnaePrincipal: dto.cnaePrincipal,
      cnaes: dto.cnaes,
      uf: dto.uf,
      cidade: dto.cidade,
      bairro: dto.bairro,
      cep: dto.cep,
      logradouro: dto.logradouro,
      numero: dto.numero,
      complemento: dto.complemento,
      latitude: dto.latitude,
      longitude: dto.longitude,
      source: dto.source ?? "manual",
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const cnaes = dto.cnaes?.map((cnae) => normalizeCnae(cnae)).filter(Boolean) as string[] | undefined;
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...dto,
        uf: dto.uf?.toUpperCase(),
        cnaePrincipal: normalizeCnae(dto.cnaePrincipal),
        cnaes: cnaes
          ? {
              deleteMany: {},
              create: cnaes.map((cnae) => ({ cnaeCode: cnae, isPrimary: cnae === normalizeCnae(dto.cnaePrincipal) })),
            }
          : undefined,
      },
      include: { cnaes: true, lead: true },
    });
    return company;
  }

  async syncByCnpj(cnpj: string) {
    const external = await this.cnpjProvider.getCompanyByCnpj(cnpj);
    if (!external) throw new NotFoundException("CNPJ não encontrado no provider configurado");
    return this.upsertCompany(external);
  }

  async upsertCompany(input: ExternalCompany) {
    const cnpj = normalizeCnpj(input.cnpj);
    const primaryCnae = normalizeCnae(input.cnaePrincipal);
    const cnaes = Array.from(new Set((input.cnaes?.length ? input.cnaes : [primaryCnae]).filter(Boolean).map((cnae) => normalizeCnae(cnae)!)));

    return this.prisma.company.upsert({
      where: { cnpj },
      create: {
        cnpj,
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia,
        situacaoCadastral: input.situacaoCadastral,
        porte: input.porte,
        matrizFilial: input.matrizFilial,
        dataAbertura: input.dataAbertura,
        cnaePrincipal: primaryCnae,
        uf: input.uf.toUpperCase(),
        cidade: input.cidade,
        bairro: input.bairro,
        cep: input.cep,
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        latitude: input.latitude,
        longitude: input.longitude,
        source: input.source,
        lastSyncAt: new Date(),
        // ─── Campos de qualidade cadastral ───────────────────────────────────
        origemCoordenada: input.origemCoordenada,
        statusVerificacaoEndereco: input.statusVerificacaoEndereco,
        confiancaVerificacao: input.confiancaVerificacao,
        enderecoCompleto: input.enderecoCompleto ?? false,
        pendenteValidacao: input.pendenteValidacao ?? false,
        motivosPendencia: input.motivosPendencia ?? [],
        pontuacaoOportunidade: input.pontuacaoOportunidade ?? 0,
        nivelOportunidade: input.nivelOportunidade,
        motivoPontuacao: input.motivoPontuacao ?? [],
        cnaes: {
          create: cnaes.map((cnae) => ({ cnaeCode: cnae, isPrimary: cnae === primaryCnae })),
        },
      },
      update: {
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia,
        situacaoCadastral: input.situacaoCadastral,
        porte: input.porte,
        matrizFilial: input.matrizFilial,
        dataAbertura: input.dataAbertura,
        cnaePrincipal: primaryCnae,
        uf: input.uf.toUpperCase(),
        cidade: input.cidade,
        bairro: input.bairro,
        cep: input.cep,
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        latitude: input.latitude,
        longitude: input.longitude,
        source: input.source,
        lastSyncAt: new Date(),
        // ─── Campos de qualidade cadastral ───────────────────────────────────
        origemCoordenada: input.origemCoordenada,
        statusVerificacaoEndereco: input.statusVerificacaoEndereco,
        confiancaVerificacao: input.confiancaVerificacao,
        enderecoCompleto: input.enderecoCompleto ?? false,
        pendenteValidacao: input.pendenteValidacao ?? false,
        motivosPendencia: input.motivosPendencia ?? [],
        pontuacaoOportunidade: input.pontuacaoOportunidade ?? 0,
        nivelOportunidade: input.nivelOportunidade,
        motivoPontuacao: input.motivoPontuacao ?? [],
        cnaes: {
          deleteMany: {},
          create: cnaes.map((cnae) => ({ cnaeCode: cnae, isPrimary: cnae === primaryCnae })),
        },
      },
      include: { cnaes: true, lead: true },
    });
  }

  async verifyGoogleBatch(query: {
    limit?: number;
    city?: string;
    minScore?: number;
    dryRun?: any;
  }) {
    const limit = Math.min(query.limit ? Number(query.limit) : 50, 100);
    const minScore = query.minScore !== undefined ? Number(query.minScore) : 70;
    const dryRun = query.dryRun !== undefined ? (query.dryRun === true || String(query.dryRun) === "true") : true;
    const city = query.city;

    // 1. Obter cidades monitoradas (ativas no banco)
    const activeCities = await this.prisma.city.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    const activeCityNames = activeCities.map((c) => c.name);

    // 2. Construir condições de seleção
    const andConditions: Prisma.CompanyWhereInput[] = [
      { situacaoCadastral: "ATIVA" },
      { enderecoCompleto: true },
      { pontuacaoOportunidade: { gte: minScore } },
      {
        OR: [
          { statusVerificacaoEndereco: null },
          { statusVerificacaoEndereco: { notIn: ["verificado_google", "provavel", "divergente"] } },
        ],
      },
      {
        OR: [
          { dataVerificacaoGeo: null },
          { dataVerificacaoGeo: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // evitar consultar recentemente
        ],
      },
    ];

    if (city && city !== "Todas") {
      andConditions.push({ cidade: { equals: city, mode: "insensitive" } });
    } else {
      andConditions.push({ cidade: { in: activeCityNames } });
    }

    const companies = await this.prisma.company.findMany({
      where: { AND: andConditions },
      take: limit,
    });

    if (dryRun) {
      const estimatedCost = companies.length * 0.054; // Pior cenário estimado
      return {
        dryRun: true,
        message: `Simulação de verificação concluída para ${companies.length} empresa(s).`,
        totalSelected: companies.length,
        estimatedCostUsd: Number(estimatedCost.toFixed(3)),
        companies: companies.map((c) => ({
          id: c.id,
          cnpj: c.cnpj,
          razaoSocial: c.razaoSocial,
          nomeFantasia: c.nomeFantasia,
          cidade: c.cidade,
          bairro: c.bairro,
          pontuacaoOportunidade: c.pontuacaoOportunidade,
        })),
      };
    }

    // Se não for dryRun, verifica se a API está disponível
    if (!this.geocodingService.isAvailable()) {
      return {
        dryRun: false,
        message: "A validação do Google Maps está desativada (chave GOOGLE_MAPS_API_KEY não configurada).",
        totalSelected: companies.length,
        totalProcessed: 0,
        report: null,
      };
    }

    const report = {
      totalSelected: companies.length,
      totalProcessed: 0,
      totalVerificadoGoogle: 0,
      totalProvavel: 0,
      totalDivergente: 0,
      totalNaoEncontrado: 0,
      custoEstimadoUsd: 0,
      erros: [] as string[],
      cnpjsProcessados: [] as string[],
    };

    for (const company of companies) {
      try {
        const result = await this.geocodingService.geocodeAndVerify({
          cnpj: company.cnpj,
          nomeFantasia: company.nomeFantasia,
          razaoSocial: company.razaoSocial,
          logradouro: company.logradouro,
          numero: company.numero,
          bairro: company.bairro,
          cep: company.cep,
          cidade: company.cidade,
          uf: company.uf,
          telefone: null,
        });

        // Calcular custo
        report.custoEstimadoUsd += 0.005; // Sempre chama Geocoding
        if (result) {
          report.custoEstimadoUsd += 0.032; // Chamou Places Text Search
          if (result.placePhone !== undefined || result.placeName !== undefined) {
            report.custoEstimadoUsd += 0.017; // Chamou Place Details
          }
        }

        let statusVerificacaoEndereco: string;
        let origemCoordenada = company.origemCoordenada;
        let pendenteValidacao = true;
        let lat = company.latitude;
        let lng = company.longitude;

        if (result) {
          const confianca = result.confianca;
          if (confianca >= 90) {
            statusVerificacaoEndereco = "verificado_google";
            origemCoordenada = "geocodificado";
            pendenteValidacao = false;
            lat = result.lat;
            lng = result.lng;
            report.totalVerificadoGoogle++;
          } else if (confianca >= 70) {
            statusVerificacaoEndereco = "provavel";
            origemCoordenada = "geocodificado";
            pendenteValidacao = true;
            lat = result.lat;
            lng = result.lng;
            report.totalProvavel++;
          } else if (confianca >= 50) {
            statusVerificacaoEndereco = "divergente";
            origemCoordenada = "geocodificado";
            pendenteValidacao = true;
            lat = result.lat;
            lng = result.lng;
            report.totalDivergente++;
          } else {
            statusVerificacaoEndereco = "nao_encontrado";
            // Mantém coordenadas aproximadas
            report.totalNaoEncontrado++;
          }

          // Salvar dados no banco
          await this.prisma.company.update({
            where: { id: company.id },
            data: {
              latitudeVerificada: result.lat,
              longitudeVerificada: result.lng,
              latitude: lat,
              longitude: lng,
              origemCoordenada,
              statusVerificacaoEndereco,
              confiancaVerificacao: result.confianca,
              enderecoVerificado: result.enderecoRetornado,
              fonteGeocodificacao: "google_maps",
              dataVerificacaoGeo: new Date(),
              pendenteValidacao,
            },
          });

          // Atualizar o Lead
          await this.prisma.lead.updateMany({
            where: { companyId: company.id },
            data: { pendenteValidacao },
          });
        } else {
          statusVerificacaoEndereco = "nao_encontrado";
          report.totalNaoEncontrado++;

          // Salvar falha no banco
          await this.prisma.company.update({
            where: { id: company.id },
            data: {
              statusVerificacaoEndereco,
              fonteGeocodificacao: "google_maps",
              dataVerificacaoGeo: new Date(),
              pendenteValidacao: true,
            },
          });

          // Atualizar o Lead
          await this.prisma.lead.updateMany({
            where: { companyId: company.id },
            data: { pendenteValidacao: true },
          });
        }

        report.cnpjsProcessados.push(company.cnpj);
        report.totalProcessed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        report.erros.push(`Erro no CNPJ ${company.cnpj}: ${errMsg}`);
      }

      // Delay de 500ms entre as chamadas para rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    report.custoEstimadoUsd = Number(report.custoEstimadoUsd.toFixed(3));

    return {
      dryRun: false,
      message: `Processamento em lote concluído. ${report.totalProcessed} de ${report.totalSelected} empresas processadas.`,
      ...report,
    };
  }
}
