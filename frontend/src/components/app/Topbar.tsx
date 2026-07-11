import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  LogOut,
  Search,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(user);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

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

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordLoading(true);
    try {
      const response = await AuthService.changePassword(passwordForm);
      toast.success(response.message);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setPasswordLoading(false);
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-lg outline-none transition hover:bg-slate-100">
              <Bell className="h-[18px] w-[18px] text-[#0B1F33]" />
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ED1C24] text-[10px] font-bold text-white ring-2 ring-white">
                {notifications.length}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 overflow-hidden p-0">
            <DropdownMenuLabel className="border-b border-slate-100 bg-slate-50 px-4 py-3">
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
            <div className="border-t border-slate-100 bg-slate-50 p-2 text-center">
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
            <button className="group flex items-center gap-3 border-l border-[#DDE5EF] pl-3 outline-none">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold leading-tight text-[#0B1F33] transition-colors group-hover:text-[#1061AF]">
                  {mounted ? user?.name || "Usuário" : "Usuário"}
                </div>
                <div className="flex items-center justify-end gap-1 text-[11px] text-[#64748B]">
                  {mounted ? user?.role || "Comercial" : "Comercial"} ·{" "}
                  {mounted ? user?.location || "SP" : "SP"}
                  <ChevronDown className="h-3 w-3" />
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1061AF] to-[#0F58A0] text-sm font-semibold text-white shadow-sm">
                {mounted ? user?.name?.substring(0, 2).toUpperCase() || "U" : "U"}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1">
            <DropdownMenuLabel className="px-2 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              Minha Conta
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => void openProfile()}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 focus:bg-slate-50"
            >
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium">Meu perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setPasswordOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 focus:bg-slate-50"
            >
              <Lock className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium">Alterar senha</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-red-600 focus:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-bold">Sair da conta</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="border-[#DDE5EF] bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0B1F33]">Meu perfil</DialogTitle>
            <DialogDescription>Dados reais do usuário autenticado.</DialogDescription>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex h-32 items-center justify-center text-sm font-semibold text-[#64748B]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#1061AF]" />
              Carregando perfil...
            </div>
          ) : (
            <div className="grid gap-3">
              <ProfileRow label="Nome" value={profile?.name ?? "-"} />
              <ProfileRow label="E-mail" value={profile?.email ?? "-"} />
              <ProfileRow label="Perfil" value={profile?.role ?? "-"} />
              <ProfileRow label="Localização" value={profile?.location ?? "SP"} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="border-[#DDE5EF] bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0B1F33]">Alterar senha</DialogTitle>
            <DialogDescription>
              Informe a senha atual e defina uma nova senha de acesso.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="grid gap-3">
            <PasswordInput
              label="Senha atual"
              value={passwordForm.currentPassword}
              onChange={(value) =>
                setPasswordForm((current) => ({ ...current, currentPassword: value }))
              }
            />
            <PasswordInput
              label="Nova senha"
              value={passwordForm.newPassword}
              onChange={(value) =>
                setPasswordForm((current) => ({ ...current, newPassword: value }))
              }
            />
            <PasswordInput
              label="Confirmar nova senha"
              value={passwordForm.confirmPassword}
              onChange={(value) =>
                setPasswordForm((current) => ({ ...current, confirmPassword: value }))
              }
            />
            <button
              type="submit"
              disabled={passwordLoading}
              className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF] disabled:opacity-60"
            >
              {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Alterar senha
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2">
      <div className="text-[11px] font-bold uppercase text-[#64748B]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#0B1F33]">{value}</div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#64748B]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
      />
    </label>
  );
}
