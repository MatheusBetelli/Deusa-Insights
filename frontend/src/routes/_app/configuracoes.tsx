import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { AuthService } from "@/lib/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/configuracoes")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const user = AuthService.getUser();
      if (!user || !["ADMIN", "MANAGER"].includes(user.role?.toUpperCase())) {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: SettingsPage,
});
