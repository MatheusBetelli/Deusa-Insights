import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { PaginationBar } from "@/components/common/PaginationBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { companyName, formatCnae, formatCnpj } from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { citiesService } from "@/services/citiesService";
import { cnaesService } from "@/services/cnaesService";
import { companiesService } from "@/services/companiesService";
import type { City } from "@/types/city";
import type { Cnae } from "@/types/cnae";
import type { Company, CompanyQuery } from "@/types/company";
import type { PaginatedResponse } from "@/types/pagination";
import { ArrowRight, FileUp, Search } from "lucide-react";

import { AuthService } from "@/lib/auth";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/base-de-dados")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const user = AuthService.getUser();
      if (user && user.role?.toUpperCase() === "SALES") {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: BaseDeDados,
});

type Tab = "companies" | "cities" | "cnaes";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 20;
const tabs: { id: Tab; label: string }[] = [
  { id: "companies", label: "Empresas" },
  { id: "cities", label: "Cidades" },
  { id: "cnaes", label: "CNAEs" },
];

function emptyPage<T>(): PaginatedResponse<T> {
  return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };
}

function BaseDeDados() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("companies");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [companySortBy, setCompanySortBy] =
    useState<NonNullable<CompanyQuery["sortBy"]>>("company");
  const [citySortBy, setCitySortBy] = useState<"name" | "uf" | "companyCount">("name");
  const [cnaeSortBy, setCnaeSortBy] = useState<
    "code" | "description" | "category" | "companyCount"
  >("code");
  const [uf, setUf] = useState("Todos");
  const [companyCity, setCompanyCity] = useState<string | undefined>();
  const [companyCnae, setCompanyCnae] = useState<string | undefined>();
  const [companies, setCompanies] = useState<PaginatedResponse<Company>>(emptyPage);
  const [cities, setCities] = useState<PaginatedResponse<City>>(emptyPage);
  const [cnaes, setCnaes] = useState<PaginatedResponse<Cnae>>(emptyPage);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTotal =
    activeTab === "companies"
      ? companies.total
      : activeTab === "cities"
        ? cities.total
        : cnaes.total;

  const currentPage =
    activeTab === "companies" ? companies.page : activeTab === "cities" ? cities.page : cnaes.page;
  const currentTotalPages =
    activeTab === "companies"
      ? companies.totalPages
      : activeTab === "cities"
        ? cities.totalPages
        : cnaes.totalPages;

  const activeSort = useMemo(() => {
    if (activeTab === "companies") return companySortBy;
    if (activeTab === "cities") return citySortBy;
    return cnaeSortBy;
  }, [activeTab, citySortBy, cnaeSortBy, companySortBy]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "companies") {
        setCompanies(
          await companiesService.getCompaniesPage({
            page,
            pageSize: PAGE_SIZE,
            search,
            uf: uf !== "Todos" ? uf : undefined,
            city: companyCity,
            cnae: companyCnae,
            sortBy: companySortBy,
            sortOrder,
          }),
        );
      }
      if (activeTab === "cities") {
        setCities(
          await citiesService.getCitiesPage({
            page,
            pageSize: PAGE_SIZE,
            search,
            uf: uf !== "Todos" ? uf : undefined,
            sortBy: citySortBy,
            sortOrder,
          }),
        );
      }
      if (activeTab === "cnaes") {
        setCnaes(
          await cnaesService.getCnaesPage({
            page,
            pageSize: PAGE_SIZE,
            search,
            uf: uf !== "Todos" ? uf : undefined,
            sortBy: cnaeSortBy,
            sortOrder,
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a base de dados.");
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    citySortBy,
    cnaeSortBy,
    companyCity,
    companyCnae,
    companySortBy,
    page,
    search,
    sortOrder,
    uf,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  function changeTab(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
    setUf("Todos");
    setCompanyCity(undefined);
    setCompanyCnae(undefined);
  }

  function toggleCompanySort(sortBy: NonNullable<CompanyQuery["sortBy"]>) {
    if (companySortBy === sortBy) setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setCompanySortBy(sortBy);
      setSortOrder("asc");
    }
  }

  function openCompaniesByCity(city: City) {
    navigate({ to: "/leads-b2b", search: { city: city.name } });
  }

  function openCompaniesByCnae(cnae: Cnae) {
    setActiveTab("companies");
    setCompanyCnae(cnae.code);
    setSearch("");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">Dados</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">Base de Dados</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Consulte empresas, cidades e CNAEs monitorados.
          </p>
        </div>
        <Link
          to="/importar-cnpjs"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-sm font-bold text-white transition hover:bg-[#1061AF]"
        >
          <FileUp className="h-4 w-4 text-[#FFF200]" />
          Atualizar base
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#DDE5EF] bg-[#F8FAFC] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`h-8 rounded-lg px-3.5 text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-[#0B1F33] text-white"
                    : "border border-[#DDE5EF] bg-white text-[#0B1F33] hover:border-[#1061AF]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <select
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option value="Todos">Todos (UF)</option>
              {ESTADOS_UF.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            <label className="relative block w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar na base..."
                className="h-9 w-full rounded-lg border border-[#DDE5EF] bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1061AF]"
              />
            </label>
            <button
              onClick={() => setSortOrder((current) => (current === "asc" ? "desc" : "asc"))}
              className="h-9 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] hover:border-[#1061AF]"
            >
              {activeSort} · {sortOrder}
            </button>
          </div>
        </div>

        {companyCity || companyCnae ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#DDE5EF] px-4 py-2 text-xs text-[#64748B]">
            <span className="font-bold uppercase">Filtro de empresas</span>
            {companyCity && (
              <FilterTag
                label="Cidade"
                value={companyCity}
                onClear={() => setCompanyCity(undefined)}
              />
            )}
            {companyCnae && (
              <FilterTag
                label="CNAE"
                value={formatCnae(companyCnae)}
                onClear={() => setCompanyCnae(undefined)}
              />
            )}
          </div>
        ) : null}

        {error && (
          <div className="p-4">
            <ErrorState
              description={error}
              action={
                <button
                  onClick={() => void loadData()}
                  className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
                >
                  Tentar novamente
                </button>
              }
            />
          </div>
        )}

        {loading ? (
          <LoadingState message="Carregando base de dados..." />
        ) : activeTotal === 0 ? (
          <EmptyState
            title="Nenhum registro encontrado"
            description="Ajuste a busca ou os filtros da aba atual."
          />
        ) : (
          <>
            {activeTab === "companies" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B]">
                    <tr>
                      <th className="px-4 py-3">
                        <button
                          onClick={() => toggleCompanySort("company")}
                          className="hover:text-[#0B1F33]"
                        >
                          Empresa
                        </button>
                      </th>
                      <th className="px-4 py-3">CNPJ</th>
                      <th className="px-4 py-3">
                        <button
                          onClick={() => toggleCompanySort("city")}
                          className="hover:text-[#0B1F33]"
                        >
                          Cidade
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          onClick={() => toggleCompanySort("cnae")}
                          className="hover:text-[#0B1F33]"
                        >
                          CNAE
                        </button>
                      </th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {companies.items.map((company) => (
                      <tr key={company.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedCompany(company)}
                            className="font-bold text-[#0B1F33] hover:text-[#1061AF]"
                          >
                            {companyName(company)}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#475569]">
                          {formatCnpj(company.cnpj)}
                        </td>
                        <td className="px-4 py-3 text-[#475569]">
                          <button
                            onClick={() =>
                              navigate({ to: "/leads-b2b", search: { city: company.cidade } })
                            }
                            className="hover:text-[#1061AF]"
                          >
                            {company.cidade}/{company.uf}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[#475569]">
                          {formatCnae(company.cnaePrincipal)}
                        </td>
                        <td className="px-4 py-3">
                          <SituationBadge value={company.situacaoCadastral} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "cities" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B]">
                    <tr>
                      <th className="px-4 py-3">Cidade</th>
                      <th className="px-4 py-3">UF</th>
                      <th className="px-4 py-3">Empresas</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {cities.items.map((city) => (
                      <tr key={city.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-bold text-[#0B1F33]">{city.name}</td>
                        <td className="px-4 py-3 text-[#475569]">{city.uf}</td>
                        <td className="px-4 py-3 font-bold tabular-nums text-[#0B1F33]">
                          {city.companyCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-[#475569]">
                          {city.isActive ? "Ativa" : "Inativa"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openCompaniesByCity(city)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-2.5 text-xs font-bold text-[#0B1F33] hover:border-[#1061AF]"
                            >
                              Leads
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                navigate({ to: "/mapa-oportunidades", search: { uf: "Todos", city: city.name } })
                              }
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-2.5 text-xs font-bold text-[#0B1F33] hover:border-[#1061AF]"
                            >
                              Mapa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "cnaes" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B]">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Empresas</th>
                      <th className="px-4 py-3 text-right">Acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {cnaes.items.map((cnae) => (
                      <tr key={cnae.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-bold text-[#0B1F33]">
                          {formatCnae(cnae.code)}
                        </td>
                        <td className="px-4 py-3 text-[#475569]">{cnae.description}</td>
                        <td className="px-4 py-3 text-[#475569]">{cnae.category ?? "-"}</td>
                        <td className="px-4 py-3 font-bold tabular-nums text-[#0B1F33]">
                          {cnae.companyCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openCompaniesByCnae(cnae)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-2.5 text-xs font-bold text-[#0B1F33] hover:border-[#1061AF]"
                            >
                              Empresas
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                navigate({ to: "/leads-b2b", search: { cnae: cnae.code } })
                              }
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-2.5 text-xs font-bold text-[#0B1F33] hover:border-[#1061AF]"
                            >
                              Leads
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationBar
              page={currentPage}
              totalPages={currentTotalPages}
              total={activeTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              label="registros"
            />
          </>
        )}
      </section>

      <CompanyDialog
        company={selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompany(null)}
      />
    </div>
  );
}

function FilterTag({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <button
      onClick={onClear}
      className="rounded-full border border-[#DDE5EF] bg-white px-2 py-1 text-[11px] font-semibold text-[#475569] hover:border-[#1061AF]"
    >
      {label}: {value} ×
    </button>
  );
}

function SituationBadge({ value }: { value: string }) {
  const active = value?.toUpperCase() === "ATIVA";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[#DDE5EF] bg-[#F8FAFC] text-[#64748B]"
      }`}
    >
      {value}
    </span>
  );
}

function CompanyDialog({
  company,
  onOpenChange,
}: {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#DDE5EF] bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#0B1F33]">
            {company ? companyName(company) : "Empresa"}
          </DialogTitle>
          <DialogDescription>Dados cadastrais da empresa selecionada.</DialogDescription>
        </DialogHeader>
        {company && (
          <div className="grid gap-3 text-sm">
            <Info label="CNPJ" value={formatCnpj(company.cnpj)} />
            <Info label="Cidade" value={`${company.cidade}/${company.uf}`} />
            <Info label="CNAE principal" value={formatCnae(company.cnaePrincipal)} />
            <Info label="Situação cadastral" value={company.situacaoCadastral} />
            <Info
              label="Endereço"
              value={
                [company.logradouro, company.numero, company.bairro, company.cep]
                  .filter(Boolean)
                  .join(", ") || "-"
              }
            />
            <Info label="Fonte" value={company.source} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2">
      <div className="text-[11px] font-bold uppercase text-[#64748B]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#0B1F33]">{value}</div>
    </div>
  );
}
