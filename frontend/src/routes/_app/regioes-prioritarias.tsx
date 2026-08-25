import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/regioes-prioritarias")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
