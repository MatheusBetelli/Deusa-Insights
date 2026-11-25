import type { DashboardSegment, MonthlyEvolutionPoint } from "@/features/dashboard/types/dashboard";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PieLabelRenderProps } from "recharts";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  BRAND,
  EVOLUTION_SERIES,
  EvolutionSeriesKey,
  formatNumber,
  formatPercent,
  getSegmentColor,
  getShortSegmentName,
  RADIAN,
  toNumber,
} from "../model/dashboard-model";
export function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
        {props.label}
      </span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#0B1F33] outline-none transition focus:border-[#1061AF] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {props.children}
      </select>
    </label>
  );
}

export function MetricCard(props: {
  label: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  accent: string;
}) {
  const Icon = props.icon;
  return (
    <div className="min-h-[116px] rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
            {props.label}
          </div>
          <div className="mt-2 text-3xl font-black leading-none tracking-tight text-[#0B1F33]">
            {typeof props.value === "number" ? formatNumber(props.value) : props.value}
          </div>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: `${props.accent}33`, backgroundColor: `${props.accent}12` }}
        >
          <Icon className="h-4 w-4" style={{ color: props.accent }} />
        </div>
      </div>
      <div className="mt-3 text-xs font-medium leading-snug text-[#64748B]">
        {props.description}
      </div>
    </div>
  );
}

export function ChartCard(props: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
      <div className="mb-3 flex min-h-9 items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#1061AF]">
            {props.eyebrow}
          </div>
          {props.title ? (
            <h2 className="mt-0.5 text-sm font-bold text-[#0B1F33]">{props.title}</h2>
          ) : null}
        </div>
        {props.action && <div className="shrink-0 pt-1">{props.action}</div>}
      </div>
      {props.children}
    </div>
  );
}

export function PeriodLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
      {children}
    </span>
  );
}

export function DetailLink(props: {
  to: "/leads-b2b" | "/mapa-oportunidades" | "/funil-comercial";
  search: Record<string, unknown>;
  label: string;
  compact?: boolean;
}) {
  return (
    <Link
      to={props.to}
      search={props.search}
      className={`inline-flex items-center justify-center gap-2 font-extrabold text-[#2E2478] transition hover:text-[#1061AF] ${
        props.compact ? "text-xs" : "mt-4 w-full border-t border-[#EEF2F7] pt-3 text-sm"
      }`}
    >
      <BarChart3 className="h-4 w-4" />
      {props.label}
    </Link>
  );
}

function renderDonutPercentLabel(props: PieLabelRenderProps) {
  const percent = typeof props.percent === "number" ? props.percent : 0;
  if (percent <= 0) return null;

  const cx = toNumber(props.cx);
  const cy = toNumber(props.cy);
  const outerRadius = toNumber(props.outerRadius);
  const midAngle = typeof props.midAngle === "number" ? props.midAngle : 0;
  const radius = outerRadius + 27;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#334155"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-sm font-extrabold"
    >
      {formatPercent(percent * 100)}
    </text>
  );
}

export function DonutChart(props: {
  data: DashboardSegment[];
  total: number;
  colors: Record<string, string>;
  centerValue: number;
  centerLabel: string;
  emptyLabel: string;
  emptyMessage?: string;
}) {
  const chartData = props.data.filter((item) => item.count > 0);
  if (chartData.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center rounded-lg bg-white text-center">
        <div className="text-4xl font-extrabold tracking-tight text-[#0B1F33]">
          {formatNumber(props.centerValue)}
        </div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#64748B]">
          {props.centerLabel}
        </div>
        {props.emptyMessage ? (
          <div className="mt-6 text-xs font-semibold text-[#64748B]">{props.emptyMessage}</div>
        ) : (
          <div className="mt-6 text-xs font-semibold text-[#64748B]">{props.emptyLabel}</div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={96}
            paddingAngle={3}
            dataKey="count"
            nameKey="name"
            stroke="#FFFFFF"
            strokeWidth={3}
            labelLine={{ stroke: "#CBD5E1", strokeWidth: 1.5 }}
            label={renderDonutPercentLabel}
          >
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={getSegmentColor(entry.key, props.colors)} />
            ))}
          </Pie>
          <RechartsTooltip
            wrapperStyle={{ outline: "none", zIndex: 1000, opacity: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const segment = payload[0].payload as DashboardSegment;
              const color = getSegmentColor(segment.key, props.colors);

              return (
                <div
                  className="rounded-lg border-2 border-slate-700 bg-slate-900 p-3 text-xs shadow-2xl text-white"
                  style={{ backgroundColor: "#0F172A", opacity: 1 }}
                >
                  <div className="flex items-center gap-2 font-bold text-white">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-bold text-white">{segment.name}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-bold tabular-nums">
                    <span className="text-base font-extrabold text-white">
                      {formatNumber(segment.count)}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      ({formatPercent(segment.percentage)})
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
        <span className="text-3xl font-extrabold tracking-tight text-[#0B1F33]">
          {formatNumber(props.centerValue)}
        </span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          {props.centerLabel}
        </span>
      </div>
    </div>
  );
}

export function SegmentLegend(props: {
  items: DashboardSegment[];
  colors: Record<string, string>;
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  if (props.items.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {props.items.map((item) => {
        const isMuted = props.selectedKeys.length > 0 && !props.selectedKeys.includes(item.key);
        const isEmpty = item.count === 0;
        const color = getSegmentColor(item.key, props.colors);
        const displayName = getShortSegmentName(item.name);

        return (
          <button
            key={item.key}
            type="button"
            disabled={isEmpty}
            onClick={() => props.onToggle(item.key)}
            title={item.name}
            className={`flex items-center justify-between gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-left transition ${
              isMuted
                ? "opacity-40 cursor-pointer"
                : "hover:border-slate-200 hover:bg-slate-100 cursor-pointer"
            } ${isEmpty ? "cursor-not-allowed" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span
                className={`truncate text-xs font-bold ${
                  isEmpty ? "text-slate-400" : "text-slate-700"
                }`}
              >
                {displayName}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
              <span className="font-extrabold text-slate-900">{formatNumber(item.count)}</span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({formatPercent(item.percentage)})
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function EvolutionChart(props: {
  data: MonthlyEvolutionPoint[];
  activeSeries: EvolutionSeriesKey[];
  onToggleSeries: (key: EvolutionSeriesKey) => void;
}) {
  if (props.data.length === 0) {
    return <NoData icon={LineChartIcon} label="Sem evolução mensal para os filtros atuais" />;
  }

  return (
    <div className="space-y-2">
      <div className="flex w-full items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <span className="text-[11px] font-semibold text-slate-500">Séries Analíticas</span>
        <SeriesLegend active={props.activeSeries} onToggle={props.onToggleSeries} />
      </div>

      <div className="h-[285px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={props.data} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
            <defs>
              <linearGradient id="colorPositivated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: BRAND.muted, fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: BRAND.muted, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              wrapperStyle={{ outline: "none", zIndex: 1000, opacity: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0]?.payload as MonthlyEvolutionPoint | undefined;
                const periodLabel = point ? `${label}/${point.year}` : label;

                return (
                  <div
                    className="rounded-lg border-2 border-slate-700 bg-slate-900 p-3 text-xs shadow-2xl text-white"
                    style={{ backgroundColor: "#0F172A", opacity: 1 }}
                  >
                    <div className="mb-2 font-bold text-xs uppercase tracking-wider text-slate-300 border-b border-slate-700/80 pb-1">
                      {periodLabel}
                    </div>
                    <div className="space-y-1.5">
                      {payload.map((entry) => (
                        <div
                          key={String(entry.dataKey)}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}
                          </span>
                          <span className="font-extrabold text-white tabular-nums">
                            {formatNumber(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />

            {props.activeSeries.includes("negotiationsCount") && (
              <Bar
                dataKey="negotiationsCount"
                name="Contatos / Negociações"
                fill="#CBD5E1"
                opacity={0.5}
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            )}

            {props.activeSeries.includes("positivatedClients") && (
              <Area
                type="monotone"
                dataKey="positivatedClients"
                name="Clientes positivados"
                fill="url(#colorPositivated)"
                stroke="#10B981"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#10B981", strokeWidth: 2, stroke: "#FFFFFF" }}
                activeDot={{ r: 5, fill: "#059669" }}
              />
            )}

            {props.activeSeries.includes("activeClients") && (
              <Line
                type="monotone"
                dataKey="activeClients"
                name="Carteira ativa"
                stroke="#2563EB"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SeriesLegend(props: {
  active: EvolutionSeriesKey[];
  onToggle: (key: EvolutionSeriesKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {EVOLUTION_SERIES.map((item) => {
        const active = props.active.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onToggle(item.key)}
            className={`inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[10px] font-bold transition ${
              active
                ? "border-slate-300 bg-slate-100 text-slate-800"
                : "border-slate-200 bg-white text-slate-400 opacity-60"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

function NoData(props: { icon: LucideIcon; label: string }) {
  const Icon = props.icon;
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center">
      <Icon className="h-5 w-5 text-[#94A3B8]" />
      <div className="mt-2 text-xs font-bold text-[#64748B]">{props.label}</div>
    </div>
  );
}
