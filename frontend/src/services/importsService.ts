import { apiRequest } from "./api";
import type { ImportCnpjPayload, ImportCnpjResponse, ImportJob } from "@/types/importJob";

export const importsService = {
  importCnpjs: (payload: ImportCnpjPayload) =>
    apiRequest<ImportCnpjResponse>("/imports/cnpj", { method: "POST", body: JSON.stringify(payload) }),
  getImports: () => apiRequest<ImportJob[]>("/imports"),
  getImport: (id: string) => apiRequest<ImportJob>(`/imports/${id}`),
  uploadExcelClients: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<any>("/imports/excel-clients", {
      method: "POST",
      body: formData,
      // O navegador define automaticamente o Content-Type multipart/form-data com o boundary correto
      headers: {},
    });
  },
};
