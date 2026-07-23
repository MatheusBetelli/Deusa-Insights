import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ArrowRight, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_app/rotas-inteligentes")({
  component: RotasFuturas,
});

function RotasFuturas() {
  return (
    <div>
      <PageHeader
        title="Rotas Comerciais"
        subtitle="Funcionalidade planejada para uma etapa futura do produto."
      />

      <section className="max-w-3xl rounded-xl border border-[#DDE5EF] bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1061AF]/10">
          <RouteIcon className="h-6 w-6 text-[#1061AF]" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-[#0B1F33]">Fora do escopo do MVP principal</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
          O MVP atual prioriza comparação de bases, identificação de potenciais clientes, mapa de oportunidades e recomendações comerciais.
          A geração automática de rotas poderá ser adicionada depois que o fluxo territorial estiver validado.
        </p>
        <Link
          to="/mapa-oportunidades"
          search={{ uf: "Todos", city: "Todas" }}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF]"
        >
          Ir para o mapa de oportunidades
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
