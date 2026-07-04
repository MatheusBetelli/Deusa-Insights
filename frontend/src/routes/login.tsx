import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Map,
  ShieldCheck,
  Target,
} from "lucide-react";
import { DeusaLogo } from "@/components/app/Logo";

import { AuthService } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && AuthService.isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("rafael.mendes@deusa.com.br");
  const [password, setPassword] = useState("••••••••");

  const benefits = [
    { icon: Map, title: "Mapa de oportunidades" },
    { icon: Target, title: "Priorização de oportunidades" },
    { icon: CheckCircle2, title: "Recomendações por CNPJ" },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      AuthService.login(email);
      navigate({ to: "/dashboard" });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] lg:flex">
      {/* Lado Esquerdo - Institucional */}
      <section
        className="hidden lg:flex relative min-h-screen w-[44%] overflow-hidden px-14 py-12 text-white"
        style={{ background: "#061527" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,97,175,0.12),transparent_70%)]" />
        
        <div className="relative z-10 flex w-full flex-col">
          <div className="flex items-center gap-3 mb-24">
            <DeusaLogo className="h-10 w-auto" />
            <div className="h-6 w-px bg-white/20" />
            <div className="text-[13px] font-bold tracking-[0.1em] uppercase text-blue-100/60">Deusa Analytics</div>
          </div>

          <div className="max-w-[440px]">
            <h1 className="text-[2rem] font-bold leading-[1.25] tracking-tight text-white mb-5">
              Dados comerciais para <br />
              expansão regional
            </h1>
            <p className="text-[15px] leading-relaxed text-blue-100/60 mb-10">
              Identifique cidades, regiões e clientes com maior potencial de venda em um painel interno simples e estratégico.
            </p>

            <div className="space-y-2.5">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur-sm transition hover:bg-white/[0.09]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#FFF200]/10 text-[#FFF200] ring-1 ring-[#FFF200]/20">
                    <benefit.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-blue-50/90">{benefit.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lado Direito - Login */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 bg-white lg:bg-[#F8FAFC]">
        <div className="w-full max-w-[465px]">
          <div className="mb-12 flex justify-center lg:hidden">
            <DeusaLogo className="h-10 w-auto" />
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-10 shadow-[0_30px_70px_-20px_rgba(15,23,42,0.15)] sm:p-12">
            {/* Linha fina azul no topo */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-[#1061AF]" />
            
            <div className="mb-10 flex flex-col items-center">
              <DeusaLogo className="h-9 w-auto mb-8" />
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Acesso interno
              </h2>
              <p className="mt-2 text-center text-sm text-slate-500 font-medium">
                Entre com seu e-mail corporativo para acessar o Deusa Analytics.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@deusa.com.br"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5"
                    required
                  />
                  </div>
                  </div>

                  <div className="space-y-2.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">
                  Senha
                  </label>
                  <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50/30 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600/20"
                    defaultChecked
                  />
                  <span className="text-[13px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Manter conectado</span>
                </label>
                <button type="button" className="text-[13px] font-bold text-[#1061AF] hover:text-blue-700 transition-colors">
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="relative group mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-[15px] font-bold text-white shadow-lg shadow-blue-900/10 transition-all hover:bg-[#0E5496] hover:shadow-blue-900/20 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Entrar na plataforma
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 pt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600/50" />
                Ambiente restrito para usuários autorizados
              </div>
            </form>
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-[12px] font-semibold text-slate-400">
              © 2026 Deusa Alimentos - Inteligência Comercial
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
