import { Bell, Search, LogOut, User, Lock, ChevronDown, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { AuthService } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function Topbar() {
  const navigate = useNavigate();
  const user = AuthService.getUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    AuthService.logout();
    navigate({ to: "/login" });
    toast.success("Sessão encerrada com sucesso");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    toast.info(`Buscando por: ${searchQuery}`);
    if (searchQuery.length > 10 && !isNaN(Number(searchQuery.replace(/\D/g, "")))) {
      navigate({ to: "/leads-b2b" });
    }
  };

  const notifications = [
    { id: 1, title: "Base de leads B2B atualizada", time: "Há 10 min", icon: CheckCircle2, color: "text-green-500" },
    { id: 2, title: "Nova região prioritária identificada", time: "Há 2 horas", icon: Bell, color: "text-[#1061AF]" },
    { id: 3, title: "Leads críticos aguardam contato", time: "Há 5 horas", icon: Clock, color: "text-amber-500" },
  ];

  return (
    <header className="h-16 shrink-0 border-b border-[#DDE5EF] bg-white px-4 shadow-sm shadow-slate-200/40 lg:px-8">
      <div className="flex h-full items-center gap-4">
      <form onSubmit={handleSearch} className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cidade, CNAE, CNPJ ou lead..."
          className="w-full h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-10 pr-3 text-sm text-[#0B1F33] placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#1061AF] focus:ring-2 focus:ring-[#1061AF]/15 transition"
        />
      </form>
      
      <div className="hidden items-center gap-2 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2 text-xs text-[#64748B] md:flex">
        <RefreshCw className="h-3.5 w-3.5 text-[#1061AF]" />
        <span>Dados atualizados:</span>
        <span className="font-semibold text-[#0B1F33]">18/06/2026, 08:42</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative h-10 w-10 rounded-lg hover:bg-slate-100 flex items-center justify-center transition outline-none">
            <Bell className="h-[18px] w-[18px] text-[#0B1F33]" />
            <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[#ED1C24] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              3
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
          <DropdownMenuLabel className="px-4 py-3 bg-slate-50 border-b border-slate-100">Notificações</DropdownMenuLabel>
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer focus:bg-slate-50 border-b border-slate-50 last:border-0">
                  <div className={`mt-0.5 ${n.color}`}>
                    <n.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{n.time}</div>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma notificação no momento.</div>
            )}
          </div>
          <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
            <button className="text-xs font-bold text-[#1061AF] hover:underline">Ver todas</button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-3 pl-3 border-l border-[#DDE5EF] cursor-pointer group outline-none">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-[#0B1F33] leading-tight group-hover:text-[#1061AF] transition-colors">
                {mounted ? (user?.name || "Usuário") : "Usuário"}
              </div>
              <div className="text-[11px] text-[#64748B] flex items-center justify-end gap-1">
                {mounted ? (user?.role || "Comercial") : "Comercial"} · {mounted ? (user?.location || "SP") : "SP"}
                <ChevronDown className="h-3 w-3" />
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1061AF] to-[#0F58A0] text-white text-sm font-semibold flex items-center justify-center shadow-sm">
              {mounted ? (user?.name?.substring(0, 2).toUpperCase() || "U") : "U"}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-1">
          <DropdownMenuLabel className="px-2 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Minha Conta</DropdownMenuLabel>
          <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 cursor-pointer focus:bg-slate-50 rounded-md">
            <User className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">Meu perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 cursor-pointer focus:bg-slate-50 rounded-md">
            <Lock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">Alterar senha</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer focus:bg-red-50 text-red-600 rounded-md"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-bold">Sair da conta</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
