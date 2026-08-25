import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/recomendacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/leads-b2b" });
  },
});
