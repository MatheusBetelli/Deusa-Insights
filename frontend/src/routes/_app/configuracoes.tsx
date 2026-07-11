import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthService, type User } from "@/lib/auth";
import { importsService } from "@/services/importsService";
import { usersService } from "@/services/usersService";
import type { ImportJob } from "@/types/importJob";
import type { UserSummary } from "@/types/lead";
import { ArrowRight, Bell, Database, Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: Settings,
});

type Panel = "data" | "team" | "notifications" | "governance" | null;

const cards = [
  {
    id: "data" as const,
    icon: Database,
    title: "Fontes de dados",
    text: "CNPJs, base interna de clientes, CNAEs monitorados e histórico de importações.",
  },
  {
    id: "team" as const,
    icon: Users,
    title: "Equipe comercial",
    text: "Responsáveis, perfis de acesso e distribuição operacional dos leads.",
  },
  {
    id: "notifications" as const,
    icon: Bell,
    title: "Notificações",
    text: "Alertas para oportunidades críticas, leads sem contato e importações concluídas.",
  },
  {
    id: "governance" as const,
    icon: ShieldCheck,
    title: "Governança",
    text: "Controle de acesso, trilhas operacionais e regras de descarte de oportunidades.",
  },
];

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
              className="group rounded-xl border border-[#DDE5EF] bg-white p-5 text-left shadow-sm transition-all hover:border-[#1061AF] hover:shadow-md"
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
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-sm text-[#475569]">
                    Atualizações futuras devem ser centralizadas aqui ou na Base de Dados. Web
                    scraping não foi habilitado nesta etapa.
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-[#DDE5EF]">
                    {imports.length === 0 ? (
                      <p className="p-4 text-sm text-[#64748B]">Nenhuma importação registrada.</p>
                    ) : (
                      imports.slice(0, 20).map((job) => (
                        <div
                          key={job.id}
                          className="border-b border-[#EEF2F7] px-4 py-3 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold text-[#0B1F33]">
                              {job.cityName}/{job.uf} · {job.cnaeCode}
                            </span>
                            <span className="text-xs font-bold text-[#64748B]">{job.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-[#64748B]">
                            Encontrados: {job.totalFound} · Salvos: {job.totalSaved}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {panel === "team" && (
                <div className="grid gap-2">
                  {users.length === 0 ? (
                    <p className="text-sm text-[#64748B]">Nenhum usuário encontrado.</p>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.id}
                        className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2"
                      >
                        <div className="text-sm font-bold text-[#0B1F33]">{user.name}</div>
                        <div className="mt-0.5 text-xs text-[#64748B]">
                          {user.email} · {user.role}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {panel === "notifications" && (
                <div className="grid gap-3">
                  {[
                    "Oportunidades críticas",
                    "Leads sem contato recente",
                    "Importações concluídas",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2"
                    >
                      <span className="text-sm font-bold text-[#0B1F33]">{item}</span>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-[#1061AF] ring-1 ring-[#DDE5EF]">
                        Ativo
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-[#64748B]">
                    Persistência granular de preferências depende de regra de negócio e endpoint
                    específico.
                  </p>
                </div>
              )}

              {panel === "governance" && (
                <div className="grid gap-3">
                  <Info label="Usuário autenticado" value={profile?.name ?? "-"} />
                  <Info label="E-mail" value={profile?.email ?? "-"} />
                  <Info label="Perfil" value={profile?.role ?? "-"} />
                  <Info
                    label="Regras ativas"
                    value="Autenticação JWT, permissões por perfil e registro de interações comerciais."
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
    <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2">
      <div className="text-[11px] font-bold uppercase text-[#64748B]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#0B1F33]">{value}</div>
    </div>
  );
}
