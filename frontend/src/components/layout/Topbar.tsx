import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Loader2,
  LogOut,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeusaLogo } from "./Logo";
import { AuthService, type User as AuthUser } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/commercial-formatters";
import { notificationsService, type AppNotification } from "@/services/notificationsService";
import { toast } from "sonner";

interface TopbarProps {
  onToggleSidebar?: () => void;
  onOpenMobile?: () => void;
}

type ScreenInfo = {
  category: string;
  title: string;
  subtitle: string;
};

function getScreenInfo(pathname: string): ScreenInfo {
  const path = pathname.toLowerCase();
  if (path.includes("/dashboard")) {
    return {
      category: "COMERCIAL",
      title: "Central Comercial",
      subtitle: "Carteira, positivação, cobertura e expansão territorial da Deusa Alimentos.",
    };
  }
  if (path.includes("/mapa-oportunidades")) {
    return {
      category: "INTELIGÊNCIA TERRITORIAL",
      title: "Mapa de Oportunidades",
      subtitle: "Visualização operacional e inteligência territorial de oportunidades B2B.",
    };
  }
  if (path.includes("/funil-comercial")) {
    return {
      category: "OPERAÇÃO & VENDAS",
      title: "Funil Comercial",
      subtitle: "Acompanhamento do pipeline de vendas e fases de conversão de clientes.",
    };
  }
  if (path.includes("/importar-cnpjs")) {
    return {
      category: "GESTÃO DE DADOS",
      title: "Importar CNPJs",
      subtitle: "Ingestão e enriquecimento de novos estabelecimentos e clientes.",
    };
  }
  if (path.includes("/configuracoes")) {
    return {
      category: "SISTEMA",
      title: "Configurações",
      subtitle: "Parâmetros do sistema, inteligência de scoring e gestão de usuários.",
    };
  }
  if (path.includes("/leads-b2b/")) {
    return {
      category: "OPERAÇÃO & VENDAS",
      title: "Detalhes da Oportunidade",
      subtitle: "Ficha cadastral completa e ações comerciais.",
    };
  }
  if (path.includes("/leads-b2b")) {
    return {
      category: "OPERAÇÃO & VENDAS",
      title: "Leads B2B",
      subtitle: "Painel comercial operacional para prospecção, qualificação e conversão.",
    };
  }
  return {
    category: "DEUSA ALIMENTOS",
    title: "Deusa Analytics",
    subtitle: "Plataforma de Inteligência Territorial e Comercial.",
  };
}

function getRoleLabel(role?: string): string {
  if (!role) return "Consultor Comercial";
  const r = role.toUpperCase();
  if (r === "ADMIN") return "Administrador";
  if (r === "MANAGER") return "Gerente Comercial";
  if (r === "SALES") return "Consultor Comercial";
  return role;
}

export function Topbar({ onOpenMobile }: TopbarProps = {}) {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPathname = routerState?.location?.pathname || "";
  const screenInfo = getScreenInfo(currentPathname);

  const user = AuthService.getUser();
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(user);
  const [profileLoading, setProfileLoading] = useState(false);

  // Notificações reais do backend
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    if (user?.id) {
      try {
        const saved = localStorage.getItem(`deusa_read_notifs_${user.id}`);
        if (saved) setReadIds(JSON.parse(saved));
      } catch {
        // Fallback
      }
    }
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      try {
        const data = await notificationsService.getNotifications();
        if (isMounted) setNotifications(data);
      } catch {
        // Se a API não responder, mantém lista vazia sem inventar notificações falsas
        if (isMounted) setNotifications([]);
      }
    }
    void loadNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  function saveReadIds(newReadIds: string[]) {
    setReadIds(newReadIds);
    if (user?.id) {
      try {
        localStorage.setItem(`deusa_read_notifs_${user.id}`, JSON.stringify(newReadIds));
      } catch {
        // Fallback
      }
    }
  }

  function markAsRead(id: string) {
    if (!readIds.includes(id)) {
      saveReadIds([...readIds, id]);
    }
  }

  function markAllAsRead() {
    const allIds = notifications.map((n) => n.id);
    saveReadIds(Array.from(new Set([...readIds, ...allIds])));
  }

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  function handleNotificationClick(notif: AppNotification) {
    markAsRead(notif.id);
    if (notif.targetUrl) {
      navigate({ to: notif.targetUrl });
    }
  }

  async function openProfile() {
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      setProfile(await AuthService.getProfile());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar o perfil.");
    } finally {
      setProfileLoading(false);
    }
  }

  const handleLogout = async () => {
    await AuthService.logout();
    navigate({ to: "/login" });
    toast.success("Sessão encerrada com sucesso");
  };

  const userRoleLabel = mounted ? getRoleLabel(user?.role) : "Consultor Comercial";

  return (
    <header className="h-[88px] shrink-0 border-b border-[#DDE5EF] bg-white px-4 shadow-2xs lg:px-6">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobile && (
            <button
              type="button"
              onClick={onOpenMobile}
              className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              title="Abrir menu principal"
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
          )}
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1061AF] leading-none mb-0.5">
              {screenInfo.category}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#0B1F33] leading-tight truncate">
              {screenInfo.title}
            </h1>
            <p className="text-xs font-medium text-[#64748B] leading-tight truncate mt-0.5 hidden sm:block">
              {screenInfo.subtitle}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          {/* Menu de Notificações Reais */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 outline-none transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                title="Notificações da Operação"
              >
                <Bell className="h-[18px] w-[18px]" />
                {/* Ocultar badge se unreadCount === 0 */}
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ED1C24] text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 overflow-hidden p-0 shadow-xl border border-slate-200 rounded-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="font-bold text-slate-900 text-sm">Notificações Operacionais</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] font-bold text-[#1061AF] hover:underline cursor-pointer"
                  >
                    Marcar lidas
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 font-medium">
                    Nenhuma notificação no momento.
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isUnread = !readIds.includes(notif.id);
                    let IconComponent = Sparkles;
                    let iconColor = "text-amber-500";

                    if (notif.category === "IMPORT") {
                      IconComponent = CheckCircle2;
                      iconColor = "text-emerald-600";
                    } else if (notif.category === "ACTION") {
                      IconComponent = AlertCircle;
                      iconColor = "text-[#1061AF]";
                    }

                    return (
                      <DropdownMenuItem
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 transition-colors ${
                          isUnread ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs ${isUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}
                            >
                              {notif.title}
                            </span>
                            {isUnread && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1061AF]" />
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                            {notif.message}
                          </p>
                          <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Perfil do Usuário Autenticado */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 outline-none transition hover:border-slate-300 hover:bg-slate-100 cursor-pointer">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-bold leading-tight text-[#0B1F33] transition-colors group-hover:text-[#1061AF]">
                    {mounted ? user?.name || "Usuário" : "Usuário"}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-500">
                    <span>{userRoleLabel}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400 transition-transform group-hover:text-slate-600 group-data-[state=open]:rotate-180" />
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1 ring-2 ring-slate-100 border border-slate-200 shadow-xs overflow-hidden">
                  <DeusaLogo className="h-6 w-auto object-contain" />
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 p-1.5 shadow-xl border border-slate-200 rounded-xl"
            >
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Minha Conta
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => void openProfile()}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:text-slate-900 focus:bg-slate-100 font-medium text-sm"
              >
                <User className="h-4 w-4 text-[#1061AF]" />
                <span>Meu perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-red-600 focus:bg-red-50 font-bold text-sm"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span>Sair da conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modal Meu Perfil */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="border border-slate-200 bg-white p-6 sm:max-w-[400px] rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold text-[#0B1F33]">
              Meu Perfil
            </DialogTitle>
          </DialogHeader>

          {profileLoading ? (
            <div className="flex h-40 items-center justify-center text-xs font-semibold text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#1061AF]" />
              Carregando dados do perfil...
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-4 pt-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white p-3.5 shadow-md border-2 border-slate-200 overflow-hidden ring-4 ring-slate-50">
                <DeusaLogo className="h-12 w-auto object-contain" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {profile?.name || user?.name || "Usuário"}
                </h3>
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-[#1061AF] border border-blue-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {getRoleLabel(profile?.role || user?.role)}
                </div>
              </div>

              <div className="w-full space-y-2 text-left pt-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    E-mail Corporativo
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Mail className="h-3.5 w-3.5 text-[#1061AF]" />
                    <span className="truncate">{profile?.email || user?.email}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-200 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Encerrar Sessão
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}
