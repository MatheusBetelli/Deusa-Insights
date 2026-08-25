import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/rotas-inteligentes")({
  beforeLoad: () => {
    throw redirect({ to: "/mapa-oportunidades", search: { uf: "Todos", city: "Todas" } });
  },
});
