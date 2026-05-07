import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Receipt, Eye, Loader2, Banknote, CreditCard, Smartphone } from "lucide-react";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — SmartVenda PDV" },
      { name: "description", content: "Histórico completo de vendas realizadas no PDV." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <SalesPage />
      </AppShell>
    </AuthGate>
  ),
});

interface Sale {
  id: string;
  sale_number: number;
  total: number;
  subtotal: number;
  discount: number;
  payment_method: string;
  status: string;
  created_at: string;
  cashier_id: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const paymentLabel: Record<string, { label: string; icon: React.ReactNode }> = {
  cash: { label: "Dinheiro", icon: <Banknote className="h-3.5 w-3.5" /> },
  pix: { label: "PIX", icon: <Smartphone className="h-3.5 w-3.5" /> },
  credit: { label: "Crédito", icon: <CreditCard className="h-3.5 w-3.5" /> },
  debit: { label: "Débito", icon: <CreditCard className="h-3.5 w-3.5" /> },
  other: { label: "Outro", icon: <Banknote className="h-3.5 w-3.5" /> },
};

function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSale, setOpenSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setSales((data ?? []) as Sale[]);
    setLoading(false);
  }

  async function viewSale(s: Sale) {
    setOpenSale(s);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", s.id);
    setItems((data ?? []) as SaleItem[]);
  }

  const totalToday = sales
    .filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" /> Vendas
        </h1>
        <p className="text-sm text-muted-foreground">Histórico das últimas 200 vendas. Total hoje: <strong className="text-foreground">{BRL.format(totalToday)}</strong></p>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhuma venda registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((s) => {
                  const pm = paymentLabel[s.payment_method] ?? paymentLabel.other;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">#{String(s.sale_number).padStart(6, "0")}</TableCell>
                      <TableCell className="text-sm">{DT.format(new Date(s.created_at))}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                          {pm.icon} {pm.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{BRL.format(Number(s.discount))}</TableCell>
                      <TableCell className="text-right font-semibold">{BRL.format(Number(s.total))}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewSale(s)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!openSale} onOpenChange={(o) => !o && setOpenSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Venda #{openSale ? String(openSale.sale_number).padStart(6, "0") : ""}
            </DialogTitle>
          </DialogHeader>
          {openSale && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{DT.format(new Date(openSale.created_at))}</p>
              <div className="rounded-lg border border-border divide-y divide-border">
                {items.map((it) => (
                  <div key={it.id} className="p-3 flex justify-between text-sm">
                    <div>
                      <p className="font-medium">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">{Number(it.quantity)} × {BRL.format(Number(it.unit_price))}</p>
                    </div>
                    <p className="font-semibold">{BRL.format(Number(it.subtotal))}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{BRL.format(Number(openSale.subtotal))}</span></div>
                <div className="flex justify-between"><span>Desconto</span><span>{BRL.format(Number(openSale.discount))}</span></div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border"><span>Total</span><span className="text-primary">{BRL.format(Number(openSale.total))}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
