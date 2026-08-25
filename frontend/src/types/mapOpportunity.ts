import type { LeadStatus, PotentialLevel } from "./lead";

export type MapOpportunity = {
  id: string;
  companyId?: string;
  companyName: string;
  cnpj: string;
  city: string;
  uf: string;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  status: LeadStatus;
  isClient: boolean;
  potentialLevel: PotentialLevel;
  // Rastreabilidade — usado para exibir aviso de localização aproximada no popup
  // "municipio_centroide_jitter" = ponto visual apenas, NÃO é endereço real
  origemCoordenada?: string | null;
  statusVerificacaoEndereco?: string | null;
  confiancaVerificacao?: number | null;
  telefone?: string | null;
  email?: string | null;
  cnaePrincipal?: string | null;
  responsibleName?: string | null;
};
