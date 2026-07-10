export type CnpjSearchPayload = {
  uf: string;
  cityName: string;
  cityIbgeCode?: string;
  cnaeCode: string;
  limit: number;
};

export type ExternalCompany = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  situacaoCadastral: string;
  porte?: string | null;
  matrizFilial?: string | null;
  dataAbertura?: Date | null;
  cnaePrincipal?: string | null;
  cnaes?: string[];
  uf: string;
  cidade: string;
  bairro?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  // Contato (mapeado das colunas ddd_1+telefone_1 e correio_eletronico do CSV da Receita Federal)
  telefone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: string;
  // ─── Rastreabilidade de Coordenadas ───────────────────────────────────────
  // origemCoordenada "municipio_centroide_jitter" = recurso visual APENAS.
  // NÃO representa o endereço físico exato do estabelecimento.
  origemCoordenada?: string | null;
  // statusVerificacaoEndereco: "aproximado" | "nao_verificado" | "confiavel_cadastralmente"
  //                          | "verificado" | "divergente" | "nao_encontrado"
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
  // ─── Qualidade Cadastral ──────────────────────────────────────────────────
  enderecoCompleto?: boolean;
  pendenteValidacao?: boolean;
  motivosPendencia?: string[];
  // ─── Pontuação Comercial ──────────────────────────────────────────────────
  pontuacaoOportunidade?: number;
  nivelOportunidade?: string | null;
  motivoPontuacao?: string[];
};

export interface CnpjProvider {
  searchCompaniesByCityAndCnae(payload: CnpjSearchPayload): Promise<ExternalCompany[]>;
  getCompanyByCnpj(cnpj: string): Promise<ExternalCompany | null>;
}

export const CNPJ_PROVIDER = Symbol("CNPJ_PROVIDER");
