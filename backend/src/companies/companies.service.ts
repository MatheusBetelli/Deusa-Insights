import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
import { ClassificationService } from "../classification/classification.service";
import { UpdateCommercialProfileDto } from "./dto/update-commercial-profile.dto";

import { ConfigService } from "@nestjs/config";
import { maskCpfInRazaoSocial } from "../common/lgpd.utils";
import { LeadAccessActor, scopeCompanyWhere } from "../common/lead-access.policy";

function normalizeCnae(code?: string | null) {
  return code?.replace(/\D/g, "") || undefined;
}

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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

type GooglePlacePayload = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlacePayload[];
};

type LocationCandidate = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  primaryType: string | null;
  types: string[];
  businessStatus: string | null;
  nationalPhoneNumber: string | null;
  websiteUri: string | null;
  googleMapsUri: string;
  queryExecuted: string;
  distanciaDoEnderecoCadastradoMetros: number;
  nomeCompativel: boolean;
  enderecoCompativel: boolean;
  telefoneCompativel: boolean;
  municipioCompativel: boolean;
  categoriaCompativel: boolean;
  pontuacaoCorrespondencia: number;
  motivosCorrespondencia: string[];
  alertas: string[];
};

type LocationCandidateCompany = {
  id: string;
  cnpj: string | null;
  nomeFantasia: string | null;
  razaoSocial: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  situacaoCadastral: string;
  cnaePrincipal: string | null;
  latitude: number | null;
  longitude: number | null;
  details: { telefone: string | null } | null;
};

const CONFIRMED_LOCATION_SOURCES = new Set([
  "validacao_manual_com_evidencia",
  "google_places",
  "google_maps",
  "site_oficial",
  "rede_social_oficial",
  "outro_diretorio_comercial",
  "validacao_em_campo",
]);

const ALLOWED_GOOGLE_PLACE_TYPES = new Set([
  "supermarket",
  "hypermarket",
  "grocery_store",
  "asian_grocery_store",
  "japanese_grocery_store",
  "butcher_shop",
]);

function assertCoordinatePair(dto: ValidateLocationDto): void {
  const hasLatitude = dto.latitude !== undefined;
  const hasLongitude = dto.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    throw new BadRequestException("Latitude e longitude devem ser informadas em conjunto.");
  }
}

function assertConfirmedLocation(situacaoCadastral: string, dto: ValidateLocationDto): void {
  if (situacaoCadastral.toUpperCase() !== "ATIVA") {
    throw new BadRequestException(
      "Apenas empresas com situação cadastral ATIVA na Receita Federal podem receber status CONFIRMADO.",
    );
  }
  if (!dto.origemCoordenada || !CONFIRMED_LOCATION_SOURCES.has(dto.origemCoordenada)) {
    throw new BadRequestException(
      "Coordenadas manuais sem evidência comprovada não podem confirmar um registro. Forneça o link compartilhável do Google Maps ou validação em campo com a origem validacao_manual_com_evidencia.",
    );
  }

  const requiredFields: Array<[string | undefined, string]> = [
    [
      dto.nomeEncontrado,
      "O nome do estabelecimento comercial encontrado é obrigatório para confirmação.",
    ],
    [
      dto.enderecoEncontrado,
      "O endereço do estabelecimento comercial encontrado é obrigatório para confirmação.",
    ],
    [dto.categoriaEncontrada, "A categoria comercial encontrada é obrigatória para confirmação."],
    [dto.fonteConsultada, "A fonte consultada é obrigatória para confirmação."],
    [dto.justificativaDecisao, "A justificativa específica da decisão é obrigatória."],
  ];
  for (const [value, message] of requiredFields) {
    if (!value?.trim()) throw new BadRequestException(message);
  }

  if (!dto.urlEvidencia?.trim() && !dto.placeId?.trim() && !dto.evidenciaVisita?.trim()) {
    throw new BadRequestException(
      "É necessário fornecer a URL da evidência digital, Place ID ou relatório de visita presencial.",
    );
  }
  if (
    dto.latitude === undefined ||
    dto.longitude === undefined ||
    dto.latitude === 0 ||
    dto.longitude === 0
  ) {
    throw new BadRequestException("Coordenadas numéricas válidas e não nulas são obrigatórias.");
  }
  if (dto.latitude < -90 || dto.latitude > 90 || dto.longitude < -180 || dto.longitude > 180) {
    throw new BadRequestException("Coordenadas fora dos limites válidos (-90 a 90, -180 a 180).");
  }
  if (dto.origemCoordenada === "validacao_em_campo" && !dto.nomeResponsavelVisita?.trim()) {
    throw new BadRequestException(
      "O nome do responsável pela visita presencial é obrigatório para confirmação em campo.",
    );
  }
}

async function searchGooglePlaces(
  query: string,
  apiKey: string,
  fieldMask: string,
): Promise<{ places: GooglePlacePayload[]; error?: string }> {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "pt-BR",
        maxResultCount: 5,
      }),
    });
    if (!response.ok) {
      return { places: [], error: `Consulta ao provedor retornou HTTP ${response.status}.` };
    }
    const data = (await response.json()) as GooglePlacesResponse;
    return { places: data.places ?? [] };
  } catch {
    return { places: [], error: "Falha de rede ou timeout ao consultar o provedor." };
  }
}

function buildLocationCandidate(
  place: GooglePlacePayload,
  company: LocationCandidateCompany,
  query: string,
): LocationCandidate | undefined {
  if (!place.id) return undefined;

  const latitude = place.location?.latitude ?? 0;
  const longitude = place.location?.longitude ?? 0;
  const distanceMeters =
    company.latitude && company.longitude
      ? calculateHaversineDistance(company.latitude, company.longitude, latitude, longitude)
      : 0;
  const displayName = place.displayName?.text || "";
  const formattedAddress = place.formattedAddress || "";
  const placePhone = place.nationalPhoneNumber || "";
  const companyPhone = company.details?.telefone || "";
  const nomeCompativel = checkNameSimilarity(
    company.nomeFantasia || company.razaoSocial,
    displayName,
  );
  const enderecoCompativel = checkAddressSimilarity(company.logradouro || "", formattedAddress);
  const telefoneCompativel = companyPhone
    ? placePhone.replace(/\D/g, "").includes(companyPhone.replace(/\D/g, ""))
    : false;
  const municipioCompativel = formattedAddress.toLowerCase().includes(company.cidade.toLowerCase());
  const categoriaCompativel =
    ALLOWED_GOOGLE_PLACE_TYPES.has(place.primaryType || "") ||
    Boolean(place.types?.some((type) => ALLOWED_GOOGLE_PLACE_TYPES.has(type)));

  let score = 0;
  const motivos: string[] = [];
  const alertas: string[] = [];
  if (nomeCompativel) {
    score += 40;
    motivos.push("Nome comercial correspondente");
  } else alertas.push("Nome do estabelecimento diferente do cadastrado na Receita");
  if (enderecoCompativel) {
    score += 30;
    motivos.push("Logradouro compatível");
  } else alertas.push("Divergência de endereço/número");
  if (municipioCompativel) {
    score += 15;
    motivos.push(`Município ${company.cidade} verificado`);
  } else alertas.push("Município divergente");
  if (!categoriaCompativel) alertas.push("Categoria fora do escopo comercial autorizado");
  if (telefoneCompativel) {
    score += 15;
    motivos.push("Telefone correspondente");
  }

  return {
    placeId: place.id,
    displayName,
    formattedAddress,
    latitude,
    longitude,
    primaryType: place.primaryType || null,
    types: place.types || [],
    businessStatus: place.businessStatus || null,
    nationalPhoneNumber: placePhone || null,
    websiteUri: place.websiteUri || null,
    googleMapsUri:
      place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    queryExecuted: query,
    distanciaDoEnderecoCadastradoMetros: Math.round(distanceMeters),
    nomeCompativel,
    enderecoCompativel,
    telefoneCompativel,
    municipioCompativel,
    categoriaCompativel,
    pontuacaoCorrespondencia: score,
    motivosCorrespondencia: motivos,
    alertas,
  };
}

function buildLocationValidationUpdate(dto: ValidateLocationDto): {
  updateData: Prisma.CompanyUpdateInput;
  pendenteValidacao: boolean;
} {
  const isConfirmado = dto.statusValidacao === "confirmado";
  const isProvavel = dto.statusValidacao === "provavel";
  const pendenteValidacao = !isConfirmado && !isProvavel;
  const origemCoordenada =
    dto.origemCoordenada || (isConfirmado ? "google_maps" : "sem_coordenada");
  const updateData: Prisma.CompanyUpdateInput = {
    statusValidacao: dto.statusValidacao,
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

  const hasCoordinates =
    dto.latitude !== undefined &&
    dto.longitude !== undefined &&
    dto.latitude !== 0 &&
    dto.longitude !== 0;
  if (hasCoordinates) {
    updateData.latitude = dto.latitude;
    updateData.longitude = dto.longitude;
    updateData.origemCoordenada = origemCoordenada;
  }
  if (hasCoordinates && (isConfirmado || isProvavel)) {
    updateData.latitudeVerificada = dto.latitude;
    updateData.longitudeVerificada = dto.longitude;
    updateData.statusVerificacaoEndereco = isConfirmado ? "verificado" : "provavel";
    updateData.confiancaVerificacao = isConfirmado ? 100 : 80;
  }
  if (dto.enderecoVerificado) updateData.enderecoVerificado = dto.enderecoVerificado;

  return { updateData, pendenteValidacao };
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
      string[] | undefined;
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

    return this.getDetails(id);
  }

  async validateLocation(id: string, dto: ValidateLocationDto) {
    const company = await this.prisma.company.findUnique({
      where: { id },
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
