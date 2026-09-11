import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { PaginationBar } from "@/components/common/PaginationBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuthService, type User } from "@/lib/auth";
import { formatDateTime } from "@/lib/commercial-formatters";
import { leadsService } from "@/services/leadsService";
import { usersService } from "@/services/usersService";
import {
  COMMERCIAL_ACTION_LABELS,
  COMMERCIAL_ACTION_TYPES,
  HISTORICAL_COMMERCIAL_ACTION_TYPES,
} from "@/types/commercialAction";
import type { CommercialActivity } from "@/types/commercialActivity";
import { CalendarDays, Filter, Loader2, Search, X } from "lucide-react";

export const Route = createFileRoute("/_app/atividades-comerciais")({
  component: CommercialActivitiesPage,
});

const PAGE_SIZE = 25;

type ActivityFilters = {
  company: string;
  city: string;
  type: string;
  responsibleId: string;
  dateFrom: string;
  dateTo: string;
};

type ActivityView = "activities" | "followups";

type ResponsibleOption = Pick<User, "id" | "name">;

const EMPTY_FILTERS: ActivityFilters = {
  company: "",
  city: "",
  type: "",
  responsibleId: "",
  dateFrom: "",
  dateTo: "",
};

function defaultFiltersFor(user: User | null): ActivityFilters {
  return user?.role.toUpperCase() === "SALES"
    ? { ...EMPTY_FILTERS, responsibleId: user.id }
    : { ...EMPTY_FILTERS };
}

function isToday(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function followUpGroup(activity: CommercialActivity): "overdue" | "today" | "upcoming" {
  if (!activity.nextContactAt) return "upcoming";
  const timestamp = new Date(activity.nextContactAt).getTime();
  if (timestamp < Date.now() && !isToday(activity.nextContactAt)) return "overdue";
  if (isToday(activity.nextContactAt)) return "today";
  return "upcoming";
}

function CommercialActivitiesPage() {
  const [currentUser] = useState<User | null>(() => AuthService.getUser());
  const [filters, setFilters] = useState<ActivityFilters>(() => defaultFiltersFor(currentUser));
  const [appliedFilters, setAppliedFilters] = useState<ActivityFilters>(() =>
    defaultFiltersFor(currentUser),
  );
  const [view, setView] = useState<ActivityView>("activities");
  const [responsibles, setResponsibles] = useState<ResponsibleOption[]>([]);
  const [activities, setActivities] = useState<CommercialActivity[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const currentUser = AuthService.getUser();
    if (!currentUser) return;

    if (["ADMIN", "MANAGER"].includes(currentUser.role.toUpperCase())) {
      void usersService
        .getUsers()
        .then((users) => setResponsibles(users.map(({ id, name }) => ({ id, name }))))
        .catch(() => setResponsibles([{ id: currentUser.id, name: currentUser.name }]));
      return;
    }

    setResponsibles([{ id: currentUser.id, name: currentUser.name }]);
  }, []);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);

    void leadsService
      .getCommercialActivities({
        page,
        pageSize: PAGE_SIZE,
        view,
        company: appliedFilters.company || undefined,
        city: appliedFilters.city || undefined,
        type: appliedFilters.type || undefined,
        responsibleId: appliedFilters.responsibleId || undefined,
        dateFrom: appliedFilters.dateFrom || undefined,
        dateTo: appliedFilters.dateTo || undefined,
      })
      .then((result) => {
        if (requestId !== requestSequence.current) return;
        setActivities(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((err: unknown) => {
        if (requestId !== requestSequence.current) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar as atividades.");
      })
      .finally(() => {
        if (requestId === requestSequence.current) setLoading(false);
      });
  }, [appliedFilters, page, view]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    const nextFilters = defaultFiltersFor(currentUser);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  }

  function applyQuickView(nextView: ActivityView, mine: boolean) {
    const nextFilters = {
      ...filters,
      responsibleId: mine ? currentUser?.id || "" : "",
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setView(nextView);
    setPage(1);
  }

  async function completeFollowUp(activity: CommercialActivity) {
    setCompletingId(activity.interactionId);
    setError(null);
    try {
      await leadsService.completeFollowUp(activity.leadId, activity.interactionId);
      setActivities((current) =>
        current.filter((item) => item.interactionId !== activity.interactionId),
      );
      setTotal((current) => Math.max(0, current - 1));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o retorno.");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Atividades Comerciais"
        subtitle="Acompanhe as interações registradas pela equipe nos mercados da carteira."
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Visão comercial">
        <QuickViewButton
          active={view === "activities" && !appliedFilters.responsibleId}
          onClick={() => applyQuickView("activities", false)}
        >
          Todas as atividades
        </QuickViewButton>
        <QuickViewButton
          active={view === "activities" && Boolean(appliedFilters.responsibleId)}
          onClick={() => applyQuickView("activities", true)}
        >
          Minhas atividades
        </QuickViewButton>
        <QuickViewButton
          active={view === "followups"}
          onClick={() => applyQuickView("followups", currentUser?.role.toUpperCase() === "SALES")}
        >
          Próximos contatos
        </QuickViewButton>
      </div>

      <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Mercado"
              value={filters.company}
              onChange={(value) => setFilters((current) => ({ ...current, company: value }))}
              placeholder="Nome ou CNPJ"
              icon={<Search className="h-4 w-4" />}
            />
            <FilterInput
              label="Cidade"
              value={filters.city}
              onChange={(value) => setFilters((current) => ({ ...current, city: value }))}
              placeholder="Digite a cidade"
            />
            <FilterSelect
              label="Tipo da ação"
              value={filters.type}
              onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
            >
              <option value="">Todos os tipos</option>
              {COMMERCIAL_ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {COMMERCIAL_ACTION_LABELS[type]}
                </option>
              ))}
              {HISTORICAL_COMMERCIAL_ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {COMMERCIAL_ACTION_LABELS[type]} (histórico)
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Responsável"
              value={filters.responsibleId}
              onChange={(value) => setFilters((current) => ({ ...current, responsibleId: value }))}
            >
              <option value="">Todos os responsáveis</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.name}
                </option>
              ))}
            </FilterSelect>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
            <FilterInput
              label="Data inicial"
              value={filters.dateFrom}
              onChange={(value) => setFilters((current) => ({ ...current, dateFrom: value }))}
              type="date"
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <FilterInput
              label="Data final"
              value={filters.dateTo}
              onChange={(value) => setFilters((current) => ({ ...current, dateTo: value }))}
              type="date"
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <div className="flex gap-2 md:col-span-2 xl:justify-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF]"
              >
                <Filter className="h-4 w-4 text-[#FFF200]" />
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:border-[#1061AF] hover:text-[#0B1F33]"
              >
                <X className="h-4 w-4" />
                Limpar
              </button>
            </div>
          </div>
        </form>
      </section>

      {error ? (
        <ErrorState
          description={error}
          action={
            <button
              type="button"
              onClick={() => setAppliedFilters({ ...appliedFilters })}
              className="rounded-lg bg-[#0B1F33] px-3 py-2 text-xs font-bold text-white hover:bg-[#1061AF]"
            >
              Tentar novamente
            </button>
          }
        />
      ) : loading && activities.length === 0 ? (
        <LoadingState message="Carregando atividades comerciais..." />
      ) : activities.length === 0 ? (
        <EmptyState
          title="Nenhuma atividade encontrada"
          description="Ajuste os filtros ou registre uma nova ação em um mercado."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#DDE5EF] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#0B1F33]">Histórico consolidado</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                {total.toLocaleString("pt-BR")}{" "}
                {view === "followups" ? "retorno(s) pendente(s)" : "atividade(s)"}.
              </p>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-[#1061AF]" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 font-bold">Data/Hora</th>
                  <th className="px-4 py-3 font-bold">Empresa</th>
                  <th className="px-4 py-3 font-bold">Cidade</th>
                  <th className="px-4 py-3 font-bold">Ação</th>
                  <th className="px-4 py-3 font-bold">Responsável</th>
                  <th className="px-4 py-3 font-bold">Observação</th>
                  <th className="px-4 py-3 font-bold">Último contato</th>
                </tr>
              </thead>
              {view === "followups" ? (
                (["overdue", "today", "upcoming"] as const).map((group) => {
                  const groupItems = activities.filter(
                    (activity) => followUpGroup(activity) === group,
                  );
                  if (groupItems.length === 0) return null;
                  const labels = { overdue: "Atrasados", today: "Hoje", upcoming: "Próximos" };
                  return (
                    <tbody key={group} className="divide-y divide-[#EEF2F7]">
                      <tr className="bg-[#F8FAFC]">
                        <th
                          colSpan={7}
                          className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-[#64748B]"
                        >
                          {labels[group]}
                        </th>
                      </tr>
                      {groupItems.map((activity) => (
                        <ActivityRow
                          key={activity.interactionId}
                          activity={activity}
                          followUp
                          completing={completingId === activity.interactionId}
                          onComplete={() => void completeFollowUp(activity)}
                        />
                      ))}
                    </tbody>
                  );
                })
              ) : (
                <tbody className="divide-y divide-[#EEF2F7]">
                  {activities.map((activity) => (
                    <ActivityRow key={activity.interactionId} activity={activity} />
                  ))}
                </tbody>
              )}
            </table>
          </div>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            label="atividades"
          />
        </section>
      )}
    </div>
  );
}

function QuickViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
        active
          ? "border-[#0B1F33] bg-[#0B1F33] text-white"
          : "border-[#DDE5EF] bg-white text-[#475569] hover:border-[#1061AF] hover:text-[#1061AF]"
      }`}
    >
      {children}
    </button>
  );
}

function ActivityRow({
  activity,
  followUp = false,
  completing = false,
  onComplete,
}: {
  activity: CommercialActivity;
  followUp?: boolean;
  completing?: boolean;
  onComplete?: () => void;
}) {
  const date = followUp ? activity.nextContactAt : activity.createdAt;
  return (
    <tr className="transition hover:bg-[#F8FAFC]">
      <td className="whitespace-nowrap px-4 py-3 align-top text-[#475569]">
        <Link
          to="/leads-b2b/$leadId"
          params={{ leadId: activity.leadId }}
          className="hover:text-[#1061AF]"
        >
          {date ? formatDateTime(date) : "Sem data"}
        </Link>
      </td>
      <td className="max-w-[220px] px-4 py-3 align-top">
        <Link
          to="/leads-b2b/$leadId"
          params={{ leadId: activity.leadId }}
          className="font-bold text-[#0B1F33] hover:text-[#1061AF]"
        >
          {activity.companyName}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-[#475569]">{activity.city}</td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <Link
          to="/leads-b2b/$leadId"
          params={{ leadId: activity.leadId }}
          className="font-bold text-[#1061AF] hover:underline"
        >
          {COMMERCIAL_ACTION_LABELS[activity.type] ?? activity.type}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top font-semibold text-[#475569]">
        {activity.responsibleName || "Não identificado"}
      </td>
      <td className="max-w-[360px] px-4 py-3 align-top leading-relaxed text-[#475569]">
        <span className="line-clamp-2">{activity.description}</span>
        {followUp && onComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="mt-2 rounded-md border border-[#DDE5EF] px-2 py-1 text-[11px] font-bold text-[#1061AF] transition hover:border-[#1061AF] disabled:opacity-50"
          >
            {completing ? "Concluindo..." : "Concluir retorno"}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-[#475569]">
        {activity.lastContactAt ? formatDateTime(activity.lastContactAt) : "—"}
      </td>
    </tr>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        {label}
      </span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${icon ? "pl-9" : "px-3"} h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pr-3 text-sm text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white`}
        />
      </span>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white"
      >
        {children}
      </select>
    </label>
  );
}
