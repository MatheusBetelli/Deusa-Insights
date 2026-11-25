import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ContactSource, ContactType, Prisma, UserRole } from "@prisma/client";
import { ClassificationService } from "../classification/classification.service";
import { normalizeCnpj } from "../common/cnpj";
import { isValidCnpj } from "../common/cnpj-validator";
import { LeadAccessActor, scopeCompanyWhere } from "../common/lead-access.policy";
import { maskCpfInRazaoSocial } from "../common/lgpd.utils";
import { getCnaeVariants } from "../common/opportunity-filter";
import {
  CNPJ_PROVIDER,
  CnpjProvider,
  ExternalCompany,
} from "../imports/providers/cnpj-provider.interface";
import { MapOpportunitiesService } from "../map-opportunities/map-opportunities.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  contactAuditFields,
  normalizeContactUpdateDto,
  NormalizedContact,
  normalizeManualContactDto,
} from "./domain/company-contacts";
import {
  assertConfirmedLocation,
  assertCoordinatePair,
  assertManualLocationCoordinates,
  buildLocationCandidate,
  buildLocationValidationUpdate,
  LocationCandidate,
  searchGooglePlaces,
} from "./domain/company-location";
import { CreateCompanyContactDto, UpdateCompanyContactDto } from "./dto/company-contact.dto";
import { CompanyDetailsDto } from "./dto/company-details.dto";
import { CompanyQueryDto } from "./dto/company-query.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCommercialProfileDto } from "./dto/update-commercial-profile.dto";
import { UpdateCompanyLocationDto } from "./dto/update-company-location.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ValidateLocationDto } from "./dto/validate-location.dto";
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
    private readonly classificationService: ClassificationService,
    private readonly configService: ConfigService,
    @Optional() private readonly mapOpportunitiesService?: MapOpportunitiesService,
  ) {}

  async findAll(query: CompanyQueryDto, actor: LeadAccessActor) {
    if (query.page !== undefined || query.pageSize !== undefined) {
      return this.findPage(query, actor);
    }

    const where = scopeCompanyWhere(this.buildWhere(query), actor);
    const items = await this.prisma.company.findMany({
      where,
      include: { cnaes: true, lead: true, details: true, contacts: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return items.map((item) => ({
      ...item,
      razaoSocial: maskCpfInRazaoSocial(item.razaoSocial),
    }));
  }

  async findPage(query: CompanyQueryDto, actor: LeadAccessActor) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), 100);
    const where = scopeCompanyWhere(this.buildWhere(query), actor);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        include: { cnaes: true, lead: true, details: true, contacts: true },
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

  async findById(id: string, actor: LeadAccessActor) {
    const company = await this.prisma.company.findFirst({
      where: scopeCompanyWhere({ id }, actor),
      include: {
        cnaes: true,
        details: true,
        contacts: true,
        clientAccounts: { where: { isCurrentClient: true }, select: { isCurrentClient: true } },
        lead: { include: { assignedTo: { select: safeAssignedToSelect } } },
      },
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
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      throw new BadRequestException(
        "A localização deve ser ajustada exclusivamente pelo endpoint de localização manual.",
      );
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

  async updateCommercialProfile(
    id: string,
    dto: UpdateCommercialProfileDto,
    actor: LeadAccessActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.company.findFirst({
        where: scopeCompanyWhere({ id }, actor),
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

      if (dto.telefone?.trim()) {
        await this.upsertContactRecord(
          tx,
          id,
          {
            type: ContactType.PHONE,
            value: dto.telefone,
            source: ContactSource.MANUAL,
            isPrimary: true,
            active: true,
          },
          actor,
        );
      }
      if (dto.email?.trim()) {
        await this.upsertContactRecord(
          tx,
          id,
          {
            type: ContactType.EMAIL,
            value: dto.email,
            source: ContactSource.MANUAL,
            isPrimary: true,
            active: true,
          },
          actor,
        );
      }

      return tx.company.findUnique({
        where: { id },
        include: { cnaes: true, lead: true, details: true, contacts: true },
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
        origemCoordenada: true,
      },
    });
    const preserveVerifiedLocation = Boolean(
      existing?.validadoManualmente ||
      existing?.latitudeVerificada != null ||
      existing?.longitudeVerificada != null ||
      existing?.origemCoordenada === "coordenada_manual" ||
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
        ...(input.motivoPontuacao !== undefined ? { motivoPontuacao: input.motivoPontuacao } : {}),
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

  async getDetails(id: string, actor: LeadAccessActor) {
    const company = await this.prisma.company.findFirst({
      where: scopeCompanyWhere({ id }, actor),
      include: { details: true, cnaes: true, contacts: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    const classification = this.classificationService.classifyCompany(company);
    return {
      details: company.details,
      contacts: company.contacts,
      classification,
    };
  }

  async upsertDetails(id: string, dto: CompanyDetailsDto, actor: LeadAccessActor) {
    const company = await this.prisma.company.findFirst({
      where: scopeCompanyWhere({ id }, actor),
      select: { id: true },
    });
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

    return this.getDetails(id, actor);
  }

  async listContacts(id: string, actor: LeadAccessActor) {
    const company = await this.prisma.company.findFirst({
      where: scopeCompanyWhere({ id }, actor),
      select: { id: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    return this.prisma.companyContact.findMany({
      where: { companyId: id, active: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
  }

  async createContact(id: string, dto: CreateCompanyContactDto, actor: LeadAccessActor) {
    const company = await this.prisma.company.findFirst({
      where: scopeCompanyWhere({ id }, actor),
      select: { id: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    return this.prisma.$transaction((tx) =>
      this.upsertContactRecord(tx, id, normalizeManualContactDto(dto), actor),
    );
  }

  async updateContact(
    id: string,
    contactId: string,
    dto: UpdateCompanyContactDto,
    actor: LeadAccessActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: scopeCompanyWhere({ id }, actor),
        select: { id: true },
      });
      if (!company) throw new NotFoundException("Empresa não encontrada");

      const existing = await tx.companyContact.findFirst({
        where: { id: contactId, companyId: id },
      });
      if (!existing) throw new NotFoundException("Contato não encontrado");

      const normalized = normalizeContactUpdateDto(dto, existing);

      if (normalized.isPrimary) {
        await tx.companyContact.updateMany({
          where: { companyId: id, type: normalized.type, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }

      return tx.companyContact.update({
        where: { id: contactId },
        data: {
          value: normalized.value,
          isPrimary: normalized.isPrimary,
          active: normalized.active,
        },
      });
    });
  }

  async updateLocation(id: string, dto: UpdateCompanyLocationDto, actor: LeadAccessActor) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Somente administradores podem ajustar a localização.");
    }
    assertManualLocationCoordinates(dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: scopeCompanyWhere({ id }, actor),
        select: { id: true, latitude: true, longitude: true },
      });
      if (!company) throw new NotFoundException("Empresa não encontrada");

      if (company.latitude === dto.latitude && company.longitude === dto.longitude) {
        throw new BadRequestException("A nova localização deve ser diferente da atual.");
      }

      const result = await tx.company.update({
        where: { id },
        data: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          origemCoordenada: "coordenada_manual",
        },
      });

      await tx.companyLocationAudit.create({
        data: {
          companyId: id,
          responsibleUserId: actor.sub,
          previousLatitude: company.latitude,
          previousLongitude: company.longitude,
          newLatitude: dto.latitude,
          newLongitude: dto.longitude,
          origin: "MANUAL_MAP_ADJUSTMENT",
        },
      });

      return result;
    });

    this.mapOpportunitiesService?.invalidateCache();
    return updated;
  }

  private async upsertContactRecord(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: NormalizedContact,
    actor: LeadAccessActor,
  ) {
    if (input.isPrimary) {
      await tx.companyContact.updateMany({
        where: { companyId, type: input.type },
        data: { isPrimary: false },
      });
    }

    return tx.companyContact.upsert({
      where: {
        companyId_type_value: {
          companyId,
          type: input.type,
          value: input.value,
        },
      },
      create: {
        companyId,
        type: input.type,
        value: input.value,
        source: input.source,
        ...contactAuditFields(actor),
        isPrimary: input.isPrimary,
        active: input.active,
      },
      update: {
        isPrimary: input.isPrimary,
        active: input.active,
      },
    });
  }

  async validateLocation(id: string, dto: ValidateLocationDto, actor: LeadAccessActor) {
    const company = await this.prisma.company.findFirst({
      where: scopeCompanyWhere({ id }, actor),
      include: { lead: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    assertCoordinatePair(dto);

    // ─── Nova Regra de Negócio Estrita (PARTE 3) ─────────────────────────────
    // Um registro SOMENTE poderá receber status 'confirmado' quando existir um ESTABELECIMENTO COMERCIAL verificado.
    if (dto.statusValidacao === "confirmado") {
      assertConfirmedLocation(company.situacaoCadastral, dto);
    }

    const { updateData, pendenteValidacao } = buildLocationValidationUpdate(dto);
    const hasCoordinates = dto.latitude !== undefined && dto.longitude !== undefined;
    const locationChanged =
      hasCoordinates && (company.latitude !== dto.latitude || company.longitude !== dto.longitude);
    const auditOrigin =
      dto.origemCoordenada === "coordenada_manual"
        ? "MANUAL_LOCATION_VALIDATION"
        : "LOCATION_VALIDATION";

    const updated = await this.prisma.$transaction(async (tx) => {
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

      if (locationChanged && dto.latitude !== undefined && dto.longitude !== undefined) {
        await tx.companyLocationAudit.create({
          data: {
            companyId: id,
            responsibleUserId: actor.sub,
            previousLatitude: company.latitude,
            previousLongitude: company.longitude,
            newLatitude: dto.latitude,
            newLongitude: dto.longitude,
            origin: auditOrigin,
          },
        });
      }

      return updated;
    });

    if (locationChanged) this.mapOpportunitiesService?.invalidateCache();
    return updated;
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

    const query1 =
      `${company.nomeFantasia || company.razaoSocial} ${company.logradouro || ""} ${company.numero || ""} ${company.cidade} ${company.uf}`.trim();
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
        message:
          "GOOGLE_MAPS_API_KEY não configurada no backend. Insira a chave no arquivo backend/.env para habilitar a busca na Google Places API.",
      };
    }

    const fieldMask =
      "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri";
    const candidateMap = new Map<string, LocationCandidate>();
    let apiCallsCount = 0;
    const apiErrors: string[] = [];

    for (const queryStr of queriesExecuted) {
      apiCallsCount += 1;
      const { places, error } = await searchGooglePlaces(queryStr, apiKey!, fieldMask);
      if (error) apiErrors.push(error);

      for (const place of places) {
        const candidate = buildLocationCandidate(place, company, queryStr);
        if (candidate && !candidateMap.has(candidate.placeId)) {
          candidateMap.set(candidate.placeId, candidate);
        }
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
}
