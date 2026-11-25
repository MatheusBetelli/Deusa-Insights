import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { UpdateCompanyLocationDto } from "../dto/update-company-location.dto";
import { ValidateLocationDto } from "../dto/validate-location.dto";
export function assertManualLocationCoordinates(dto: UpdateCompanyLocationDto): void {
  if (
    !Number.isFinite(dto.latitude) ||
    !Number.isFinite(dto.longitude) ||
    dto.latitude < -90 ||
    dto.latitude > 90 ||
    dto.longitude < -180 ||
    dto.longitude > 180
  ) {
    throw new BadRequestException("Latitude ou longitude inválida.");
  }
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

export type GooglePlacePayload = {
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

export type LocationCandidate = {
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

export type LocationCandidateCompany = {
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

export function assertCoordinatePair(dto: ValidateLocationDto): void {
  const hasLatitude = dto.latitude !== undefined;
  const hasLongitude = dto.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    throw new BadRequestException("Latitude e longitude devem ser informadas em conjunto.");
  }
}

export function assertConfirmedLocation(situacaoCadastral: string, dto: ValidateLocationDto): void {
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

export async function searchGooglePlaces(
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

export function buildLocationCandidate(
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

export function buildLocationValidationUpdate(dto: ValidateLocationDto): {
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
