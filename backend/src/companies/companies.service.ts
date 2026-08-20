import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizeCnpj } from "../common/cnpj";
import { isValidCnpj } from "../common/cnpj-validator";
import { getCnaeVariants } from "../common/opportunity-filter";
import {
  CNPJ_PROVIDER,
  CnpjProvider,
  ExternalCompany,
} from "../imports/providers/cnpj-provider.interface";
import { PrismaService } from "../prisma/prisma.service";
import { CompanyQueryDto } from "./dto/company-query.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { CompanyDetailsDto } from "./dto/company-details.dto";
import { ValidateLocationDto } from "./dto/validate-location.dto";
import { GeocodingService } from "../common/geocoding.service";
import { ClassificationService } from "../classification/classification.service";
import { UpdateCommercialProfileDto } from "./dto/update-commercial-profile.dto";

import { ConfigService } from "@nestjs/config";
import { maskCpfInRazaoSocial } from "../common/lgpd.utils";

function normalizeCnae(code?: string | null) {
  return code?.replace(/\D/g, "") || undefined;
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function checkNameSimilarity(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n1 || !n2) return false;
  return n1.includes(n2) || n2.includes(n1) || n1.substring(0, 5) === n2.substring(0, 5);
}

function checkAddressSimilarity(addr1: string, addr2: string): boolean {
  const a1 = addr1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a2 = addr2.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a1 || !a2) return false;
  return a1.includes(a2) || a2.includes(a1);
}

function rejectPaidBatchOperation(): void {
  throw new ForbiddenException(
    "Geocodificação em lote desativada. Use somente correção individual explicitamente autorizada.",
  );
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
    private readonly classificationService: ClassificationService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(query: CompanyQueryDto) {
    if (query.page !== undefined || query.pageSize !== undefined) {
      return this.findPage(query);
    }

    const items = await this.prisma.company.findMany({
      where: this.buildWhere(query),
      include: { cnaes: true, lead: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return items.map((item) => ({
      ...item,
      razaoSocial: maskCpfInRazaoSocial(item.razaoSocial),
    }));
  }

  async findPage(query: CompanyQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), 100);
    const where = this.buildWhere(query);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        include: { cnaes: true, lead: true },
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const sanitizedItems = items.map((item) => ({
      ...item,
      razaoSocial: maskCpfInRazaoSocial(item.razaoSocial),
    }));

    return {
      items: sanitizedItems,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private buildWhere(query: CompanyQueryDto) {
    const where: Prisma.CompanyWhereInput = {};
    const and: Prisma.CompanyWhereInput[] = [];

    if (query.city) where.cidade = { equals: query.city, mode: "insensitive" };
    if (query.uf) where.uf = query.uf.toUpperCase();
    if (query.situacaoCadastral)
      where.situacaoCadastral = { equals: query.situacaoCadastral, mode: "insensitive" };
    if (query.cnae) {
      const cnaeVariants = getCnaeVariants(query.cnae);
      if (cnaeVariants.length > 0) {
        and.push({
          OR: [
            { cnaePrincipal: { in: cnaeVariants } },
            { cnaes: { some: { cnaeCode: { in: cnaeVariants } } } },
          ],
        });
      }
    }
    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      const digitsOnly = normalizeCnpj(searchTerm);
      const searchOr: Prisma.CompanyWhereInput[] = [
        { razaoSocial: { contains: searchTerm, mode: "insensitive" } },
        { nomeFantasia: { contains: searchTerm, mode: "insensitive" } },
      ];
      if (digitsOnly.length > 0) {
        searchOr.push({ cnpj: { contains: digitsOnly } });
      }
      and.push({
        OR: searchOr,
      });
    }
    if (and.length > 0) where.AND = and;

    return where;
  }

  private buildOrderBy(query: CompanyQueryDto): Prisma.CompanyOrderByWithRelationInput[] {
    const direction = query.sortOrder === "desc" ? "desc" : "asc";

    if (query.sortBy === "city") return [{ cidade: direction }, { razaoSocial: "asc" }];
    if (query.sortBy === "cnae") return [{ cnaePrincipal: direction }, { razaoSocial: "asc" }];
    if (query.sortBy === "createdAt") return [{ createdAt: direction }, { razaoSocial: "asc" }];
    return [{ razaoSocial: direction }, { createdAt: "desc" }];
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { cnaes: true, lead: { include: { assignedTo: { select: safeAssignedToSelect } } } },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return {
      ...company,
      razaoSocial: maskCpfInRazaoSocial(company.razaoSocial),
    };
  }

  create(dto: CreateCompanyDto) {
    if (!isValidCnpj(dto.cnpj)) {
      throw new BadRequestException("CNPJ inválido.");
    }
    if ((dto.latitude !== undefined) !== (dto.longitude !== undefined)) {
      throw new BadRequestException("Latitude e longitude devem ser informadas em conjunto.");
    }
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
    if ((dto.latitude !== undefined) !== (dto.longitude !== undefined)) {
      throw new BadRequestException("Latitude e longitude devem ser informadas em conjunto.");
    }
    const cnaes = dto.cnaes?.map((cnae) => normalizeCnae(cnae)).filter(Boolean) as
      | string[]
      | undefined;
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...dto,
        uf: dto.uf?.toUpperCase(),
        cnaePrincipal: normalizeCnae(dto.cnaePrincipal),
        cnaes: cnaes
          ? {
              deleteMany: {},
              create: cnaes.map((cnae) => ({
                cnaeCode: cnae,
                isPrimary: cnae === normalizeCnae(dto.cnaePrincipal),
              })),
            }
          : undefined,
      },
      include: { cnaes: true, lead: true },
    });
    return company;
  }

  async updateCommercialProfile(id: string, dto: UpdateCommercialProfileDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.company.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException("Empresa não encontrada");

      await tx.company.update({
        where: { id },
        data: {
          razaoSocial: dto.razaoSocial,
          nomeFantasia: dto.nomeFantasia,
          logradouro: dto.logradouro,
          numero: dto.numero,
          bairro: dto.bairro,
          cep: dto.cep,
          cidade: dto.cidade,
          uf: dto.uf?.toUpperCase(),
        },
      });

      if (dto.telefone !== undefined || dto.email !== undefined) {
        await tx.companyDetails.upsert({
          where: { companyId: id },
          create: {
            companyId: id,
            telefone: dto.telefone,
            email: dto.email,
          },
          update: {
            telefone: dto.telefone,
            email: dto.email,
          },
        });
      }

      return tx.company.findUnique({
        where: { id },
        include: { cnaes: true, lead: true, details: true },
      });
    });
  }

  async syncByCnpj(cnpj: string) {
    if (!isValidCnpj(cnpj)) {
      throw new BadRequestException("CNPJ inválido.");
    }
    const external = await this.cnpjProvider.getCompanyByCnpj(cnpj);
    if (!external) throw new NotFoundException("CNPJ não encontrado no provider configurado");
    return this.upsertCompany(external);
  }

  async upsertCompany(input: ExternalCompany) {
    const cnpj = normalizeCnpj(input.cnpj);
    if (!isValidCnpj(cnpj)) {
      throw new BadRequestException("CNPJ inválido recebido para sincronização.");
    }
    const primaryCnae = normalizeCnae(input.cnaePrincipal);
    const cnaes = Array.from(
      new Set(
        (input.cnaes?.length ? input.cnaes : [primaryCnae])
          .filter(Boolean)
          .map((cnae) => normalizeCnae(cnae)!),
      ),
    );
    const existing = await this.prisma.company.findUnique({
      where: { cnpj },
      select: {
        validadoManualmente: true,
        statusVerificacaoEndereco: true,
        latitudeVerificada: true,
        longitudeVerificada: true,
      },
    });
    const preserveVerifiedLocation = Boolean(
      existing?.validadoManualmente ||
        existing?.latitudeVerificada != null ||
        existing?.longitudeVerificada != null ||
        ["verificado", "verificado_google", "confirmado"].includes(
          existing?.statusVerificacaoEndereco ?? "",
        ),
    );

    const company = await this.prisma.company.upsert({
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
        ...(preserveVerifiedLocation
          ? {}
          : {
              latitude: input.latitude,
              longitude: input.longitude,
              origemCoordenada: input.origemCoordenada,
              statusVerificacaoEndereco: input.statusVerificacaoEndereco,
              confiancaVerificacao: input.confiancaVerificacao,
            }),
        source: input.source,
        lastSyncAt: new Date(),
        ...(input.enderecoCompleto !== undefined
          ? { enderecoCompleto: input.enderecoCompleto }
          : {}),
        ...(input.pendenteValidacao !== undefined
          ? { pendenteValidacao: input.pendenteValidacao }
          : {}),
        ...(input.motivosPendencia !== undefined
          ? { motivosPendencia: input.motivosPendencia }
          : {}),
        ...(input.pontuacaoOportunidade !== undefined
          ? { pontuacaoOportunidade: input.pontuacaoOportunidade }
          : {}),
        nivelOportunidade: input.nivelOportunidade,
        ...(input.motivoPontuacao !== undefined
          ? { motivoPontuacao: input.motivoPontuacao }
          : {}),
        ...(cnaes.length > 0
          ? {
              cnaes: {
                deleteMany: {},
                create: cnaes.map((cnae) => ({
                  cnaeCode: cnae,
                  isPrimary: cnae === primaryCnae,
                })),
              },
            }
          : {}),
      },
      include: { cnaes: true, lead: true },
    });

    return company;
  }

  async verifyGoogleBatch(query: {
    limit?: number;
    city?: string;
    minScore?: number;
    dryRun?: any;
  }) {
    const limit = Math.min(query.limit ? Number(query.limit) : 50, 100);
    const minScore = query.minScore !== undefined ? Number(query.minScore) : 70;
    const dryRun =
      query.dryRun !== undefined ? query.dryRun === true || String(query.dryRun) === "true" : true;
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
      return {
        dryRun: true,
        message: `Simulação de verificação concluída para ${companies.length} empresa(s).`,
        totalSelected: companies.length,
        estimatedCostUsd: null,
        costNote: "Custo não estimado: varia conforme SKU e uso acumulado da conta.",
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

    rejectPaidBatchOperation();

    // Se não for dryRun, verifica se a API está disponível
    if (!this.geocodingService.isAvailable()) {
      return {
        dryRun: false,
        message:
          "A validação do Google Maps está desativada (chave GOOGLE_MAPS_API_KEY não configurada).",
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
              placeId: result.placeId ?? undefined,
              nomeEncontrado: result.placeName ?? undefined,
              telefoneEncontrado: result.placePhone ?? undefined,
              categoriaEncontrada: result.placeCategory ?? undefined,
            },
          });

          // Se veio telefone do Google Places, enriquecer companyDetails se o telefone não existia
          if (result.placePhone) {
            await this.prisma.companyDetails.upsert({
              where: { companyId: company.id },
              create: {
                companyId: company.id,
                telefone: result.placePhone,
                descricaoCnae: result.placeCategory || undefined,
              },
              update: {
                telefone: result.placePhone,
              },
            });
          }

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

        if (company.cnpj) {
          report.cnpjsProcessados.push(company.cnpj);
        }
        report.totalProcessed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        report.erros.push(`Erro na empresa ${company.cnpj || company.id}: ${errMsg}`);
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

  async getDetails(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { details: true, cnaes: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    const classification = this.classificationService.classifyCompany(company);
    return {
      details: company.details,
      classification,
    };
  }

  async upsertDetails(id: string, dto: CompanyDetailsDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    await this.prisma.companyDetails.upsert({
      where: { companyId: id },
      create: {
        companyId: id,
        naturezaJuridica: dto.naturezaJuridica,
        telefone: dto.telefone,
        email: dto.email,
        descricaoCnae: dto.descricaoCnae,
      },
      update: {
        naturezaJuridica: dto.naturezaJuridica !== undefined ? dto.naturezaJuridica : undefined,
        telefone: dto.telefone !== undefined ? dto.telefone : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        descricaoCnae: dto.descricaoCnae !== undefined ? dto.descricaoCnae : undefined,
      },
    });

    return this.getDetails(id);
  }

  async validateLocation(id: string, dto: ValidateLocationDto) {
    const company = await this.prisma.company.findUnique({ where: { id }, include: { lead: true } });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    const statusValidacao = dto.statusValidacao;
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException("Latitude e longitude devem ser informadas em conjunto.");
    }

    // ─── Nova Regra de Negócio Estrita (PARTE 3) ─────────────────────────────
    // Um registro SOMENTE poderá receber status 'confirmado' quando existir um ESTABELECIMENTO COMERCIAL verificado.
    if (statusValidacao === "confirmado") {
      if (company.situacaoCadastral.toUpperCase() !== "ATIVA") {
        throw new BadRequestException("Apenas empresas com situação cadastral ATIVA na Receita Federal podem receber status CONFIRMADO.");
      }

      const allowedOrigens = [
        "validacao_manual_com_evidencia",
        "google_places",
        "google_maps",
        "site_oficial",
        "rede_social_oficial",
        "outro_diretorio_comercial",
        "validacao_em_campo",
      ];

      if (!dto.origemCoordenada || !allowedOrigens.includes(dto.origemCoordenada)) {
        throw new BadRequestException(
          "Coordenadas manuais sem evidência comprovada não podem confirmar um registro. Forneça o link compartilhável do Google Maps ou validação em campo com a origem validacao_manual_com_evidencia."
        );
      }

      if (!dto.nomeEncontrado?.trim()) {
        throw new BadRequestException("O nome do estabelecimento comercial encontrado é obrigatório para confirmação.");
      }
      if (!dto.enderecoEncontrado?.trim()) {
        throw new BadRequestException("O endereço do estabelecimento comercial encontrado é obrigatório para confirmação.");
      }
      if (!dto.categoriaEncontrada?.trim()) {
        throw new BadRequestException("A categoria comercial encontrada é obrigatória para confirmação.");
      }
      if (!dto.fonteConsultada?.trim()) {
        throw new BadRequestException("A fonte consultada é obrigatória para confirmação.");
      }
      if (!dto.urlEvidencia?.trim() && !dto.placeId?.trim() && !dto.evidenciaVisita?.trim()) {
        throw new BadRequestException("É necessário fornecer a URL da evidência digital, Place ID ou relatório de visita presencial.");
      }
      if (dto.latitude === undefined || dto.longitude === undefined || dto.latitude === 0 || dto.longitude === 0) {
        throw new BadRequestException("Coordenadas numéricas válidas e não nulas são obrigatórias.");
      }
      if (dto.latitude < -90 || dto.latitude > 90 || dto.longitude < -180 || dto.longitude > 180) {
        throw new BadRequestException("Coordenadas fora dos limites válidos (-90 a 90, -180 a 180).");
      }
      if (!dto.justificativaDecisao?.trim()) {
        throw new BadRequestException("A justificativa específica da decisão é obrigatória.");
      }
      if (dto.origemCoordenada === "validacao_em_campo" && !dto.nomeResponsavelVisita?.trim()) {
        throw new BadRequestException("O nome do responsável pela visita presencial é obrigatório para confirmação em campo.");
      }
    }

    const isConfirmado = statusValidacao === "confirmado";
    const isProvavel = statusValidacao === "provavel";
    const pendenteValidacao = !isConfirmado && !isProvavel;
    const origemCoordenada = dto.origemCoordenada || (isConfirmado ? "google_maps" : "sem_coordenada");

    const updateData: Prisma.CompanyUpdateInput = {
      statusValidacao,
      validadoManualmente: true,
      dataUltimaValidacao: new Date(),
      observacaoValidacao: dto.observacaoValidacao ?? dto.justificativaDecisao ?? null,
      pendenteValidacao,
      fonteConsultada: dto.fonteConsultada ?? null,
      urlEvidencia: dto.urlEvidencia ?? null,
      placeId: dto.placeId ?? null,
      nomeEncontrado: dto.nomeEncontrado ?? null,
      enderecoEncontrado: dto.enderecoEncontrado ?? null,
      telefoneEncontrado: dto.telefoneEncontrado ?? null,
      categoriaEncontrada: dto.categoriaEncontrada ?? null,
      situacaoAparente: dto.situacaoAparente ?? null,
      distanciaAproximadaMeters: dto.distanciaAproximadaMeters ?? null,
      justificativaDecisao: dto.justificativaDecisao ?? dto.observacaoValidacao ?? null,
      nomeResponsavelVisita: dto.nomeResponsavelVisita ?? null,
      dataVisita: dto.dataVisita ? new Date(dto.dataVisita) : null,
      evidenciaVisita: dto.evidenciaVisita ?? null,
    };

    if (dto.latitude !== undefined && dto.longitude !== undefined && dto.latitude !== 0 && dto.longitude !== 0) {
      updateData.latitude = dto.latitude;
      updateData.longitude = dto.longitude;
      updateData.origemCoordenada = origemCoordenada;
      if (isConfirmado || isProvavel) {
        updateData.latitudeVerificada = dto.latitude;
        updateData.longitudeVerificada = dto.longitude;
        updateData.statusVerificacaoEndereco = isConfirmado ? "verificado" : "provavel";
        updateData.confiancaVerificacao = isConfirmado ? 100 : 80;
      }
    }

    if (dto.enderecoVerificado) {
      updateData.enderecoVerificado = dto.enderecoVerificado;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id },
        data: updateData,
        include: { cnaes: true, lead: true, details: true },
      });

      if (company.lead) {
        await tx.lead.updateMany({
          where: { companyId: id },
          data: { pendenteValidacao },
        });
      }

      return updated;
    });
  }

  async getLocationCandidates(id: string, confirmPaidRequest: boolean) {
    if (confirmPaidRequest !== true) {
      throw new BadRequestException(
        "Confirmação explícita obrigatória antes de consultar a Google Places API.",
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!company) {
      throw new NotFoundException(`Empresa com ID ${id} não encontrada.`);
    }

    const apiKey = this.configService.get<string>("GOOGLE_MAPS_API_KEY");
    const isConfigured = Boolean(apiKey && apiKey.trim().length > 0);

    const query1 = `${company.nomeFantasia || company.razaoSocial} ${company.logradouro || ""} ${company.numero || ""} ${company.cidade} ${company.uf}`.trim();
    const phone = company.details?.telefone || "";
    const queriesExecuted = [query1];

    const companyData = {
      id: company.id,
      cnpj: company.cnpj,
      nomeFantasia: company.nomeFantasia,
      razaoSocial: company.razaoSocial,
      enderecoOriginal: `${company.logradouro || ""}, ${company.numero || "S/N"} - ${company.bairro || ""}, ${company.cidade}/${company.uf} - CEP ${company.cep || ""}`,
      situacaoCadastral: company.situacaoCadastral,
      cep: company.cep,
      cidade: company.cidade,
      uf: company.uf,
      cnaePrincipal: company.cnaePrincipal,
      telefone: company.details?.telefone || null,
    };

    if (!isConfigured) {
      return {
        company: companyData,
        apiKeyConfigured: false,
        queriesExecuted,
        candidates: [],
        message: "GOOGLE_MAPS_API_KEY não configurada no backend. Insira a chave no arquivo backend/.env para habilitar a busca na Google Places API.",
      };
    }

    const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri";
    const candidateMap = new Map<string, any>();
    let apiCallsCount = 0;
    const apiErrors: string[] = [];

    for (const queryStr of queriesExecuted) {
      try {
        const reqHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey || "",
          "X-Goog-FieldMask": fieldMask,
        };

        apiCallsCount++;
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: reqHeaders,
          body: JSON.stringify({
            textQuery: queryStr,
            languageCode: "pt-BR",
            maxResultCount: 5,
          }),
        });

        if (!res.ok) {
          apiErrors.push(`Consulta ao provedor retornou HTTP ${res.status}.`);
          continue;
        }

        const data = await res.json();
        const places = data.places || [];

        for (const place of places) {
          if (!place.id || candidateMap.has(place.id)) continue;

          const lat = place.location?.latitude ?? 0;
          const lng = place.location?.longitude ?? 0;

          const distMeters = (company.latitude && company.longitude)
            ? calculateHaversineDistance(company.latitude, company.longitude, lat, lng)
            : 0;

          const placeName = place.displayName?.text || "";
          const placeAddr = place.formattedAddress || "";
          const placePhone = place.nationalPhoneNumber || "";

          const nomeCompativel = checkNameSimilarity(company.nomeFantasia || company.razaoSocial, placeName);
          const enderecoCompativel = checkAddressSimilarity(company.logradouro || "", placeAddr);
          const telefoneCompativel = phone ? placePhone.replace(/\D/g, "").includes(phone.replace(/\D/g, "")) : false;
          const municipioCompativel = placeAddr.toLowerCase().includes(company.cidade.toLowerCase());
          const allowedPlaceTypes = new Set([
            "supermarket",
            "hypermarket",
            "grocery_store",
            "asian_grocery_store",
            "japanese_grocery_store",
            "butcher_shop",
          ]);
          const categoriaCompativel =
            allowedPlaceTypes.has(place.primaryType || "") ||
            (Array.isArray(place.types) &&
              place.types.some((type: string) => allowedPlaceTypes.has(type)));

          let score = 0;
          const motivos: string[] = [];
          const alertas: string[] = [];

          if (nomeCompativel) { score += 40; motivos.push("Nome comercial correspondente"); } else { alertas.push("Nome do estabelecimento diferente do cadastrado na Receita"); }
          if (enderecoCompativel) { score += 30; motivos.push("Logradouro compatível"); } else { alertas.push("Divergência de endereço/número"); }
          if (municipioCompativel) { score += 15; motivos.push(`Município ${company.cidade} verificado`); } else { alertas.push("Município divergente"); }
          if (!categoriaCompativel) alertas.push("Categoria fora do escopo comercial autorizado");
          if (telefoneCompativel) { score += 15; motivos.push("Telefone correspondente"); }

          candidateMap.set(place.id, {
            placeId: place.id,
            displayName: placeName,
            formattedAddress: placeAddr,
            latitude: lat,
            longitude: lng,
            primaryType: place.primaryType || null,
            types: place.types || [],
            businessStatus: place.businessStatus || null,
            nationalPhoneNumber: placePhone || null,
            websiteUri: place.websiteUri || null,
            googleMapsUri: place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
            queryExecuted: queryStr,
            distanciaDoEnderecoCadastradoMetros: Math.round(distMeters),
            nomeCompativel,
            enderecoCompativel,
            telefoneCompativel,
            municipioCompativel,
            categoriaCompativel,
            pontuacaoCorrespondencia: score,
            motivosCorrespondencia: motivos,
            alertas,
          });
        }
      } catch {
        apiErrors.push("Falha de rede ou timeout ao consultar o provedor.");
      }
    }

    const candidates = Array.from(candidateMap.values())
      .sort((a, b) => b.pontuacaoCorrespondencia - a.pontuacaoCorrespondencia)
      .slice(0, 5);

    return {
      company: companyData,
      apiKeyConfigured: true,
      queriesExecuted,
      apiCallsCount,
      fieldMaskUsed: fieldMask,
      apiErrors,
      candidates,
    };
  }

  async getGoogleMapsReadiness() {
    const isAvailable = this.geocodingService.isAvailable();
    const maskedKey = this.geocodingService.getMaskedKey();

    const totalCompanies = await this.prisma.company.count();
    
    const cnae4712100Count = await this.prisma.company.count({
      where: {
        OR: [
          { cnaePrincipal: "4711302" },
          { cnaePrincipal: "4712100" },
          { cnaes: { some: { cnaeCode: { in: ["4711302", "4712100"] } } } },
        ],
      },
    });

    const cnae4712100Geocoded = await this.prisma.company.count({
      where: {
        OR: [
          { cnaePrincipal: "4711302" },
          { cnaePrincipal: "4712100" },
          { cnaes: { some: { cnaeCode: { in: ["4711302", "4712100"] } } } },
        ],
        latitudeVerificada: { not: null },
      },
    });

    const totalVerified = await this.prisma.company.count({
      where: { latitudeVerificada: { not: null } },
    });

    const pendingTargetCount = cnae4712100Count - cnae4712100Geocoded;

    return {
      status: isAvailable ? "PRONTO" : "AGUARDANDO_CHAVE",
      apiKeyConfigured: isAvailable,
      maskedKey,
      message: isAvailable
        ? "Chave GOOGLE_MAPS_API_KEY ativa. O sistema está pronto para realizar geocodificação de precisão e busca no Google Places."
        : "GOOGLE_MAPS_API_KEY não configurada no arquivo backend/.env. Insira a chave quando disponível para liberar geocodificação em tempo real.",
      targetCnae: "4712100 (Minimercados, mercearias e armazéns)",
      metrics: {
        totalCompanies,
        totalVerified,
        totalPending: totalCompanies - totalVerified,
        cnae4712100Count,
        cnae4712100Geocoded,
        cnae4712100Pending: pendingTargetCount,
      },
      freeTierQuota: {
        monthlyLimit: "O limite gratuito varia por SKU e deve ser conferido na tabela oficial vigente.",
        estimatedCallsForPendingTarget: pendingTargetCount,
        estimatedCost: "Não calculado: depende dos SKUs, da franquia e do uso acumulado da conta.",
      },
    };
  }

  async geocodeBatchCompanies(cnaeCode = "4712100", limit = 50, forceReverify = false) {
    rejectPaidBatchOperation();

    if (!this.geocodingService.isAvailable()) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY não configurada em backend/.env. Adicione a chave para liberar a geocodificação em lote.",
        processed: 0,
      };
    }

    const whereCondition: Prisma.CompanyWhereInput = {
      ...(cnaeCode
        ? {
            OR: [
              { cnaePrincipal: cnaeCode },
              { cnaes: { some: { cnaeCode } } },
            ],
          }
        : {}),
      ...(forceReverify ? {} : { latitudeVerificada: null }),
    };

    const companies = await this.prisma.company.findMany({
      where: whereCondition,
      take: limit,
      include: { details: true },
    });

    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const company of companies) {
      const result = await this.geocodingService.geocodeAndVerify({
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
        logradouro: company.logradouro,
        numero: company.numero,
        bairro: company.bairro,
        cep: company.cep,
        cidade: company.cidade,
        uf: company.uf,
        telefone: company.details?.telefone,
      });

      if (result) {
        successCount++;
        await this.prisma.company.update({
          where: { id: company.id },
          data: {
            latitude: result.lat,
            longitude: result.lng,
            latitudeVerificada: result.lat,
            longitudeVerificada: result.lng,
            enderecoVerificado: result.enderecoRetornado,
            fonteGeocodificacao: result.fonte,
            confiancaVerificacao: result.confianca,
            statusVerificacaoEndereco: result.confianca >= 60 ? "verificado" : "provavel",
            dataVerificacaoGeo: result.dataVerificacao,
            origemCoordenada: "geocodificado",
            placeId: result.placeId ?? undefined,
            nomeEncontrado: result.placeName ?? undefined,
            telefoneEncontrado: result.placePhone ?? undefined,
            categoriaEncontrada: result.placeCategory ?? undefined,
          },
        });

        if (result.placePhone) {
          await this.prisma.companyDetails.upsert({
            where: { companyId: company.id },
            create: {
              companyId: company.id,
              telefone: result.placePhone,
              descricaoCnae: result.placeCategory || undefined,
            },
            update: {
              telefone: result.placePhone,
            },
          });
        }
        results.push({
          cnpj: company.cnpj,
          razaoSocial: company.razaoSocial,
          lat: result.lat,
          lng: result.lng,
          confianca: result.confianca,
          endereco: result.enderecoRetornado,
        });
      } else {
        failedCount++;
      }
    }

    return {
      success: true,
      processed: companies.length,
      successCount,
      failedCount,
      results,
    };
  }
}
