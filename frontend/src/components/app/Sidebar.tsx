import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileUp,
  Funnel,
  LayoutDashboard,
  Building2,
  Database,
  MapPinned,
  Settings,
} from "lucide-react";
import { DeusaLogo } from "./Logo";
import { AuthService } from "@/lib/auth";
import { useEffect, useState } from "react";

const allItems = [
  { to: "/dashboard", label: "Central Comercial", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "SALES"] },
  { to: "/leads-b2b", label: "Leads B2B", icon: Building2, roles: ["ADMIN", "MANAGER", "SALES"] },
  { to: "/mapa-oportunidades", label: "Mapa", icon: MapPinned, roles: ["ADMIN", "MANAGER", "SALES"] },
  { to: "/importar-cnpjs", label: "Importar CNPJs", icon: FileUp, roles: ["ADMIN"] },
  { to: "/funil-comercial", label: "Funil Comercial", icon: Funnel, roles: ["ADMIN", "MANAGER", "SALES"] },
  { to: "/base-de-dados", label: "Base de Dados", icon: Database, roles: ["ADMIN", "MANAGER"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["ADMIN", "MANAGER"] },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = AuthService.getUser();
    if (user?.role) {
      setUserRole(user.role);
    }
  }, []);

  const visibleItems = allItems.filter((item) => {
    if (!mounted) return true;
    const roleUpper = userRole?.toUpperCase() || "ADMIN";
    if (roleUpper === "ADMIN") return true; // Administrador tem acesso irrestrito a TODAS as abas
    return item.roles.map((r) => r.toUpperCase()).includes(roleUpper);
  });

  return (
    <aside className="hidden lg:flex h-screen w-[280px] shrink-0 flex-col bg-[#0B1B2B] text-white shadow-xl shadow-[#0B1F33]/10">
      <div className="px-6 pt-6 pb-5 border-b border-white/5">
        <div className="space-y-3">
          <DeusaLogo className="h-12 w-auto max-w-[220px]" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Deusa Analytics</div>
            <div className="text-[11px] text-slate-400">Inteligência Comercial</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {visibleItems.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[#FFF200]" />
              )}
              <Icon className={`h-[18px] w-[18px] ${active ? "text-[#FFF200]" : "text-slate-400 group-hover:text-white"}`} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 pb-5 text-[11px] text-slate-500">MVP interno · Deusa Alimentos</div>
    </aside>
  );
}
