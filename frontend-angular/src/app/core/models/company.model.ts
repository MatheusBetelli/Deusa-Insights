export interface CompanyCnae {
  id: string;
  companyId: string;
  cnaeCode: string;
  isPrimary: boolean;
}

export interface Company {
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
  telefone?: string | null;
  email?: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  cnaes?: CompanyCnae[];
  origemCoordenada?: string | null;
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
  enderecoCompleto?: boolean;
  pendenteValidacao?: boolean;
  motivosPendencia?: string[] | null;
  pontuacaoOportunidade?: number;
  nivelOportunidade?: string | null;
  motivoPontuacao?: string[] | null;
}
