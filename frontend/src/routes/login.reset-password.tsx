import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login/reset-password")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/reset-password",
      search: { token: search.token, mode: "reset" },
    });
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || "",
    };
  },
});
