import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  Store,
  ShoppingCart,
  Package,
  BarChart3,
  LogOut,
  ShieldCheck,
  Receipt,
  Utensils,
  Settings,
  Wallet,
  Menu,
  Smartphone,
  Users,
  MessageSquare,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavLink {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const links: NavLink[] = [
  { to: "/dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/controle", label: "Controle rápido", icon: <Smartphone className="h-4 w-4" /> },
  { to: "/pdv", label: "Frente de Caixa", icon: <ShoppingCart className="h-4 w-4" /> },
  { to: "/mesas", label: "Mesas", icon: <Utensils className="h-4 w-4" /> },
  { to: "/produtos", label: "Produtos & Estoque", icon: <Package className="h-4 w-4" /> },
  { to: "/clientes", label: "Clientes", icon: <Users className="h-4 w-4" /> },
  { to: "/vendas", label: "Vendas", icon: <Receipt className="h-4 w-4" /> },
  { to: "/financeiro", label: "Financeiro", icon: <Wallet className="h-4 w-4" /> },
  { to: "/mensagens", label: "Mensagens", icon: <MessageSquare className="h-4 w-4" /> },
  { to: "/configuracoes", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
  { to: "/usuarios", label: "Usuários", icon: <ShieldCheck className="h-4 w-4" />, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, isAdmin, signOut } = useAuth();
  const isSupport = roles.includes("support" as any);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const [broadcastUnread, setBroadcastUnread] = useState(0);

  useEffect(() => {
    if (!user) { setAvatarUrl(null); return; }
    let cancel = false;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancel) setAvatarUrl((data as any)?.avatar_url ?? null); });
    return () => { cancel = true; };
  }, [user?.id]);

  const refreshCounts = useCallback(async () => {
    if (!user) { setSupportUnread(0); setBroadcastUnread(0); return; }
    // Support tickets unread:
    // - Support staff (role 'support') vê todas mensagens pendentes de tickets abertos/em atendimento
    // - Demais usuários (incluindo admins de tenant) só veem o que é PRA ELES (seus próprios tickets)
    if (isSupport) {
      const { data } = await supabase
        .from("support_tickets")
        .select("support_unread,status")
        .in("status", ["open", "in_progress"]);
      setSupportUnread((data ?? []).reduce((s, t: any) => s + (t.support_unread || 0), 0));
    } else {
      const { data } = await supabase
        .from("support_tickets")
        .select("user_unread")
        .eq("user_id", user.id);
      setSupportUnread((data ?? []).reduce((s, t: any) => s + (t.user_unread || 0), 0));
    }
    // Broadcasts unread (avisos do sistema vão para todos)
    const { data: bcs } = await supabase
      .from("broadcasts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(100);
    const ids = (bcs ?? []).map((b: any) => b.id);
    if (ids.length === 0) { setBroadcastUnread(0); return; }
    const { data: reads } = await supabase
      .from("broadcast_reads")
      .select("broadcast_id")
      .eq("user_id", user.id)
      .in("broadcast_id", ids);
    const readSet = new Set((reads ?? []).map((r: any) => r.broadcast_id));
    setBroadcastUnread(ids.filter((id) => !readSet.has(id)).length);
  }, [user?.id, isSupport]);

  useEffect(() => {
    refreshCounts();
    if (!user) return;
    const ch = supabase
      .channel("appshell-notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_reads", filter: `user_id=eq.${user.id}` }, () => refreshCounts())
      .subscribe();
    const interval = setInterval(refreshCounts, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [user?.id, refreshCounts]);

  // Refresh when navigating away from /mensagens (counts likely changed)
  useEffect(() => { refreshCounts(); }, [location.pathname, refreshCounts]);

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const roleLabel = isAdmin
    ? "Administrador"
    : roles.includes("manager")
    ? "Gerente"
    : roles.includes("cashier")
    ? "Caixa"
    : "Sem permissão";

  const totalMsgUnread = supportUnread + broadcastUnread;

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {links.map((l) => {
        if (l.adminOnly && !isAdmin) return null;
        const active = location.pathname === l.to;
        const isMsgs = l.to === "/mensagens";
        return (
          <Link
            key={l.to}
            to={l.to}
            onClick={onItemClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            {l.icon}
            <span className="flex-1">{l.label}</span>
            {isMsgs && totalMsgUnread > 0 && (
              <span className="flex items-center gap-1">
                {supportUnread > 0 && (
                  <span
                    title={`${supportUnread} mensagem(ns) de suporte não lida(s)`}
                    className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {supportUnread > 99 ? "99+" : supportUnread}
                  </span>
                )}
                {broadcastUnread > 0 && (
                  <span
                    title={`${broadcastUnread} aviso(s) do sistema não lido(s)`}
                    className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {broadcastUnread > 99 ? "99+" : broadcastUnread}
                  </span>
                )}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const Footer = () => (
    <div className="border-t border-sidebar-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-9 w-9">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabel}</p>
        </div>
      </div>
      <Button
        onClick={handleLogout}
        variant="ghost"
        size="sm"
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4 mr-2" /> Sair
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg">SmartVenda PDV</span>
        </div>
        <NavList />
        <Footer />
      </aside>

      {/* Conteúdo + topbar mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
              <SheetHeader className="px-6 py-4 border-b border-sidebar-border">
                <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Store className="h-4 w-4" />
                  </div>
                  SmartVenda PDV
                </SheetTitle>
              </SheetHeader>
              <NavList onItemClick={() => setMobileOpen(false)} />
              <Footer />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm">SmartVenda PDV</span>
          </div>
          <div className="w-9" /> {/* spacer */}
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
