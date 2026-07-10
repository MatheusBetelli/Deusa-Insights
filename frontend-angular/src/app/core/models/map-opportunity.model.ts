import { LeadStatus, PotentialLevel } from "./lead.model";

export interface MapOpportunity {
  id: string;
  companyName: string;
  cnpj: string;
  city: string;
  uf: string;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  status: LeadStatus;
  potentialLevel: PotentialLevel;
  origemCoordenada?: string | null;
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
  situacaoCadastral?: string | null;
  nivelOportunidade?: string | null;
  pontuacaoOportunidade?: number | null;
  pendenteValidacao?: boolean;
}
