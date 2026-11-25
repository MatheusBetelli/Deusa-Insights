import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { formatCnae, formatDateTime } from "@/lib/commercial-formatters";
import { importsService } from "@/features/imports/api/importsService";
import type { ImportExcelClientsResponse, ImportJob } from "@/features/imports/types/importJob";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, FileUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const jobStatusLabels: Record<string, { label: string; class: string }> = {
  SUCCESS: { label: "Concluído", class: "text-emerald-700 font-bold" },
  COMPLETED: { label: "Concluído", class: "text-emerald-700 font-bold" },
  RUNNING: { label: "Em processamento", class: "text-[#1061AF] font-bold" },
  PROCESSING: { label: "Em processamento", class: "text-[#1061AF] font-bold" },
  PENDING: { label: "Aguardando", class: "text-slate-600 font-bold" },
  PARCIAL: { label: "Concluído parcialmente", class: "text-amber-700 font-bold" },
  FAILED: { label: "Erro", class: "text-red-700 font-bold" },
  ERROR: { label: "Erro", class: "text-red-700 font-bold" },
};

function formatJobStatus(status: string) {
  const normalized = (status || "").toUpperCase();
  return jobStatusLabels[normalized] ?? { label: status, class: "text-[#0B1F33] font-bold" };
}

export function ImportCnpjs() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [excelResult, setExcelResult] = useState<ImportExcelClientsResponse | null>(null);
  async function loadReferenceData() {
    setError(null);
    try {
      setImports(await importsService.getImports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar dados de apoio.");
    }
  }

  useEffect(() => {
    loadReferenceData();
  }, []);

  async function handleExcelUpload(file: File) {
    if (!file) return;
    setState("loading");
    setError(null);
    try {
      const result = await importsService.uploadExcelClients(file);
      setExcelResult(result);
      setState("success");
      toast.success(
        `Planilha processada com sucesso! ${result.clientesInalterados ?? 0} inalterados (dados idênticos), ${result.clientesAtualizados ?? 0} atualizados e ${result.novosClientesCriados ?? 0} novos cadastrados.`,
      );
      setImports(await importsService.getImports());
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Não foi possível processar a planilha Excel.");
    }
  }

  return (
    <div className="space-y-5">
      {error && state !== "error" && (
        <div className="mb-4">
          <ErrorState
            description={error}
            action={
              <button
                onClick={loadReferenceData}
                className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
              >
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      <section className="rounded-xl border border-[#DDE5EF] bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center transition hover:border-[#1061AF]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1061AF]">
            <FileUp className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-[#0B1F33]">
            Importar Planilha de Clientes (.xlsx, .csv)
          </h3>
          <p className="mt-1 max-w-md text-xs text-[#64748B]">
            Selecione o arquivo Excel com a lista de clientes atuais da empresa. O sistema fará a
            correspondência automática por CNPJ exato e atualizará os marcadores do Mapa de
            Oportunidades.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0B1F33] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1061AF]">
            <FileUp className="h-4 w-4 text-[#FFF200]" />
            Selecionar Planilha Excel
            <input
              type="file"
              accept=".xlsx, .csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleExcelUpload(file);
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        {state === "idle" && (
          <EmptyState
            title="Nenhuma operação realizada"
            description="Envie uma planilha Excel para iniciar."
          />
        )}
        {state === "loading" && <LoadingState message="Processando dados da importação..." />}
        {state === "error" && (
          <ErrorState
            title="Erro na operação"
            description={error ?? "Tente novamente em alguns instantes."}
          />
        )}

        {state === "success" && excelResult && (
          <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#DDE5EF] px-5 py-3 sm:flex-row sm:items-center sm:justify-between bg-[#F8FAFC]">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F33]">
                  Resultado do Processamento da Planilha
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Planilha enviada e salva com sucesso no banco de dados
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/funil-comercial"
                  search={{
                    search: "",
                    uf: "Todos",
                    city: "Todas",
                    cnae: "Todos",
                    period: "current_month",
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                    assignedToId: "Todos",
                  }}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
                >
                  Ver no Funil (Convertidos)
                </Link>
                <Link
                  to="/mapa-oportunidades"
                  search={{ uf: "Todos", city: "Todas" }}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white transition hover:bg-[#1061AF]"
                >
                  <CheckCircle2 className="h-4 w-4 text-[#FFF200]" />
                  Ver no mapa
                </Link>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-4 shadow-xs">
                <span className="absolute inset-y-0 left-0 w-[3px] bg-[#1061AF]" />
                <div className="pl-1">
                  <div className="text-2xl font-bold text-[#0B1F33] tabular-nums">
                    {excelResult.totalLinhasProcessadas}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[#64748B]">
                    Linhas Processadas
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-[#DDE5EF] bg-emerald-50/70 p-4 shadow-xs">
                <span className="absolute inset-y-0 left-0 w-[3px] bg-[#16A34A]" />
                <div className="pl-1">
                  <div className="text-2xl font-bold text-[#16A34A] tabular-nums">
                    {excelResult.clientesMatcheados}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[#16A34A]">
                    Clientes Mapeados (Existentes)
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-[#DDE5EF] bg-blue-50/70 p-4 shadow-xs">
                <span className="absolute inset-y-0 left-0 w-[3px] bg-[#1061AF]" />
                <div className="pl-1">
                  <div className="text-2xl font-bold text-[#1061AF] tabular-nums">
                    {excelResult.novosClientesCriados}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[#1061AF]">
                    Novos Clientes Cadastrados
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0B1F33]">Histórico recente</h2>
        </div>
        {imports.length === 0 ? (
          <p className="text-sm text-[#64748B]">Nenhuma importação registrada.</p>
        ) : (
          <div className="grid gap-3">
            {imports.slice(0, 5).map((job) => {
              const statusInfo = formatJobStatus(job.status);
              return (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-4 py-3 transition hover:border-[#1061AF]"
                >
                  <div>
                    <div className="text-xs font-bold text-[#0B1F33]">
                      {job.cityName}/{job.uf} · {formatCnae(job.cnaeCode)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                      {formatDateTime(job.createdAt)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-bold text-[#0B1F33]">
                      {job.totalSaved} empresas importadas
                    </span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className={statusInfo.class}>{statusInfo.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
