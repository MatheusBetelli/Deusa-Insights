// TODO: As recomendações dinâmicas integradas via API ficam para uma versão futura.
// Esta tela está temporariamente removida do fluxo principal do MVP e preservada aqui para referência.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { ArrowLeft, Sparkles, Plus, CheckCircle2, Download, AlertOctagon, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/recomendacoes")({
  component: Reco,
});

const chips = [
  "Empório Família", "Mercadinho São José", "Supermercado Avenida",
  "Mercearia Bom Preço", "Mercado União", "Mini Mercado Central", "Empório Santa Rita",
];

const topOpportunities = [
  { regiao: "Tupã", potenciais: 38, acao: "Priorizar prospecção por CNAE" },
  { regiao: "Marília", potenciais: 31, acao: "Reativar clientes sem recorrência" },
  { regiao: "Pompeia", potenciais: 24, acao: "Revisar cobertura por bairro" },
  { regiao: "Garça", potenciais: 19, acao: "Abrir agenda de prospecção" },
];

function Reco() {
  const [active, setActive] = useState("Empório Família");

  return (
    <div>
      <Link to="/leads-b2b" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1061AF] hover:underline mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar aos leads B2B
      </Link>

      <PageHeader title="Recomendação Comercial" subtitle="Próxima melhor ação sugerida pelo motor de inteligência da Deusa Analytics." />

      <section className="mb-6 rounded-xl border border-[#DDE5EF] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0B1F33]">Top oportunidades comerciais</h2>
            <p className="mt-0.5 text-sm text-[#64748B]">Regiões que concentram maior potencial para ação comercial.</p>
          </div>
          <Sparkles className="h-5 w-5 text-[#F97316]" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {topOpportunities.map((item) => (
            <div key={item.regiao} className="rounded-lg bg-[#F8FAFC] p-4">
              <div className="text-lg font-bold text-[#0B1F33]">{item.regiao}</div>
              <div className="mt-1 text-2xl font-bold text-[#F97316] tabular-nums">{item.potenciais}</div>
              <div className="text-xs font-semibold text-[#64748B]">potenciais clientes</div>
              <div className="mt-3 text-xs font-medium leading-relaxed text-[#0B1F33]">{item.acao}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 mb-6">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              active === c
                ? "bg-[#1061AF] text-white shadow-sm"
                : "bg-white text-[#0B1F33] border border-[#DDE5EF] hover:border-[#1061AF]/40"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* Establishment card */}
        <aside className="bg-white rounded-2xl border border-[#DDE5EF] p-6 h-fit">
          <div className="text-[11px] uppercase tracking-wide text-[#64748B] font-semibold">Estabelecimento</div>
          <h3 className="text-xl font-bold text-[#0B1F33] mt-1">{active}</h3>
          <div className="flex items-center gap-1.5 text-sm text-[#64748B] mt-1">
            <MapPin className="h-3.5 w-3.5" /> Rua Goiás, 305 · Pompéia
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PriorityBadge level="critica" />
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[#FFF200]/30 text-[#854D0E] ring-1 ring-[#CA8A04]/30">
              Potencial cliente
            </span>
          </div>

          <div className="mt-5 space-y-2.5 text-sm">
            {[
              ["CNPJ", "11.222.333/0001-44"],
              ["Cidade", "Pompéia"],
              ["CNAE", "4729-6/99"],
              ["Última interação", "Sem contato"],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between border-b border-dashed border-[#DDE5EF] pb-2">
                <span className="text-[#64748B]">{l}</span>
                <span className="font-medium text-[#0B1F33]">{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-gradient-to-br from-[#1061AF] to-[#0F58A0] text-white p-5">
            <div className="text-[11px] uppercase tracking-wide text-blue-100 font-semibold">Score comercial</div>
            <div className="text-4xl font-bold mt-1 tabular-nums">92</div>
            <div className="text-xs text-blue-100 mt-1">Top 8% das oportunidades em SP</div>
          </div>
        </aside>

        {/* Recommendation main */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#DDE5EF] overflow-hidden">
            <div className="px-6 py-3 bg-[#ED1C24]/8 border-b border-[#ED1C24]/15 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#ED1C24]">
              <AlertOctagon className="h-3.5 w-3.5" /> Recomendação principal · Prioridade crítica
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold text-[#0B1F33]">Visita presencial com oferta inicial Deusa</h2>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-[#ED1C24] text-white shrink-0">Urgência alta</span>
              </div>
              <p className="mt-3 text-[#0B1F33] leading-relaxed">
                Priorizar visita presencial com oferta de mix inicial de produtos Deusa, pois o estabelecimento está localizado em uma área com baixa cobertura atual, alto potencial de demanda e proximidade com outros clientes ativos.
              </p>

              <div className="mt-6">
                <h4 className="font-semibold text-[#0B1F33] mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1061AF]" /> Justificativas do motor
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[
                    "Localização estratégica em corredor comercial",
                    "Alto potencial de consumo na microrregião",
                    "Região com baixa cobertura atual",
                    "Ausência de compra recente ou histórico inativo",
                    "Aderência ao perfil comercial-alvo da Deusa",
                    "Proximidade com outros pontos de venda Deusa",
                  ].map((j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#0B1F33]">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A] mt-0.5 shrink-0" />
                      {j}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-xl bg-[#FFF200]/15 ring-1 ring-[#CA8A04]/20 p-5">
                <div className="text-[11px] uppercase tracking-wide font-bold text-[#854D0E]">Próxima melhor ação</div>
                <p className="mt-2 text-sm text-[#0B1F33] leading-relaxed">
                  Incluir Empório Família na próxima rota da equipe de Pompéia, junto com outras paradas de alta prioridade na região. Apresentar mix inicial de mercearia e perecíveis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="rounded-xl border border-[#DDE5EF] p-4">
                  <div className="text-[11px] uppercase font-semibold text-[#64748B]">Produtos sugeridos</div>
                  <ul className="mt-2 text-sm text-[#0B1F33] space-y-1">
                    <li>· Farinha de Mandioca Biju</li>
                    <li>· Farinha de Milho Biju</li>
                    <li>· Amendoim Cru</li>
                    <li>· Grãos diversos</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[#DDE5EF] p-4">
                  <div className="text-[11px] uppercase font-semibold text-[#64748B]">Risco comercial</div>
                  <div className="mt-2 text-sm font-semibold text-[#F97316]">Médio</div>
                  <p className="text-xs text-[#64748B] mt-1">Sem histórico anterior de compra.</p>
                </div>
                <div className="rounded-xl border border-[#DDE5EF] p-4">
                  <div className="text-[11px] uppercase font-semibold text-[#64748B]">Potencial estimado</div>
                  <div className="mt-2 text-sm font-semibold text-[#16A34A]">Alto</div>
                  <p className="text-xs text-[#64748B] mt-1">Região com baixa cobertura e alta concentração de oportunidades.</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button className="h-10 px-4 rounded-lg bg-[#1061AF] hover:bg-[#0F58A0] text-white font-semibold text-sm flex items-center gap-2 transition">
                  <Plus className="h-4 w-4" /> Adicionar à rota
                </button>
                <button className="h-10 px-4 rounded-lg bg-white border border-[#DDE5EF] hover:border-[#1061AF] text-[#0B1F33] font-semibold text-sm flex items-center gap-2 transition">
                  <CheckCircle2 className="h-4 w-4" /> Marcar como visitado
                </button>
                <button className="h-10 px-4 rounded-lg bg-white border border-[#DDE5EF] hover:border-[#1061AF] text-[#0B1F33] font-semibold text-sm flex items-center gap-2 transition">
                  <Download className="h-4 w-4" /> Exportar recomendação
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
