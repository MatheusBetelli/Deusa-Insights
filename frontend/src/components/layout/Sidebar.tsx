import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileUp,
  Funnel,
  LayoutDashboard,
  Building2,
  Database,
  MapPinned,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  X,
} from "lucide-react";
import { DeusaLogo } from "./Logo";
import { AuthService, type User as AuthUser } from "@/lib/auth";
import { useEffect, useState } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  roles: string[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    title: "Operação & Vendas",
    items: [
      {
        to: "/dashboard",
        label: "Central Comercial",
        icon: LayoutDashboard,
        badge: null,
        roles: ["ADMIN", "MANAGER", "SALES"],
      },
      {
        to: "/leads-b2b",
        label: "Leads B2B",
        icon: Building2,
        badge: null,
        roles: ["ADMIN", "MANAGER", "SALES"],
      },
      {
        to: "/mapa-oportunidades",
        label: "Mapa de Oportunidades",
        icon: MapPinned,
        badge: "GPS",
        roles: ["ADMIN", "MANAGER", "SALES"],
      },
      {
        to: "/funil-comercial",
        label: "Funil Comercial",
        icon: Funnel,
        badge: null,
        roles: ["ADMIN", "MANAGER", "SALES"],
      },
    ],
  },
  {
    title: "Gestão de Dados",
    items: [
      {
        to: "/importar-cnpjs",
        label: "Importar CNPJs",
        icon: FileUp,
        badge: "Receita",
        roles: ["ADMIN"],
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        to: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        badge: null,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(AuthService.getUser());
  }, []);

  const userRoleUpper = (user?.role || "SALES").toUpperCase();

  return (
    <>
      {/* ── Mobile Backdrop Overlay ── */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs lg:hidden transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* ── Mobile Slide-Over Drawer Sidebar ── */}
      {mobileOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-[#0B1726] text-slate-200 shadow-2xl lg:hidden select-none animate-in slide-in-from-left duration-300">
          {/* Header Mobile */}
          <div className="pt-5 pb-4 px-5 border-b border-slate-800/70 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <DeusaLogo className="h-10 w-auto max-w-[170px] object-contain" />
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                Deusa Analytics
              </div>
            </div>

            <button
              onClick={onMobileClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Fechar menu"
            >
              <X className="h-5 w-5 text-slate-300" />
            </button>
          </div>

          {/* Navegação Mobile */}
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-800">
            {navigationGroups.map((group) => {
              const visibleGroupItems = group.items.filter((item) => {
                if (!mounted) return true;
                if (userRoleUpper === "ADMIN") return true;
                return item.roles.map((r) => r.toUpperCase()).includes(userRoleUpper);
              });

              if (visibleGroupItems.length === 0) return null;

              return (
                <div key={group.title} className="space-y-1">
                  <div className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {group.title}
                  </div>

                  <div className="space-y-1">
                    {visibleGroupItems.map((it) => {
                      const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to + "/"));
                      const Icon = it.icon;

                      return (
                        <Link
                          key={it.to}
                          to={it.to}
                          onClick={onMobileClose}
                          className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                            active
                              ? "bg-slate-800/90 text-white font-semibold shadow-xs border border-slate-700/60"
                              : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                          }`}
                        >
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-md bg-[#FFF200]" />
                          )}

                          <div className="flex items-center gap-3">
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                                active ? "text-[#FFF200]" : "text-slate-400 group-hover:text-slate-200"
                              }`}
                            />
                            <span className="truncate tracking-tight">{it.label}</span>
                          </div>

                          {it.badge && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                active
                                  ? "bg-slate-700/80 text-slate-200 border-slate-600/60"
                                  : "bg-slate-800/80 text-slate-400 border-slate-700/50"
                              }`}
                            >
                              {it.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Footer Mobile */}
          <div className="p-3 border-t border-slate-800/80 bg-[#08121E]">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0D1C2D] p-2.5 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1061AF] text-xs font-extrabold text-white">
                  {mounted ? user?.name?.substring(0, 2).toUpperCase() || "DE" : "DE"}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-bold text-white leading-tight">
                    {mounted ? user?.name || "Usuário Deusa" : "Usuário Deusa"}
                  </span>
                  <span className="truncate text-[10px] font-medium text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-[#1061AF] shrink-0" />
                    {mounted
                      ? user?.role === "ADMIN"
                        ? "Administrador"
                        : user?.role === "MANAGER"
                          ? "Gerente"
                          : "Consultor"
                      : "Consultor"}
                  </span>
                </div>
              </div>

              <Link
                to="/configuracoes"
                onClick={onMobileClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                title="Configurações"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </aside>
      )}

      {/* ── Desktop Permanent Sidebar ── */}
      <aside
        className={`hidden lg:flex h-screen shrink-0 flex-col bg-[#0B1726] text-slate-200 border-r border-slate-800/80 select-none transition-all duration-300 ease-in-out ${
          collapsed ? "w-[76px]" : "w-[280px]"
        }`}
      >
        {/* Header do Sidebar */}
        <div className={`pt-4 pb-3 border-b border-slate-800/70 ${collapsed ? "px-2" : "px-5"}`}>
          {!collapsed ? (
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <DeusaLogo className="h-10 w-auto max-w-[170px] object-contain" />
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Deusa Analytics
                </div>
              </div>

              {onToggle && (
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors mt-0.5"
                  title="Recolher menu"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 py-1">
              <DeusaLogo className="h-7 w-auto max-w-[46px] object-contain" />

              {/* Botão de expandir posicionado entre a logo e a navegação */}
              {onToggle && (
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/90 text-[#FFF200] hover:bg-slate-700 hover:text-white transition-all shadow-xs"
                  title="Expandir menu"
                >
                  <PanelLeftOpen className="h-4 w-4 text-[#FFF200]" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navegação Principal */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-800">
          {navigationGroups.map((group) => {
            const visibleGroupItems = group.items.filter((item) => {
              if (!mounted) return true;
              if (userRoleUpper === "ADMIN") return true;
              return item.roles.map((r) => r.toUpperCase()).includes(userRoleUpper);
            });

            if (visibleGroupItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                {!collapsed ? (
                  <div className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {group.title}
                  </div>
                ) : (
                  <div className="my-2 border-t border-slate-800/80" />
                )}

                <div className="space-y-1">
                  {visibleGroupItems.map((it) => {
                    const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to + "/"));
                    const Icon = it.icon;

                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        title={collapsed ? it.label : undefined}
                        className={`group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${
                          collapsed ? "justify-center px-2" : "justify-between px-3"
                        } ${
                          active
                            ? "bg-slate-800/90 text-white font-semibold shadow-xs border border-slate-700/60"
                            : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                        }`}
                      >
                        {/* Indicador sutil e elegante do item ativo */}
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-md bg-[#FFF200]" />
                        )}

                        <div className="flex items-center gap-3">
                          <Icon
                            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                              active ? "text-[#FFF200]" : "text-slate-400 group-hover:text-slate-200"
                            }`}
                          />
                          {!collapsed && <span className="truncate tracking-tight">{it.label}</span>}
                        </div>

                        {/* Badge discreto */}
                        {!collapsed && it.badge && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                              active
                                ? "bg-slate-700/80 text-slate-200 border-slate-600/60"
                                : "bg-slate-800/80 text-slate-400 border-slate-700/50"
                            }`}
                          >
                            {it.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer / Perfil do Usuário */}
        <div className="p-3 border-t border-slate-800/80 bg-[#08121E]">
          {!collapsed ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0D1C2D] p-2.5 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-1 border border-slate-700 shadow-xs overflow-hidden">
                  <DeusaLogo className="h-5 w-auto object-contain" />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-bold text-white leading-tight">
                    {mounted ? user?.name || "Usuário Deusa" : "Usuário Deusa"}
                  </span>
                  <span className="truncate text-[10px] font-medium text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-[#1061AF] shrink-0" />
                    {mounted
                      ? user?.role === "ADMIN"
                        ? "Administrador"
                        : user?.role === "MANAGER"
                          ? "Gerente"
                          : "Consultor"
                      : "Consultor"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Link
                  to="/configuracoes"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  title="Configurações"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => {
                    AuthService.logout();
                    window.location.href = "/login";
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-950/50 hover:text-red-400 transition-colors"
                  title="Sair do sistema"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  AuthService.logout();
                  window.location.href = "/login";
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1061AF] text-xs font-extrabold text-white shadow-xs hover:bg-red-600 transition-colors"
                title="Clique para Sair"
              >
                {mounted ? user?.name?.substring(0, 2).toUpperCase() || "DE" : "DE"}
              </button>
            </div>
          )}

          {!collapsed && (
            <div className="mt-2.5 px-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
              <span>Deusa Alimentos</span>
              <span>v2.4</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
