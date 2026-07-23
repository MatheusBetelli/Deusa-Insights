import type {
  LocationOrigin,
  OpportunityLevel,
  ValidationStatus,
} from "@/constants/mapValidation.constants";

export type MapOpportunity = {
  id: string;
  cnpj: string;
  cnpjFormatado: string;
  nomeFantasia: string | null;
  razaoSocial: string;
  cnaePrincipal: string | null;
  enderecoCompleto: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string;
  estado: string;
  cep: string | null;
  telefone: string | null;
  latitude: number;
  longitude: number;
  pontuacaoOportunidade: number;
  nivelOportunidade: OpportunityLevel;
  confiancaVerificacao: number;
  statusVerificacaoEndereco: string;
  statusValidacao: ValidationStatus;
  origemCoordenada: LocationOrigin;
  validadoManualmente: boolean;
  dataUltimaValidacao?: string | null;
  observacaoValidacao?: string | null;
  fonteConsultada?: string | null;
  urlEvidencia?: string | null;
  nomeEncontrado?: string | null;
  enderecoEncontrado?: string | null;
  telefoneEncontrado?: string | null;
  categoriaEncontrada?: string | null;
  situacaoAparente?: string | null;
  justificativaDecisao?: string | null;
};

export type PendingLocation = {
  id: string;
  cnpj: string;
  cnpjFormatado: string;
  nomeFantasia: string | null;
  razaoSocial: string;
  cnaePrincipal: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string;
  estado: string;
  cep: string | null;
  telefone: string | null;
  statusValidacao: ValidationStatus;
  motivosPendencia: string[];
  origemCoordenada: LocationOrigin;
  pontuacaoOportunidade: number;
  nivelOportunidade: OpportunityLevel;
  confiancaVerificacao: number;
  statusVerificacaoEndereco: string;
  validadoManualmente: boolean;
  dataUltimaValidacao?: string | null;
  observacaoValidacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fonteConsultada?: string | null;
  urlEvidencia?: string | null;
  nomeEncontrado?: string | null;
  enderecoEncontrado?: string | null;
  telefoneEncontrado?: string | null;
  categoriaEncontrada?: string | null;
  situacaoAparente?: string | null;
  justificativaDecisao?: string | null;
};

export type ValidateLocationPayload = {
  latitude?: number;
  longitude?: number;
  statusValidacao: ValidationStatus | string;
  origemCoordenada?: LocationOrigin | string;
  enderecoVerificado?: string;
  observacaoValidacao?: string;
  fonteConsultada?: string;
  urlEvidencia?: string;
  placeId?: string;
  nomeEncontrado?: string;
  enderecoEncontrado?: string;
  telefoneEncontrado?: string;
  categoriaEncontrada?: string;
  situacaoAparente?: string;
  distanciaAproximadaMeters?: number;
  justificativaDecisao?: string;
  nomeResponsavelVisita?: string;
  dataVisita?: string;
  evidenciaVisita?: string;
};

export type MapFiltersParams = {
  cnae?: string;
  municipio?: string;
  estado?: string;
  statusValidacao?: string;
  nivelOportunidade?: string;
  confiancaMinima?: number;
  possuiCoordenada?: boolean;
  cnpj?: string;
  search?: string;
};

// ─── Mapa de Calor Regional ────────────────────────────────────────────────────
// Tipo retornado pelo endpoint GET /map/heatmap
// Agrupado por município — empresas ATIVAS da Receita Federal, sem validação manual
export type HeatmapPoint = {
  municipio: string;          // Nome do município
  uf: string;                 // Sigla do estado (ex: "SP")
  latitude: number;           // Centroide do município
  longitude: number;          // Centroide do município
  quantidadeEmpresas: number; // Empresas ATIVAS únicas (COUNT DISTINCT CNPJ)
  intensidade: number;        // 0.1 – 1.0, normalizado pelo máximo regional
};
