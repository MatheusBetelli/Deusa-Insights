import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthService } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (AuthService.isAuthenticated()) {
        throw redirect({ to: "/dashboard" });
      } else {
        throw redirect({ to: "/login" });
      }
    }
  },
  component: () => null,
});
