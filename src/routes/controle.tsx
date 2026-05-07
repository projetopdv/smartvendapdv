import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  Lock,
  Unlock,
  AlertTriangle,
  Package,
  LayoutDashboard,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/controle")({
  head: () => ({
    meta: [
      { title: "Controle rápido — SmartVenda PDV" },
      { name: "description", content: "Visão de bolso da sua loja em tempo real." },
    ],
  }),
  component: () => (
    <AuthGate>
      <ControlePage />
    </AuthGate>
  ),
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ControlePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesToday, setSalesToday] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [register, setRegister] = useState<{ id: string; opening_amount: number; opened_at: string } | null>(null);
  const [lowStock, setLowStock] = useState<Array<{ id: string; name: string; stock: number; min_stock: number }>>([]);

  async function load() {
    setRefreshing(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = today.toISOString();

    const [salesRes, regRes, prodRes] = await Promise.all([
      supabase.from("sales").select("total").gte("created_at", iso),
      supabase.from("cash_registers").select("id, opening_amount, opened_at").eq("status", "open").order("opened_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("products").select("id, name, stock, min_stock").eq("active", true),
    ]);

    const sales = salesRes.data ?? [];
    setSalesToday(sales.reduce((s, r) => s + Number(r.total), 0));
    setSalesCount(sales.length);
    setRegister(regRes.data ?? null);
    setLowStock((prodRes.data ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock)));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header
        className="px-4 pt-6 pb-8 text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <Link to="/escolher" className="inline-flex items-center text-sm text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => void load()} disabled={refreshing}>
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-white/75">Olá, {user?.email?.split("@")[0]}</p>
        <h1 className="text-2xl font-bold mt-1">Controle rápido</h1>
      </header>

      <main className="px-4 -mt-6 space-y-3 max-w-lg mx-auto">
        {/* Vendas do dia */}
        <Card className="bg-gradient-to-br from-primary/95 to-primary text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/70">Vendas hoje</p>
              <p className="text-3xl font-bold mt-1">{fmtBRL(salesToday)}</p>
              <p className="text-sm text-white/80 mt-1">{salesCount} venda{salesCount === 1 ? "" : "s"}</p>
            </div>
            <DollarSign className="h-10 w-10 text-white/40" />
          </div>
        </Card>

        {/* Caixa */}
        <Card>
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${register ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
              {register ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{register ? "Caixa aberto" : "Caixa fechado"}</p>
              {register ? (
                <p className="text-xs text-muted-foreground truncate">
                  Abertura: {fmtBRL(Number(register.opening_amount))} · {new Date(register.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Abra o caixa pelo PDV para começar</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/pdv" })}>
              <ShoppingCart className="h-4 w-4 mr-1" /> PDV
            </Button>
          </div>
        </Card>

        {/* Estoque baixo */}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${lowStock.length ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
              {lowStock.length ? <AlertTriangle className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Estoque baixo</p>
              <p className="text-xs text-muted-foreground">
                {lowStock.length ? `${lowStock.length} produto(s) precisam de reposição` : "Tudo em ordem ✨"}
              </p>
            </div>
          </div>
          {lowStock.length > 0 && (
            <ul className="divide-y divide-border">
              {lowStock.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate flex-1 mr-2">{p.name}</span>
                  <span className="text-amber-600 font-medium tabular-nums">{Number(p.stock)} / {Number(p.min_stock)}</span>
                </li>
              ))}
              {lowStock.length > 5 && (
                <li className="pt-2 text-xs text-muted-foreground text-center">
                  + {lowStock.length - 5} outros
                </li>
              )}
            </ul>
          )}
        </Card>

        {/* Atalhos */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" className="h-14" onClick={() => navigate({ to: "/dashboard" })}>
            <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <Button variant="outline" className="h-14" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </main>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
