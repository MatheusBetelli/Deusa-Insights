import type { Company } from "./company";

type ImportStatus = "PENDING" | "RUNNING" | "SUCCESS" | "ERROR";

export type ImportJob = {
  id: string;
  uf: string;
  cityName: string;
  cityIbgeCode: string | null;
  cnaeCode: string;
  status: ImportStatus;
  totalFound: number;
  totalSaved: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type ImportCnpjPayload = {
  uf: string;
  cityName: string;
  cityIbgeCode?: string;
  cnaeCode: string;
  limit: number;
};

export type ImportCnpjResponse = {
  job: ImportJob;
  companies: Company[];
};

export type ImportExcelClientsResponse = {
  success: boolean;
  totalLinhasProcessadas: number;
  clientesInalterados: number;
  clientesAtualizados: number;
  novosClientesCriados: number;
  clientesMatcheados: number;
  clientesSemEmpresaCorrespondente: number;
  linhasIgnoradas: number;
  motivosIgnoracao: Record<string, number>;
  resumoAbateRegional: Record<
    string,
    {
      clientesAtivos: number;
      prospectsAtivos: number;
      totalMercadosMapeados: number;
      taxaPenetracao: string;
    }
  >;
};
