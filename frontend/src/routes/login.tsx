import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { DeusaLogo } from "@/components/layout/Logo";

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
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  
  // Login form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handlePasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      await AuthService.login(email, password, rememberMe);
      navigate({ to: "/dashboard" });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const res = await AuthService.forgotPassword(forgotEmail);
      setForgotSuccess(res.message);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Não foi possível processar a solicitação.");
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotMode = () => {
    setForgotEmail(email);
    setForgotError(null);
    setForgotSuccess(null);
    setMode("forgot");
  };

  const openLoginMode = () => {
    setLoginError(null);
    setMode("login");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6 py-12">
      <main className="w-full max-w-[465px] flex flex-col items-center">
        <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/60 sm:p-12 transition-all">
          {/* Linha fina azul no topo */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[#1061AF]" />

            {mode === "login" ? (
              <>
                <div className="mb-8 flex flex-col items-center">
                  <DeusaLogo className="h-10 w-auto mb-6" />
                  <span className="mb-3 inline-flex items-center rounded-full bg-blue-50/90 px-3 py-1 text-[10px] font-bold tracking-widest text-[#1061AF] uppercase border border-blue-200/70">
                    Deusa Analytics
                  </span>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    Acesso interno
                  </h2>
                  <p className="mt-1.5 text-center text-sm text-slate-500 font-medium">
                    Entre com seu e-mail corporativo para acessar a plataforma.
                  </p>
                </div>

              <form onSubmit={submitLogin} className="space-y-6">
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 ml-0.5">
                    E-mail corporativo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@deusa.com.br"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition duration-150 hover:border-slate-300 focus:border-[#1061AF] focus:ring-4 focus:ring-[#1061AF]/15"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 ml-0.5">
                      Senha
                    </label>
                    {capsLockOn && (
                      <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Caps Lock ativado
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handlePasswordKey}
                      onKeyUp={handlePasswordKey}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-11 text-sm font-medium text-slate-900 shadow-sm outline-none transition duration-150 hover:border-slate-300 focus:border-[#1061AF] focus:ring-4 focus:ring-[#1061AF]/15"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1 rounded"
                      title={showPassword ? "Ocultar senha" : "Exibir senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600/20"
                    />
                    <span className="text-[13px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                      Manter conectado
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={openForgotMode}
                    className="text-[13px] font-bold text-[#1061AF] hover:text-blue-700 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                {loginError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="relative group mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-[15px] font-bold text-white shadow-md shadow-[#1061AF]/20 transition-all hover:bg-[#0E5496] hover:shadow-lg hover:shadow-[#1061AF]/30 active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none"
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
            </>
          ) : (
            <>
              <div className="mb-8 flex flex-col items-center">
                <DeusaLogo className="h-9 w-auto mb-8" />
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Recuperar senha
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500 font-medium leading-relaxed">
                  Informe seu e-mail corporativo abaixo para receber o link de redefinição de senha.
                </p>
              </div>

              {forgotSuccess ? (
                <div className="space-y-6">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      Instruções enviadas!
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      {forgotSuccess}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openLoginMode}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-sm font-bold text-white shadow-md hover:bg-[#0E5496] transition-all"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <form onSubmit={submitForgot} className="space-y-6">
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 ml-0.5">
                      E-mail corporativo
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="nome@deusa.com.br"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-[#1061AF] focus:bg-white focus:ring-4 focus:ring-[#1061AF]/10"
                        required
                      />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="relative group mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-[15px] font-bold text-white shadow-lg shadow-blue-900/10 transition-all hover:bg-[#0E5496] hover:shadow-blue-900/20 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {forgotLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Enviar instruções de recuperação
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={openLoginMode}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Voltar ao login
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        <div className="mt-8 text-center space-y-1">
          <p className="text-[12px] font-semibold text-slate-500">
            © 2026 Deusa Alimentos - Inteligência Comercial
          </p>
          <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Conformidade LGPD garantida (Lei nº 13.709/2018)
          </p>
        </div>
      </main>
    </div>
  );
}
