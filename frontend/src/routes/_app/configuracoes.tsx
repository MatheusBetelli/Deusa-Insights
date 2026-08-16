import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthService, type User } from "@/lib/auth";
import { formatCnae, formatDateTime } from "@/lib/commercial-formatters";
import { importsService } from "@/services/importsService";
import { usersService } from "@/services/usersService";
import type { ImportJob } from "@/types/importJob";
import type { UserSummary } from "@/types/lead";
import { ArrowRight, Bell, Database, ExternalLink, Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/configuracoes")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const user = AuthService.getUser();
      if (user && user.role?.toUpperCase() === "SALES") {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: Settings,
});

type Panel = "data" | "team" | "notifications" | "governance" | null;

const cards = [
  {
    id: "data" as const,
    icon: Database,
    title: "Fontes de dados",
    text: "Integrações ativas, consulta de CNPJs e histórico de atualizações.",
  },
  {
    id: "team" as const,
    icon: Users,
    title: "Equipe comercial",
    text: "Usuários cadastrados, níveis de acesso e distribuição de leads.",
  },
  {
    id: "governance" as const,
    icon: ShieldCheck,
    title: "Governança",
    text: "Controle de acesso por perfil (RBAC), segurança e regras cadastrais.",
  },
];

const jobStatusLabels: Record<string, { label: string; class: string }> = {
  SUCCESS: { label: "Concluído", class: "text-emerald-700 font-bold" },
  COMPLETED: { label: "Concluído", class: "text-emerald-700 font-bold" },
  RUNNING: { label: "Em processamento", class: "text-[#1061AF] font-bold" },
  PROCESSING: { label: "Em processamento", class: "text-[#1061AF] font-bold" },
  PENDING: { label: "Aguardando", class: "text-slate-600 font-bold" },
  FAILED: { label: "Erro", class: "text-red-700 font-bold" },
  ERROR: { label: "Erro", class: "text-red-700 font-bold" },
};

function Settings() {
  const [panel, setPanel] = useState<Panel>(null);
  const [loading, setLoading] = useState(false);
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [profile, setProfile] = useState<User | null>(AuthService.getUser());

  async function openPanel(nextPanel: Panel) {
    setPanel(nextPanel);
    setLoading(true);
    try {
      if (nextPanel === "data") setImports(await importsService.getImports());
      if (nextPanel === "team") setUsers(await usersService.getUsers());
      if (nextPanel === "governance") setProfile(await AuthService.getProfile());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível carregar as configurações.",
      );
    } finally {
      setLoading(false);
    }
  }

  const activeCard = cards.find((card) => card.id === panel);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">Sistema</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">Configurações</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Parâmetros internos para operação comercial, acesso e atualização de dados.
          </p>
        </div>
      </div>

      <section className="grid gap-3 lg:grid-cols-2">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => void openPanel(item.id)}
              className="group rounded-xl border border-[#DDE5EF] bg-white p-5 text-left shadow-sm transition-all hover:border-[#1061AF] hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0B1F33] text-[#FFF200]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold leading-snug text-[#0B1F33]">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748B]">{item.text}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-[#CBD5E1] transition group-hover:text-[#1061AF]" />
              </div>
            </button>
          );
        })}
      </section>

      <Dialog open={!!panel} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="max-w-2xl border-[#DDE5EF] bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0B1F33]">
              {activeCard?.title ?? "Configuração"}
            </DialogTitle>
            <DialogDescription>{activeCard?.text}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex h-36 items-center justify-center text-sm font-semibold text-[#64748B]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#1061AF]" />
              Carregando...
            </div>
          ) : (
            <>
              {panel === "data" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-xs text-[#475569]">
                    <span className="font-bold text-[#0B1F33]">Integrações ativas:</span> Receita Federal (ReceitaWS) para enriquecimento de CNPJs e inteligência territorial Google Places.
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0B1F33]">Últimas importações executadas</span>
                    <div className="flex items-center gap-3 text-xs">
                      <Link to="/importar-cnpjs" className="inline-flex items-center gap-1 font-bold text-[#1061AF] hover:underline">
                        Importar CNPJs <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Link to="/base-de-dados" className="inline-flex items-center gap-1 font-bold text-[#1061AF] hover:underline">
                        Ver base <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-[#DDE5EF]">
                    {imports.length === 0 ? (
                      <p className="p-4 text-sm text-[#64748B]">Nenhuma importação registrada.</p>
                    ) : (
                      imports.slice(0, 15).map((job) => {
                        const st = jobStatusLabels[job.status.toUpperCase()] ?? { label: job.status, class: "text-slate-700" };
                        return (
                          <div
                            key={job.id}
                            className="border-b border-[#EEF2F7] px-4 py-2.5 last:border-0 hover:bg-[#F8FAFC]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-bold text-[#0B1F33]">
                                {job.cityName}/{job.uf} · {formatCnae(job.cnaeCode)}
                              </span>
                              <span className={`text-xs ${st.class}`}>{st.label}</span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#64748B]">
                              <span>Encontrados: {job.totalFound} · Salvos: {job.totalSaved}</span>
                              <span>{formatDateTime(job.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {panel === "team" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0B1F33]">Usuários com acesso ao sistema</span>
                    <Link to="/leads-b2b" className="inline-flex items-center gap-1 text-xs font-bold text-[#1061AF] hover:underline">
                      Gerenciar atribuições <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="grid gap-2 max-h-72 overflow-y-auto">
                    {users.length === 0 ? (
                      <p className="text-sm text-[#64748B]">Nenhum usuário encontrado.</p>
                    ) : (
                      users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-4 py-3"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#0B1F33]">{user.name}</div>
                            <div className="mt-0.5 text-[11px] text-[#64748B]">{user.email}</div>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#1061AF] border border-[#DDE5EF]">
                            {user.role === "ADMIN" ? "Administrador" : "Vendedor Comercial"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {panel === "notifications" && (
                <div className="space-y-3">
                  {[
                    { label: "Oportunidades críticas (Score ≥ 80)", desc: "Notificação em tela para novos leads de altíssimo potencial." },
                    { label: "Leads aguardando contato", desc: "Alerta operacional de oportunidades sem interação há mais de 48h." },
                    { label: "Importações de CNPJs concluídas", desc: "Aviso de finalização do lote de busca com total de empresas salvas." },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#0B1F33]">{item.label}</div>
                        <div className="mt-0.5 text-[11px] text-[#64748B]">{item.desc}</div>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                        Ativo
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {panel === "governance" && (
                <div className="grid gap-3 text-xs">
                  <Info label="Usuário autenticado" value={profile?.name ?? "–"} />
                  <Info label="E-mail" value={profile?.email ?? "–"} />
                  <Info label="Perfil de acesso" value={profile?.role === "ADMIN" ? "Administrador do Sistema (Acesso total)" : "Vendedor Comercial"} />
                  <Info
                    label="Políticas ativas"
                    value="Autenticação JWT, controle por papel (RBAC), atualização por CNPJ único e histórico auditável de interações."
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3.5 py-2.5">
      <div className="text-[11px] font-bold uppercase text-[#64748B]">{label}</div>
      <div className="mt-1 text-xs font-semibold text-[#0B1F33]">{value}</div>
    </div>
  );
}
