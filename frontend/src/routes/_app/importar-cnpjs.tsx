import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/InterfaceStates";
import { companyName, formatCnae, formatCnpj, formatDateTime } from "@/lib/commercial-formatters";
import { citiesService } from "@/services/citiesService";
import { cnaesService } from "@/services/cnaesService";
import { importsService } from "@/services/importsService";
import type { City } from "@/types/city";
import type { Cnae } from "@/types/cnae";
import type { Company } from "@/types/company";
import type { ImportJob } from "@/types/importJob";
import { CheckCircle2, FileUp, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AuthService } from "@/lib/auth";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/importar-cnpjs")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const user = AuthService.getUser();
      if (user && user.role?.toUpperCase() !== "ADMIN") {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: ImportCnpjs,
});

function ImportCnpjs() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);
  const [form, setForm] = useState({
    estado: "SP",
    cidade: "Tupã",
    cnae: "4712100",
    limite: "50",
  });

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function loadReferenceData() {
    setError(null);
    try {
      const [cityData, cnaeData, importData] = await Promise.all([
        citiesService.getCities(),
        cnaesService.getCnaes(),
        importsService.getImports(),
      ]);
      setCities(cityData);
      setCnaes(cnaeData);
      setImports(importData);
      if (cityData[0]) setForm((current) => ({ ...current, cidade: current.cidade || cityData[0].name, estado: cityData[0].uf }));
      if (cnaeData[0]) setForm((current) => ({ ...current, cnae: current.cnae || cnaeData[0].code }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar dados de apoio.");
    }
  }

  useEffect(() => {
    loadReferenceData();
  }, []);

  async function handleSearch() {
    setState("loading");
    setError(null);
    try {
      const city = cities.find((item) => item.name === form.cidade);
      const result = await importsService.importCnpjs({
        uf: form.estado,
        cityName: form.cidade,
        cityIbgeCode: city?.ibgeCode ?? undefined,
        cnaeCode: form.cnae,
        limit: Number(form.limite),
      });
      setCompanies(result.companies);
      setLastJob(result.job);
      setState("success");
      toast.success(`${result.job.totalSaved} empresa(s) salvas como leads.`);
      setImports(await importsService.getImports());
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Não foi possível importar CNPJs.");
    }
  }

  const ignored = lastJob ? Math.max(0, lastJob.totalFound - lastJob.totalSaved) : 0;

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">Comercial</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">Importar CNPJs</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Busque empresas ativas e gere leads comerciais.
          </p>
        </div>
      </div>

      {error && state !== "error" && (
        <div className="mb-4">
          <ErrorState description={error} action={<button onClick={loadReferenceData} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">Tentar novamente</button>} />
        </div>
      )}

      {/* ── Search Form ── */}
      <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[110px_minmax(160px,1.2fr)_minmax(220px,1.4fr)_100px_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">UF</span>
            <select value={form.estado} onChange={(event) => updateForm("estado", event.target.value)} className="h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]">
              {Array.from(new Set(cities.map((city) => city.uf))).map((uf) => <option key={uf}>{uf}</option>)}
              {cities.length === 0 && <option>SP</option>}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Cidade</span>
            <select value={form.cidade} onChange={(event) => updateForm("cidade", event.target.value)} className="h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]">
              {cities.map((city) => <option key={city.id}>{city.name}</option>)}
              {cities.length === 0 && <option>Tupã</option>}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">CNAE</span>
            <select value={form.cnae} onChange={(event) => updateForm("cnae", event.target.value)} className="h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]">
              {cnaes.map((cnae) => <option key={cnae.id} value={cnae.code}>{formatCnae(cnae.code)} - {cnae.description}</option>)}
              {cnaes.length === 0 && <option value="4712100">4712-1/00 - Minimercados</option>}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Limite</span>
            <input value={form.limite} onChange={(event) => updateForm("limite", event.target.value)} type="number" min="1" max="5000" className="h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]" />
          </label>
          <button onClick={handleSearch} disabled={state === "loading"} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white transition hover:bg-[#1061AF] disabled:cursor-not-allowed disabled:opacity-70">
            {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-[#FFF200]" />}
            Buscar empresas ativas
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {state === "idle" && <EmptyState title="Nenhuma busca realizada" description="Defina cidade, CNAE e limite para iniciar uma importação." />}
        {state === "loading" && <LoadingState message={`Importando empresas ativas para ${form.cidade}...`} />}
        {state === "error" && <ErrorState title="Não foi possível buscar empresas" description={error ?? "Tente novamente em alguns instantes."} action={<button onClick={handleSearch} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">Tentar novamente</button>} />}

        {state === "success" && lastJob && (
          <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#DDE5EF] px-5 py-3 sm:flex-row sm:items-center sm:justify-between bg-[#F8FAFC]">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F33]">Resultado da importação</h2>
                <p className="text-[11px] text-[#64748B]">{form.cidade}/{form.estado} · {formatCnae(form.cnae)}</p>
              </div>
              <Link to="/leads-b2b" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-bold text-white transition hover:bg-[#1061AF]">
                <CheckCircle2 className="h-4 w-4 text-[#FFF200]" />
                Ver leads
              </Link>
            </div>

            <div className="grid gap-3 border-b border-[#DDE5EF] p-4 sm:grid-cols-3">
              {[
                { label: "Encontrados", value: lastJob.totalFound, accent: "#1061AF" },
                { label: "Salvos", value: lastJob.totalSaved, accent: "#16A34A" },
                { label: "Ignorados", value: ignored, accent: "#64748B" },
              ].map((item) => (
                <div key={item.label} className="relative overflow-hidden rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-4 shadow-sm">
                  <span
                    className="absolute inset-y-0 left-0 w-[3px]"
                    style={{ background: item.accent }}
                  />
                  <div className="pl-1">
                    <div className="text-2xl font-bold text-[#0B1F33] tabular-nums">{item.value.toLocaleString("pt-BR")}</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#64748B]">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {companies.length === 0 ? (
              <EmptyState title="Nenhuma empresa salva" description="A importação foi concluída, mas não retornou novos registros." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B]">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">CNPJ</th>
                      <th className="px-4 py-3">Cidade</th>
                      <th className="px-4 py-3">CNAE</th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {companies.slice(0, 8).map((company) => (
                      <tr key={company.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-bold text-[#0B1F33]">{companyName(company)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#475569]">{formatCnpj(company.cnpj)}</td>
                        <td className="px-4 py-3 text-[#475569]">{company.cidade}</td>
                        <td className="px-4 py-3 text-[#475569]">{formatCnae(company.cnaePrincipal)}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{company.situacaoCadastral}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0B1F33]">Histórico recente</h2>
          <FileUp className="h-5 w-5 text-[#1061AF]" />
        </div>
        {imports.length === 0 ? (
          <p className="text-sm text-[#64748B]">Nenhuma importação registrada.</p>
        ) : (
          <div className="grid gap-3">
            {imports.slice(0, 5).map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] px-4 py-3">
                <div>
                  <div className="font-semibold text-[#0B1F33]">{job.cityName}/{job.uf} · {formatCnae(job.cnaeCode)}</div>
                  <div className="text-xs text-[#64748B]">{formatDateTime(job.createdAt)}</div>
                </div>
                <div className="text-right text-sm font-bold text-[#0B1F33]">{job.totalSaved} salvos · {job.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
