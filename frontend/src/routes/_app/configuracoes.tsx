import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthService, type User } from "@/lib/auth";
import { usersService } from "@/services/usersService";
import type { UserSummary } from "@/types/lead";
import {
  CheckCircle2,
  Database,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { redirect } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type TabType = "profile" | "team" | "parameters" | "governance";

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [user, setUser] = useState<User | null>(AuthService.getUser());
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  const [resetEmail, setResetEmail] = useState(user?.email || "");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setResetEmail(user.email);
    }
  }, [user?.email]);

  async function handleRequestPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setSendingReset(true);
    try {
      const res = await AuthService.forgotPassword(resetEmail.trim());
      toast.success(
        res.message || `Link de redefinição enviado para ${resetEmail.trim()} com sucesso!`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível solicitar a redefinição de senha.",
      );
    } finally {
      setSendingReset(false);
    }
  }

  // Users state
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "MANAGER" | "SALES";
  }>({
    name: "",
    email: "",
    password: "",
    role: "SALES",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadProfile();
    void loadUsers();
  }, []);

  async function loadProfile() {
    try {
      const p = await AuthService.getProfile();
      setUser(p);
    } catch {
      // Fallback to local storage user
      setUser(AuthService.getUser());
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const list = await usersService.getUsers();
      setUsers(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar lista de usuários.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim() || newUserForm.password.length < 8) {
      toast.error("Preencha nome, e-mail e uma senha com no mínimo 8 caracteres.");
      return;
    }
    setCreatingUser(true);
    try {
      await usersService.createUser({
        name: newUserForm.name,
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role,
      });
      toast.success(`Usuário ${newUserForm.name} cadastrado com sucesso!`);
      setNewUserForm({ name: "", email: "", password: "", role: "SALES" });
      setAddUserOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar usuário.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleDeleteUser(id: string) {
    if (deletingUserId) return;
    setDeletingUserId(id);
    try {
      await usersService.deleteUser(id);
      toast.success("Usuário removido com sucesso.");
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover usuário.");
    } finally {
      setDeletingUserId(null);
    }
  }

  function handleLogout() {
    AuthService.logout();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      {/* ── Navigation Tabs ── */}
      <div className="flex flex-wrap gap-2 border-b border-[#DDE5EF] pb-3">
        {[
          { id: "profile", label: "Meu Perfil & Credenciais", icon: KeyRound },
          { id: "team", label: "Equipe Comercial", icon: Users },
          { id: "parameters", label: "Parâmetros da Operação", icon: Database },
          { id: "governance", label: "Governança & Segurança", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#0B1F33] text-white shadow-sm"
                  : "bg-white text-[#64748B] border border-[#DDE5EF] hover:bg-[#F8FAFC] hover:text-[#0B1F33]"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-[#FFF200]" : "text-[#94A3B8]"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: MEU PERFIL & CREDENCIAIS ── */}
      {activeTab === "profile" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Card: Dados do Perfil */}
          <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1F33] text-base font-bold text-white shadow-sm">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : "AD"}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0B1F33]">
                    {user?.name || "Administrador Deusa"}
                  </h2>
                  <p className="text-xs text-[#64748B]">{user?.email || "E-mail não carregado"}</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1061AF] border border-blue-200">
                {user?.role === "ADMIN"
                  ? "Administrador de Sistema"
                  : user?.role === "MANAGER"
                    ? "Gestor Comercial"
                    : "Consultor Comercial"}
              </span>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  Nome Cadastrado
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.name || ""}
                  className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0B1F33] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  E-mail de Login
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.email || ""}
                  className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0B1F33] outline-none"
                />
              </div>
            </div>

            <div className="border-t border-[#EEF2F7] pt-4 flex items-center justify-between">
              <span className="text-xs text-[#64748B] font-medium">Sessão ativa autenticada</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Encerrar Sessão
              </button>
            </div>
          </section>

          {/* Card: Solicitacao de Redefinicao via Resend */}
          <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm space-y-4">
            <div className="border-b border-[#EEF2F7] pb-3">
              <h2 className="text-sm font-bold text-[#0B1F33]">Redefinição de Senha por E-mail</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Por motivos de segurança, a redefinição de senha é efetuada enviando um link seguro
                de uso único para o seu e-mail.
              </p>
            </div>

            <form onSubmit={handleRequestPasswordReset} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  E-mail do Usuário Logado
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="seu.email@deusa.com.br"
                  className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-[#1061AF] font-medium leading-relaxed">
                🔒 Um e-mail com o link para redefinir a sua senha será enviado para a sua caixa de
                entrada.
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sendingReset}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white transition hover:bg-[#1061AF] disabled:opacity-60 cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-[#FFF200]" />
                  {sendingReset ? "Enviando e-mail..." : "Enviar Link de Redefinição via E-mail"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── TAB 2: EQUIPE COMERCIAL E USUÁRIOS ── */}
      {activeTab === "team" && (
        <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#EEF2F7] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0B1F33]">Usuários e Equipe do Sistema</h2>
              <p className="text-xs text-[#64748B]">
                Gerencie quem tem acesso ao Deusa Insights. Remova usuários de teste fictícios se
                necessário.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setAddUserOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1061AF] transition cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-[#FFF200]" />
                Cadastrar Novo Usuário
              </button>
            )}
          </div>

          <div className="grid gap-3">
            {loadingUsers ? (
              <p className="p-4 text-xs text-[#64748B]">Carregando equipe...</p>
            ) : users.length === 0 ? (
              <p className="p-4 text-xs text-[#64748B]">Nenhum usuário cadastrado.</p>
            ) : (
              users.map((u) => {
                const isCurrentUser = user?.id === u.id || user?.email === u.email;
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3.5 transition hover:border-[#1061AF]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1F33] text-xs font-bold text-white">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0B1F33]">{u.name}</span>
                          {isCurrentUser && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                              Seu Usuário
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#64748B]">{u.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#1061AF] border border-[#DDE5EF]">
                        {u.role === "ADMIN"
                          ? "Administrador"
                          : u.role === "MANAGER"
                            ? "Gestor Comercial"
                            : "Consultor Comercial"}
                      </span>
                      {isAdmin && !isCurrentUser && u.role !== "ADMIN" && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingUserId === u.id}
                          title="Remover consultor comercial"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ── TAB 3: PARÂMETROS DA OPERAÇÃO ── */}
      {activeTab === "parameters" && (
        <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm space-y-4">
          <div className="border-b border-[#EEF2F7] pb-3">
            <h2 className="text-sm font-bold text-[#0B1F33]">Parâmetros & Regras da Operação</h2>
            <p className="text-xs text-[#64748B]">
              Regras centrais ativas no Deusa Insights para prospecção B2B de farinha e farofa.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-4 space-y-1.5">
              <span className="text-[11px] font-bold uppercase text-[#1061AF]">
                Público-Alvo Comercial
              </span>
              <h3 className="text-xs font-bold text-[#0B1F33]">Categorias Autorizadas (CNAEs)</h3>
              <p className="text-xs text-[#64748B]">
                Supermercados (4711-3/02), Hipermercados (4711-3/01), Minimercados / Mercados
                (4712-1/00) e Açougues (4722-9/01).
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-4 space-y-1.5">
              <span className="text-[11px] font-bold uppercase text-[#1061AF]">
                Score Comercial
              </span>
              <h3 className="text-xs font-bold text-[#0B1F33]">
                Corte de Oportunidade Prioritária
              </h3>
              <p className="text-xs text-[#64748B]">
                Leads com pontuação igual ou superior a <strong>65 pontos</strong> são classificados
                automaticamente como <strong>Alto Potencial / Crítico</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-4 space-y-1.5">
              <span className="text-[11px] font-bold uppercase text-[#1061AF]">
                Delimitação Territorial
              </span>
              <h3 className="text-xs font-bold text-[#0B1F33]">Geofencing Urbano</h3>
              <p className="text-xs text-[#64748B]">
                Raio geodésico máximo de 10 km (cidades padrão) e 15 km (grandes metrópoles) a
                partir do centroide municipal IBGE.
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-4 space-y-1.5">
              <span className="text-[11px] font-bold uppercase text-[#1061AF]">
                Fontes Externa & Custo
              </span>
              <h3 className="text-xs font-bold text-[#0B1F33]">Proteção de APIs Pagas</h3>
              <p className="text-xs text-[#64748B]">
                Prioridade estrita para banco de dados local. Enriquecimento externo executado
                exclusivamente por demanda voluntária.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 4: GOVERNANÇA & SEGURANÇA ── */}
      {activeTab === "governance" && (
        <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm space-y-4">
          <div className="border-b border-[#EEF2F7] pb-3">
            <h2 className="text-sm font-bold text-[#0B1F33]">
              Governança & Segurança da Informação
            </h2>
            <p className="text-xs text-[#64748B]">
              Políticas de controle de acesso, auditoria e segurança dos dados comerciais da Deusa
              Alimentos.
            </p>
          </div>

          <div className="grid gap-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3.5">
              <div>
                <span className="font-bold text-[#0B1F33]">Autenticação JWT & Criptografia</span>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Sessão ativa protegida via JSON Web Tokens com assinatura HMAC SHA-256 e senhas em
                  hash bcrypt.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3.5">
              <div>
                <span className="font-bold text-[#0B1F33]">
                  Controle de Acesso por Perfil (RBAC)
                </span>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Perfis Administrador e Consultor Comercial isolados por escopo de função e
                  permissões no backend NestJS.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3.5">
              <div>
                <span className="font-bold text-[#0B1F33]">Audit Trail & Log de Operações</span>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Registro auditável de importações, alterações no funil comercial e edições de
                  dados de estabelecimentos.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            </div>
          </div>
        </section>
      )}

      {/* ── MODAL: CADASTRAR NOVO USUÁRIO ── */}
      <Dialog open={isAdmin && addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-md border-[#DDE5EF] bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0B1F33]">Cadastrar Novo Usuário</DialogTitle>
            <DialogDescription>
              Adicione um novo membro para acessar a plataforma Deusa Insights.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-3.5 pt-2">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                placeholder="Ex: João da Silva"
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                E-mail Corporativo
              </label>
              <input
                type="email"
                required
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="joao@deusa.com.br"
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                Senha Inicial
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Mínimo de 8 caracteres"
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                Perfil de Acesso
              </label>
              <select
                value={newUserForm.role}
                onChange={(e) =>
                  setNewUserForm({
                    ...newUserForm,
                    role: e.target.value as "ADMIN" | "MANAGER" | "SALES",
                  })
                }
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
              >
                <option value="SALES">Consultor Comercial</option>
                <option value="ADMIN">Administrador de Sistema</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddUserOpen(false)}
                className="h-9 rounded-lg border border-[#DDE5EF] px-3 text-xs font-bold text-[#64748B] hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creatingUser}
                className="h-9 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white hover:bg-[#1061AF] transition cursor-pointer disabled:opacity-60"
              >
                {creatingUser ? "Salvando..." : "Cadastrar Usuário"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
