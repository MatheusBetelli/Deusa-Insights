import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/base-de-dados")({
  beforeLoad: () => {
    throw redirect({ to: "/leads-b2b" });
  },
  component: () => null,
});
