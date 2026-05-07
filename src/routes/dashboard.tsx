import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  BarChart3,
  Receipt,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SmartVenda PDV" },
      { name: "description", content: "Visão geral do seu PDV: vendas, estoque e indicadores em tempo real." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <Dashboard />
      </AppShell>
    </AuthGate>
  ),
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalToday: 0, ordersToday: 0, ticket: 0, lowStock: 0 });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [{ data: sales }, { data: products }] = await Promise.all([
      supabase.from("sales").select("total").gte("created_at", start.toISOString()),
      supabase.from("products").select("stock,min_stock").eq("active", true),
    ]);
    const totalToday = (sales ?? []).reduce((s, r) => s + Number(r.total), 0);
    const ordersToday = sales?.length ?? 0;
    const ticket = ordersToday > 0 ? totalToday / ordersToday : 0;
    const lowStock = (products ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock)).length;
    setStats({ totalToday, ordersToday, ticket, lowStock });
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Olá, {displayName} 👋</h1>
            <p className="text-sm text-muted-foreground">Resumo da operação hoje.</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Sistema online
          </span>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Vendas hoje" value={BRL.format(stats.totalToday)} icon={<DollarSign className="h-5 w-5" />} />
          <KpiCard label="Pedidos" value={stats.ordersToday.toString()} icon={<ShoppingBag className="h-5 w-5" />} />
          <KpiCard label="Ticket médio" value={BRL.format(stats.ticket)} icon={<TrendingUp className="h-5 w-5" />} />
          <KpiCard label="Estoque baixo" value={stats.lowStock.toString()} icon={<AlertTriangle className="h-5 w-5" />} accent={stats.lowStock > 0 ? "warning" : undefined} />
        </div>

        <div className="rounded-2xl p-8 text-primary-foreground shadow-[var(--shadow-elegant)]" style={{ background: "var(--gradient-hero)" }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight">Pronto para vender</h2>
              <p className="mt-2 text-white/85">Abra a frente de caixa e comece a registrar vendas em segundos.</p>
            </div>
            <Link to="/pdv">
              <Button size="lg" variant="secondary" className="font-semibold">Abrir Frente de Caixa</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard to="/pdv" icon={<ShoppingCart className="h-5 w-5" />} title="Frente de Caixa" desc="Vendas, scanner, pagamento." />
          <ModuleCard to="/produtos" icon={<Package className="h-5 w-5" />} title="Produtos & Estoque" desc="Cadastro, código de barras e alertas." />
          <ModuleCard to="/vendas" icon={<Receipt className="h-5 w-5" />} title="Vendas" desc="Histórico e detalhamento de vendas." />
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: "warning" }) {
  const accentClass = accent === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentClass}`}>{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-card-foreground">{value}</div>
    </div>
  );
}

function ModuleCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] hover:border-primary/40 hover:shadow-[var(--shadow-elegant)] transition-all block">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 text-xs font-medium text-primary group-hover:underline">Abrir →</div>
    </Link>
  );
}
