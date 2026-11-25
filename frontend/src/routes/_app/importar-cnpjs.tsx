import { ImportCnpjs } from "@/features/imports/pages/ImportCnpjs";
import { AuthService } from "@/lib/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/importar-cnpjs")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const user = AuthService.getUser();
      if (!user || user.role?.toUpperCase() !== "ADMIN") {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: ImportCnpjs,
});
