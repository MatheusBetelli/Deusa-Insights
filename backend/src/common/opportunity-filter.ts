import { isNonFoodBusiness } from "./non-food-filter";

/**
 * Regra centralizada de qualificação de Oportunidades Comerciais (Deusa Insights)
 *
 * Um estabelecimento é considerado uma OPORTUNIDADE COMERCIAL válida se e somente se:
 *  1. Sua categoria pertence EXCLUSIVAMENTE a:
 *     - Minimercados (CNAE 4712100)
 *     - Supermercados (CNAE 4711302)
 *     - Hipermercados (CNAE 4711301)
 *     - Mercearias / revenda (CNAE 4721102)
 *     - Açougues (CNAE 4722901)
 *  2. Não é uma propriedade rural (fazenda, sítio, estância, chácara, etc.).
 *  3. Está localizado dentro da área urbana da cidade analisada (raio geodésico em relação ao centroide IBGE).
 *  4. Situação cadastral é ATIVA.
 */

export const TARGET_OPPORTUNITY_CNAES = new Set<string>([
  "4711301", // Hipermercados 🏬
  "4711302", // Supermercados 🛒
  "4712100", // Minimercados / Mercados 🏪
  "4721102", // Mercearias / revenda de panificados 🥖
  "4722901", // Açougues 🥩
]);

// Tabela de centroides municipais (IBGE / OpenStreetMap)
export const IBGE_CENTROIDES: Record<string, { lat: number; lon: number }> = {
  "tupã|sp": { lat: -21.9347, lon: -50.5136 },
  "tupa|sp": { lat: -21.9347, lon: -50.5136 },
  "presidente prudente|sp": { lat: -22.1208, lon: -51.3882 },
  "pompeia|sp": { lat: -22.1085, lon: -50.1749 },
  "pompéia|sp": { lat: -22.1085, lon: -50.1749 },
  "araçatuba|sp": { lat: -21.2094, lon: -50.4384 },
  "aracatuba|sp": { lat: -21.2094, lon: -50.4384 },
  "marília|sp": { lat: -22.2139, lon: -49.9467 },
  "marilia|sp": { lat: -22.2139, lon: -49.9467 },
  "garça|sp": { lat: -22.2131, lon: -49.6553 },
  "garca|sp": { lat: -22.2131, lon: -49.6553 },
  "quintana|sp": { lat: -22.0722, lon: -50.3125 },
  "vera cruz|sp": { lat: -22.2225, lon: -49.8211 },
  "oriente|sp": { lat: -22.1558, lon: -49.9961 },
  "echaporã|sp": { lat: -22.4294, lon: -50.2106 },
  "echapora|sp": { lat: -22.4294, lon: -50.2106 },
  "herculândia|sp": { lat: -21.9744, lon: -50.3806 },
  "herculandia|sp": { lat: -21.9744, lon: -50.3806 },
  "iacri|sp": { lat: -21.8586, lon: -50.6881 },
  "parapuã|sp": { lat: -21.7778, lon: -50.8447 },
  "parapua|sp": { lat: -21.7778, lon: -50.8447 },
  "rinópolis|sp": { lat: -21.7247, lon: -50.7192 },
  "rinopolis|sp": { lat: -21.7247, lon: -50.7192 },
  "gália|sp": { lat: -22.2889, lon: -49.5544 },
  "galia|sp": { lat: -22.2889, lon: -49.5544 },
  "bastos|sp": { lat: -21.9235, lon: -50.7256 },
  "adamantina|sp": { lat: -21.6859, lon: -51.0735 },
  "lucélia|sp": { lat: -21.7199, lon: -51.0181 },
  "lucelia|sp": { lat: -21.7199, lon: -51.0181 },
  "osvaldo cruz|sp": { lat: -21.7946, lon: -50.8795 },
  "dracena|sp": { lat: -21.4828, lon: -51.5322 },
  "assis|sp": { lat: -22.6628, lon: -50.4124 },
  "ourinhos|sp": { lat: -22.9789, lon: -49.8701 },
  "lins|sp": { lat: -21.6786, lon: -49.7503 },
  "bauru|sp": { lat: -22.3246, lon: -49.0959 },
  "botucatu|sp": { lat: -22.8851, lon: -48.4454 },
  "são paulo|sp": { lat: -23.5505, lon: -46.6333 },
  "sao paulo|sp": { lat: -23.5505, lon: -46.6333 },
  "campinas|sp": { lat: -22.9099, lon: -47.0626 },
  "ribeirão preto|sp": { lat: -21.1784, lon: -47.8063 },
  "ribeirao preto|sp": { lat: -21.1784, lon: -47.8063 },
  "franca|sp": { lat: -20.5386, lon: -47.4008 },
};

// Cidades de grande porte onde o raio de expansão urbana é maior (15 km)
const LARGE_CITIES_SET = new Set<string>([
  "marilia",
  "marília",
  "bauru",
  "ribeirao preto",
  "ribeirão preto",
  "franca",
  "presidente prudente",
  "assis",
  "aracatuba",
  "araçatuba",
  "sao paulo",
  "são paulo",
  "campinas",
]);

// Palavras-chave que desqualificam um estabelecimento quando são estritamente rurais ou não-comerciais (pet shop, tabacaria, etc.)
const STRICT_RURAL_OR_NON_COMMERCIAL_PATTERNS = [
  /\b(fazenda|sitio|sítio|estancia|estância|chacara|chácara|haras|rancho|gleba|assentamento|tabacaria)\b/i,
  /\b(estrada|zona|area|área)\s+rural\b/i,
  /\bpet\s+shop\b/i,
  /\bcasa\s+de\s+ração\b/i,
];

/**
 * Normaliza o código CNAE para conter apenas os 7 dígitos numéricos
 */
function normalizeCnaeCode(code?: string | null): string {
  return code ? code.replace(/\D/g, "") : "";
}

/**
 * Formata um código CNAE de 7 dígitos para a máscara XXXX-X/XX
 */
function formatCnaeCode(code?: string | null): string {
  const digits = normalizeCnaeCode(code);
  if (digits.length !== 7) return code ?? "";
  return digits.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3");
}

/**
 * Retorna as variantes numéricas (ex: 4711302) e formatadas (ex: 4711-3/02) de um código CNAE
 */
export function getCnaeVariants(code?: string | null): string[] {
  if (!code || code === "Todos") return [];
  const digits = normalizeCnaeCode(code);
  if (!digits) return [];
  const formatted = formatCnaeCode(digits);
  const set = new Set<string>([digits]);
  if (formatted) set.add(formatted);
  return Array.from(set);
}

/**
 * Retorna todas as variantes numéricas e formatadas dos CNAEs de oportunidade da Deusa Alimentos
 */
function getAllTargetCnaeVariants(): string[] {
  const set = new Set<string>();
  for (const cnae of TARGET_OPPORTUNITY_CNAES) {
    const digits = normalizeCnaeCode(cnae);
    if (digits) {
      set.add(digits);
      const formatted = formatCnaeCode(digits);
      if (formatted) set.add(formatted);
    }
  }
  return Array.from(set);
}

/**
 * Constrói a cláusula `where` do Prisma para empresas com suporte a filtro CNAE flexível
 */
export function buildCnaeWhereInput(code?: string | null) {
  const variants = getCnaeVariants(code);
  if (variants.length > 0) {
    return {
      OR: [
        { cnaePrincipal: { in: variants } },
        { cnaes: { some: { cnaeCode: { in: variants } } } },
        { clientAccounts: { some: { isCurrentClient: true } } },
      ],
    };
  }
  return {
    OR: [
      { cnaePrincipal: { in: getAllTargetCnaeVariants() } },
      { cnaes: { some: { cnaeCode: { in: getAllTargetCnaeVariants() } } } },
      { clientAccounts: { some: { isCurrentClient: true } } },
    ],
  };
}

/**
 * Verifica se um código CNAE pertence às categorias de oportunidade comercial autorizadas
 */
export function isValidOpportunityCnae(code?: string | null): boolean {
  const norm = normalizeCnaeCode(code);
  return TARGET_OPPORTUNITY_CNAES.has(norm);
}

/**
 * Verifica se o nome ou endereço da empresa indica propriedade rural ou ramo totalmente alheio (pet shop, etc.)
 */
export function isRuralOrNonCommercialLocation(company: {
  nomeFantasia?: string | null;
  razaoSocial?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  cnaePrincipal?: string | null;
  categoriaEncontrada?: string | null;
}): boolean {
  const name = [company.nomeFantasia, company.razaoSocial].filter(Boolean).join(" ");
  const address = [company.logradouro, company.bairro, company.complemento].filter(Boolean).join(" ");
  const combined = `${name} ${address}`;

  // Se o nome indica expressamente ser um supermercado, minimercado, açougue ou mercearia, preserva
  if (/supermercado|minimercado|açougue|acougue|mercearia/i.test(name)) {
    return false;
  }

  // 1. Verifica se a categoria do Google indica ramo totalmente alheio (lojas de roupas, ferragens, construçao, pet shop, etc.)
  const catFound = (company.categoriaEncontrada || "").toLowerCase().trim();
  if (
    catFound &&
    [
      "clothing_store",
      "womens_clothing_store",
      "men_clothing_store",
      "shoe_store",
      "building_materials_store",
      "hardware_store",
      "electronics_store",
      "home_goods_store",
      "furniture_store",
      "car_repair",
      "car_dealer",
      "pharmacy",
      "drugstore",
      "beauty_salon",
      "hair_care",
      "spa",
      "gym",
      "veterinary_care",
      "pet_store",
      "laundry",
      "bank",
      "atm",
      "accounting",
      "lawyer",
      "real_estate_agency",
      "travel_agency",
      "insurance_agency",
      "night_club",
      "bar",
      "ranch",
      "health_food_store",
      "pastry_shop",
      "ice_cream_shop",
      "coffee_shop",
    ].includes(catFound)
  ) {
    return true;
  }

  // 2. Se o nome contém termos não-alimentícios
  if (isNonFoodBusiness(combined)) {
    return true;
  }

  // 3. Se tem termos estritamente rurais ou de pet shop/tabacaria
  if (STRICT_RURAL_OR_NON_COMMERCIAL_PATTERNS.some((pattern) => pattern.test(combined))) {
    return true;
  }

  return false;
}

/**
 * Calcula a distância em quilômetros entre duas coordenadas (Haversine)
 */
function calculateGeodesicDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Raio terrestre em km
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

/**
 * Verifica se as coordenadas geográficas estão dentro do perímetro urbano da cidade
 */
export function isWithinUrbanTerritory(
  cidade?: string | null,
  lat?: number | null,
  lng?: number | null,
  uf?: string | null,
): boolean {
  if (!cidade) return true; // Se não tem cidade informada, não bloqueia por geofence
  if (typeof lat !== "number" || typeof lng !== "number" || lat === 0 || lng === 0) {
    return true; // Se não tem coordenadas válidas, a decisão fica a cargo da cidade e do filtro rural
  }

  const ufNorm = (uf || "SP").toLowerCase().trim();
  const cidadeClean = cidade.trim();
  const cidadeNorm = cidadeClean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const key = `${cidadeClean.toLowerCase()}|${ufNorm}`;
  const keyNorm = `${cidadeNorm}|${ufNorm}`;

  const centroid = IBGE_CENTROIDES[key] || IBGE_CENTROIDES[keyNorm];
  if (!centroid) return true; // Cidade não catalogada na tabela de centroides

  const distKm = calculateGeodesicDistanceKm(lat, lng, centroid.lat, centroid.lon);
  const maxRadiusKm = LARGE_CITIES_SET.has(cidadeNorm) ? 15.0 : 10.0;

  return distKm <= maxRadiusKm;
}

/**
 * Validação completa se uma empresa é uma OPORTUNIDADE COMERCIAL válida
 */
export function isValidOpportunity(company: {
  situacaoCadastral?: string | null;
  cnaePrincipal?: string | null;
  cnaes?: Array<{ cnaeCode?: string | null }> | null;
  clientAccounts?: Array<{ isCurrentClient?: boolean }> | null;
  isClient?: boolean;
  cidade?: string | null;
  uf?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  nomeFantasia?: string | null;
  razaoSocial?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  categoriaEncontrada?: string | null;
}): boolean {
  // 0. Se é cliente ativo da Deusa Alimentos, é SEMPRE um pino válido no mapa
  if (company.isClient || company.clientAccounts?.some((ca) => ca.isCurrentClient)) {
    return true;
  }

  // 1. Situação cadastral deve ser ATIVA
  const status = (company.situacaoCadastral || "").toUpperCase().trim();
  if (status !== "ATIVA" && status !== "ATIVO") {
    return false;
  }

  // 2. Categoria (CNAE principal ou secundário) deve pertencer ao escopo autorizado
  const hasTargetCnae =
    isValidOpportunityCnae(company.cnaePrincipal) ||
    Boolean(company.cnaes?.some((item) => isValidOpportunityCnae(item.cnaeCode)));
  if (!hasTargetCnae) {
    return false;
  }

  // 3. Não pode ser propriedade rural (fazenda, sítio, estância, etc.) nem comércio alheio (roupas, calçados, oficinas, suplementos, etc.)
  if (isRuralOrNonCommercialLocation(company)) {
    return false;
  }

  // 4. Deve estar dentro do perímetro urbano da cidade (geofence)
  if (!isWithinUrbanTerritory(company.cidade, company.latitude, company.longitude, company.uf)) {
    return false;
  }

  return true;
}
