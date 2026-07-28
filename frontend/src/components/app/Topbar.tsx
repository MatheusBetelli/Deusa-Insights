import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthService, type User as AuthUser } from "@/lib/auth";
import { toast } from "sonner";

export function Topbar() {
  const navigate = useNavigate();
  const user = AuthService.getUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(user);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleLogout = () => {
    AuthService.logout();
    navigate({ to: "/login" });
    toast.success("Sessão encerrada com sucesso");
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;
    navigate({ to: "/leads-b2b", search: { search: term } });
  };

  const notifications = [
    {
      id: 1,
      title: "Base de leads B2B atualizada",
      time: "Hoje",
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      id: 2,
      title: "Leads críticos aguardam contato",
      time: "Pendente",
      icon: Clock,
      color: "text-amber-500",
    },
  ];

  return (
    <header className="h-16 shrink-0 border-b border-[#DDE5EF] bg-white px-4 shadow-sm shadow-slate-200/40 lg:px-8">
      <div className="flex h-full items-center gap-4">
        <form onSubmit={handleSearch} className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar cidade, CNAE, CNPJ ou lead..."
            className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-10 pr-3 text-sm text-[#0B1F33] outline-none transition placeholder:text-slate-400 focus:border-[#1061AF] focus:bg-white focus:ring-2 focus:ring-[#1061AF]/15"
          />
        </form>

        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50/70 text-slate-600 outline-none transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ED1C24] text-[10px] font-bold text-white ring-2 ring-white">
                  {notifications.length}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 overflow-hidden p-0 shadow-xl border border-slate-200/80 rounded-xl">
              <DropdownMenuLabel className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 font-bold text-slate-800">
                Notificações
              </DropdownMenuLabel>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex cursor-default items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-0 focus:bg-slate-50"
                    >
                      <div className={`mt-0.5 ${notification.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">{notification.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{notification.time}</div>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 bg-slate-50/80 p-2 text-center">
                <button
                  onClick={() => navigate({ to: "/configuracoes" })}
                  className="text-xs font-bold text-[#1061AF] hover:underline"
                >
                  Configurar notificações
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-1.5 outline-none transition-all hover:border-slate-300 hover:bg-slate-100/80 cursor-pointer shadow-xs active:scale-[0.99]">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-bold leading-tight text-[#0B1F33] transition-colors group-hover:text-[#1061AF]">
                    {mounted ? user?.name || "Usuário" : "Usuário"}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-500">
                    <span>{mounted ? user?.role || "Comercial" : "Comercial"}</span>
                    <span>·</span>
                    <span className="text-[#1061AF] font-bold">{mounted ? user?.location || "SP" : "SP"}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400 transition-transform group-hover:text-slate-600 group-data-[state=open]:rotate-180" />
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1061AF] to-[#0A3D6E] text-xs font-extrabold text-white shadow-md ring-2 ring-white border border-blue-200/40">
                  {mounted ? user?.name?.substring(0, 2).toUpperCase() || "U" : "U"}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border border-slate-200/80 rounded-xl">
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Minha Conta
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => void openProfile()}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:text-slate-900 focus:bg-slate-100/80 font-medium"
              >
                <User className="h-4 w-4 text-[#1061AF]" />
                <span className="text-sm">Meu perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate({ to: "/configuracoes" })}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:text-slate-900 focus:bg-slate-100/80 font-medium"
              >
                <SettingsIcon className="h-4 w-4 text-slate-500" />
                <span className="text-sm">Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-red-600 focus:bg-red-50 font-bold"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span className="text-sm">Sair da conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="border border-slate-200/80 bg-white p-0 sm:max-w-[440px] overflow-hidden rounded-2xl shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Meu Perfil</DialogTitle>
          </DialogHeader>

          {profileLoading ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-[#1061AF]" />
              Carregando dados do perfil...
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Banner Topo */}
              <div className="relative h-28 w-full bg-gradient-to-r from-[#1061AF] via-[#0E5496] to-[#0B1F33] p-4 flex items-start justify-end">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />
                <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conta Verificada
                </span>
              </div>

              {/* Header com Avatar Flutuante */}
              <div className="px-6 pb-6 pt-0 flex flex-col items-center text-center -mt-14">
                <div className="relative mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#1061AF] to-[#0A3D6E] text-3xl font-black text-white shadow-xl ring-4 ring-white border border-slate-200/40">
                  {profile?.name?.substring(0, 2).toUpperCase() || "DE"}
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {profile?.name || "Deusa Alimentos"}
                </h3>

                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1061AF] border border-blue-200/60 shadow-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1061AF]" />
                  {profile?.role === "ADMIN" ? "Administrador de Sistema" : profile?.role || "Consultor Comercial"}
                </div>

                {/* Cards de Informações */}
                <div className="mt-6 w-full space-y-2.5 text-left">
                  {/* Email */}
                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1061AF] border border-blue-100">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        E-mail Corporativo
                      </div>
                      <div className="truncate text-sm font-bold text-slate-800">
                        {profile?.email || "deusaalimentos01@gmail.com"}
                      </div>
                    </div>
                  </div>

                  {/* Região */}
                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Região de Atuação
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        São Paulo ({profile?.location || "SP"})
                      </div>
                    </div>
                  </div>

                  {/* Nível de Acesso */}
                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Nível de Acesso
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        Acesso Completo (Full Access)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="mt-6 w-full space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate({ to: "/configuracoes" });
                    }}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1061AF] text-sm font-bold text-white shadow-lg shadow-blue-900/10 transition-all hover:bg-[#0E5496] active:scale-[0.99]"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Gerenciar Configurações da Conta
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Encerrar Sessão
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}

