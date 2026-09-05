import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/set-password")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/reset-password",
      search: { token: search.token, mode: "invite" },
    });
  },
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
});
