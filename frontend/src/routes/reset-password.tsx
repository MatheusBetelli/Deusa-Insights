import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Check,
} from "lucide-react";
import { DeusaLogo } from "@/components/layout/Logo";
import { AuthService } from "@/lib/auth";

type SearchParams = {
  token?: string;
  mode?: "reset" | "invite";
};

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      token: (search.token as string) || "",
      mode: search.mode === "invite" ? "invite" : "reset",
    };
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token: legacyQueryToken, mode } = Route.useSearch();
  const [token] = useState(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const resolvedToken = fragmentToken?.trim() || legacyQueryToken?.trim() || "";
    if (resolvedToken) {
      const sanitizedUrl = new URL(window.location.href);
      sanitizedUrl.hash = "";
      sanitizedUrl.searchParams.delete("token");
      window.history.replaceState(
        window.history.state,
        "",
        `${sanitizedUrl.pathname}${sanitizedUrl.search}`,
      );
    }
    return resolvedToken;
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handlePasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const isStrongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/.test(
    newPassword,
  );
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Token de redefinição ausente ou inválido.");
      return;
    }

    if (!isStrongPassword) {
      setError("A nova senha deve ter 12 caracteres, maiúscula, minúscula, número e símbolo.");
      return;
    }

    if (!isMatch) {
      setError("As senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        token,
        newPassword,
        confirmPassword,
      };
      const res =
        mode === "invite"
          ? await AuthService.setPassword(payload)
          : await AuthService.resetPassword(payload);
      setSuccess(res.message);
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6 py-12">
      <main className="w-full max-w-[465px] flex flex-col items-center">
        <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-10 shadow-[0_30px_70px_-20px_rgba(15,23,42,0.15)] sm:p-12 transition-all">
          {/* Linha fina azul no topo */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[#1061AF]" />

          <div className="mb-8 flex flex-col items-center">
            <DeusaLogo className="h-9 w-auto mb-8" />
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-[#1061AF] mb-4">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {mode === "invite" ? "Definir senha" : "Redefinir senha"}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 font-medium leading-relaxed">
              {mode === "invite"
                ? "Crie sua senha para ativar o acesso ao Deusa Analytics."
                : "Crie uma nova senha segura para acessar sua conta no Deusa Analytics."}
            </p>
          </div>

          {!token ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Link de redefinição ausente</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Não encontramos um token válido no link acessado. Por favor, solicite um novo
                    link de recuperação.
                  </p>
                </div>
              </div>

              <Link
                to="/login"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-sm font-bold text-white shadow-md hover:bg-[#0E5496] transition-all"
              >
                Voltar ao login
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  Senha alterada com sucesso!
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {success} Redirecionando para o login em instantes...
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate({ to: "/login" })}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-sm font-bold text-white shadow-md hover:bg-[#0E5496] transition-all"
              >
                Ir para o login agora
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Campo Nova Senha */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">
                    Nova Senha
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
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={handlePasswordKey}
                    onKeyUp={handlePasswordKey}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50/30 pl-11 pr-11 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1 rounded"
                    title={showNewPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Campo Confirmar Nova Senha */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50/30 pl-11 pr-11 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1 rounded"
                    title={showConfirmPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Indicadores de Requisitos */}
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs space-y-1.5 text-slate-600">
                <div className="flex items-center gap-2">
                  {isStrongPassword ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-1 shrink-0" />
                  )}
                  <span className={isStrongPassword ? "text-emerald-700 font-medium" : ""}>
                    12 caracteres, maiúscula, minúscula, número e símbolo
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isMatch ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1 mr-1 shrink-0" />
                  )}
                  <span className={isMatch ? "text-emerald-700 font-medium" : ""}>
                    As senhas são iguais
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isStrongPassword || !isMatch}
                className="relative group mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1061AF] text-[15px] font-bold text-white shadow-lg shadow-blue-900/10 transition-all hover:bg-[#0E5496] hover:shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === "invite" ? "Ativar minha conta" : "Redefinir senha"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 pt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600/50" />
                Ambiente restrito para usuários autorizados
              </div>
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-[12px] font-semibold text-slate-500">
            © 2026 Deusa Alimentos - Inteligência Comercial
          </p>
        </div>
      </main>
    </div>
  );
}
