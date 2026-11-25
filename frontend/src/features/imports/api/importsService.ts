import { apiRequest } from "@/services/api";
import type { ImportExcelClientsResponse, ImportJob } from "@/features/imports/types/importJob";

export const importsService = {
  getImports: () => apiRequest<ImportJob[]>("/imports"),
  getImport: (id: string) => apiRequest<ImportJob>(`/imports/${id}`),
  uploadExcelClients: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<ImportExcelClientsResponse>("/imports/excel-clients", {
      method: "POST",
      body: formData,
      // O navegador define automaticamente o Content-Type multipart/form-data com o boundary correto
      headers: {},
    });
  },
};
