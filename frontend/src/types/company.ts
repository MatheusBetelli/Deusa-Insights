export type CompanyCnae = {
  id: string;
  companyId: string;
  cnaeCode: string;
  isPrimary: boolean;
};

export type Company = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  porte: string | null;
  matrizFilial: string | null;
  dataAbertura: string | null;
  cnaePrincipal: string | null;
  uf: string;
  cidade: string;
  bairro: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  // Contato (mapeado do CSV da Receita Federal)
  telefone?: string | null;
  email?: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  cnaes?: CompanyCnae[];
  // ─── Rastreabilidade de Coordenadas ───────────────────────────────
  // "municipio_centroide_jitter" = ponto visual apenas, NÃO é endereço real
  origemCoordenada?: string | null;
  // "aproximado" | "nao_verificado" | "confiavel_cadastralmente" | "verificado" | ...
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
  // ─── Qualidade Cadastral ───────────────────────────────────────────────
  enderecoCompleto?: boolean;
  pendenteValidacao?: boolean;
  motivosPendencia?: string[] | null;
  // ─── Pontuação Comercial ─────────────────────────────────────────────────
  pontuacaoOportunidade?: number;
  nivelOportunidade?: string | null; // "alta" | "media" | "baixa"
  motivoPontuacao?: string[] | null;
};

export type CompanyQuery = {
  city?: string;
  uf?: string;
  cnae?: string;
  situacaoCadastral?: string;
  search?: string;
};
