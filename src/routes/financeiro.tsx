import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  TrendingUp, DollarSign, ArrowDownCircle, ArrowUpCircle, Calendar,
  PiggyBank, Plus, Loader2, FileText, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — SmartVenda PDV" },
      { name: "description", content: "Lucros, faturamento, contas a pagar e receber, e margem por produto." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <FinancePage />
      </AppShell>
    </AuthGate>
  ),
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface SaleRow { id: string; total: number; subtotal: number; discount: number; created_at: string; }
interface SaleItemRow { product_id: string | null; product_name: string; quantity: number; unit_price: number; subtotal: number; sales: { created_at: string } | null; }
interface ProductCostRow { id: string; name: string; cost: number; price: number; }

function FinancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [products, setProducts] = useState<ProductCostRow[]>([]);
  const [payable, setPayable] = useState<any[]>([]);
  const [receivable, setReceivable] = useState<any[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: s }, { data: si }, { data: p }, { data: ap }, { data: ar }] = await Promise.all([
      supabase.from("sales").select("id,total,subtotal,discount,created_at").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("sale_items").select("product_id,product_name,quantity,unit_price,subtotal,sales!inner(created_at)").gte("sales.created_at", since),
      supabase.from("products").select("id,name,cost,price"),
      supabase.from("accounts_payable").select("*").order("due_date"),
      supabase.from("accounts_receivable").select("*").order("due_date"),
    ]);
    setSales((s ?? []) as SaleRow[]);
    setItems((si ?? []) as unknown as SaleItemRow[]);
    setProducts((p ?? []) as ProductCostRow[]);
    setPayable(ap ?? []);
    setReceivable(ar ?? []);
    setLoading(false);
  }

  // ====== métricas ======
  const costMap = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.id, Number(p.cost) || 0));
    return m;
  }, [products]);

  const itemsWithCost = useMemo(
    () => items.map((i) => {
      const cost = i.product_id ? (costMap.get(i.product_id) ?? 0) : 0;
      const totalCost = cost * Number(i.quantity);
      const profit = Number(i.subtotal) - totalCost;
      return { ...i, cost, totalCost, profit };
    }),
    [items, costMap],
  );

  function rangeStats(daysBack: number | null) {
    const now = new Date();
    let start: Date;
    if (daysBack === 0) {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (daysBack === 30) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (daysBack === 365) {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start = new Date(0);
    }
    const filteredSales = sales.filter((s) => new Date(s.created_at) >= start);
    const filteredItems = itemsWithCost.filter((i) => new Date(i.sales?.created_at ?? 0) >= start);
    const revenue = filteredSales.reduce((a, s) => a + Number(s.total), 0);
    const cost = filteredItems.reduce((a, i) => a + i.totalCost, 0);
    const profit = filteredItems.reduce((a, i) => a + i.profit, 0);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, cost, profit, margin, count: filteredSales.length };
  }

  const today = rangeStats(0);
  const month = rangeStats(30);
  const year = rangeStats(365);

  // produtos: margem
  const productMargins = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
    itemsWithCost.forEach((i) => {
      const k = i.product_id ?? i.product_name;
      const cur = map.get(k) ?? { name: i.product_name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      cur.qty += Number(i.quantity);
      cur.revenue += Number(i.subtotal);
      cur.cost += i.totalCost;
      cur.profit += i.profit;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.profit - a.profit);
  }, [itemsWithCost]);

  // mensal últimos 12 meses
  const monthlyChart = useMemo(() => {
    const months: { label: string; revenue: number; profit: number }[] = [];
    const now = new Date();
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
      const rev = sales.filter((s) => new Date(s.created_at) >= d && new Date(s.created_at) < next).reduce((a, s) => a + Number(s.total), 0);
      const prof = itemsWithCost.filter((i) => {
        const dt = new Date(i.sales?.created_at ?? 0);
        return dt >= d && dt < next;
      }).reduce((a, i) => a + i.profit, 0);
      months.push({ label: d.toLocaleString("pt-BR", { month: "short" }), revenue: rev, profit: prof });
    }
    return months;
  }, [sales, itemsWithCost]);

  const maxRev = Math.max(1, ...monthlyChart.map((m) => m.revenue));

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Financeiro
        </h1>
        <p className="text-sm text-muted-foreground">Lucros reais, margens e faturamento.</p>
      </header>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Hoje" stats={today} accent="from-primary/20" />
        <StatCard title="Este mês" stats={month} accent="from-success/20" />
        <StatCard title="Este ano" stats={year} accent="from-warning/20" />
      </div>

      <Tabs defaultValue="lucros">
        <TabsList>
          <TabsTrigger value="lucros">Lucros</TabsTrigger>
          <TabsTrigger value="produtos">Margem por produto</TabsTrigger>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="receber">Contas a receber</TabsTrigger>
        </TabsList>

        <TabsContent value="lucros" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="h-4 w-4" /> Últimos 12 meses</h3>
            <div className="flex items-end gap-2 h-48">
              {monthlyChart.map((m, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className="text-[10px] text-muted-foreground">{BRL.format(m.profit)}</div>
                  <div className="w-full flex flex-col gap-px">
                    <div className="bg-primary rounded-t" style={{ height: `${(m.revenue / maxRev) * 140}px` }} title={`Faturamento: ${BRL.format(m.revenue)}`} />
                    <div className="bg-success" style={{ height: `${Math.max(0, (m.profit / maxRev) * 140)}px` }} title={`Lucro: ${BRL.format(m.profit)}`} />
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{m.label.replace(".", "")}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary" /> Faturamento</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success" /> Lucro real</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productMargins.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem vendas ainda.</TableCell></TableRow>
                )}
                {productMargins.map((p, i) => {
                  const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right">{BRL.format(p.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{BRL.format(p.cost)}</TableCell>
                      <TableCell className={`text-right font-bold ${p.profit >= 0 ? "text-success" : "text-destructive"}`}>{BRL.format(p.profit)}</TableCell>
                      <TableCell className={`text-right ${margin >= 30 ? "text-success" : margin >= 10 ? "text-warning" : "text-destructive"}`}>{margin.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pagar" className="mt-4">
          <BillsTab kind="payable" rows={payable} userId={user?.id ?? ""} onChanged={load} />
        </TabsContent>
        <TabsContent value="receber" className="mt-4">
          <BillsTab kind="receivable" rows={receivable} userId={user?.id ?? ""} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, stats, accent }: { title: string; stats: { revenue: number; profit: number; margin: number; count: number }; accent: string }) {
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br ${accent} to-card p-5`}>
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{title}</div>
      <div className="mt-2 text-2xl font-bold">{BRL.format(stats.revenue)}</div>
      <div className="text-xs text-muted-foreground">{stats.count} venda(s)</div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="flex items-center gap-1"><PiggyBank className="h-3.5 w-3.5 text-success" /> Lucro</span>
        <span className="font-semibold text-success">{BRL.format(stats.profit)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Margem</span><span>{stats.margin.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function BillsTab({ kind, rows, userId, onChanged }: { kind: "payable" | "receivable"; rows: any[]; userId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", due_date: "", party: "", category: "" });
  const [saving, setSaving] = useState(false);
  const partyLabel = kind === "payable" ? "Fornecedor" : "Cliente";
  const partyField = kind === "payable" ? "supplier" : "customer";
  const table = kind === "payable" ? "accounts_payable" : "accounts_receivable";

  async function add() {
    if (!form.description || !form.amount || !form.due_date) {
      toast.error("Preencha descrição, valor e vencimento");
      return;
    }
    setSaving(true);
    const payload: any = {
      description: form.description,
      amount: Number(form.amount),
      due_date: form.due_date,
      [partyField]: form.party || null,
      category: form.category || null,
      created_by: userId,
      owner_id: userId,
    };
    const { error } = await supabase.from(table).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada");
    setOpen(false);
    setForm({ description: "", amount: "", due_date: "", party: "", category: "" });
    onChanged();
  }

  async function togglePaid(row: any) {
    const isPaid = row.status === "paid";
    const newStatus = isPaid ? "pending" : "paid";
    const updates: any = { status: newStatus };
    if (kind === "payable") updates.paid_at = isPaid ? null : new Date().toISOString();
    else updates.received_at = isPaid ? null : new Date().toISOString();
    const { error } = await supabase.from(table).update(updates).eq("id", row.id);
    if (error) toast.error(error.message);
    else onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); onChanged(); }
  }

  const total = rows.reduce((a, r) => a + Number(r.amount), 0);
  const pending = rows.filter((r) => r.status === "pending").reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="text-sm">Total: <strong>{BRL.format(total)}</strong></div>
          <div className="text-sm text-warning">Pendente: <strong>{BRL.format(pending)}</strong></div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova conta</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>{partyLabel}</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma conta.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r[partyField] ?? "—"}</TableCell>
                <TableCell className="text-sm">{new Date(r.due_date).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right font-semibold">{BRL.format(Number(r.amount))}</TableCell>
                <TableCell>
                  <button onClick={() => togglePaid(r)} className={`text-xs px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    {r.status === "paid" ? (kind === "payable" ? "Paga" : "Recebida") : "Pendente"}
                  </button>
                </TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Excluir</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova conta {kind === "payable" ? "a pagar" : "a receber"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Valor</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-1"><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{partyLabel}</Label><Input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></div>
              <div className="space-y-1"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Aluguel, Energia..." /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={add} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
