import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Utensils,
  Plus,
  Trash2,
  Loader2,
  Banknote,
  Search,
  Receipt,
  Minus,
  User,
  Clock,
  Split,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas — SmartVenda PDV" },
      { name: "description", content: "Gestão de mesas e comandas para bar e restaurante." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesasPage />
      </AppShell>
    </AuthGate>
  ),
});

interface MesaTable {
  id: string;
  number: number;
  name: string | null;
  seats: number;
  status: "free" | "occupied" | "reserved";
}
interface OpenOrder {
  id: string;
  table_id: string;
  customer_name: string | null;
  opened_at: string;
}
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
interface ProductLite {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
}
interface CustomerLite { id: string; name: string }

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type PaymentMethod = "cash" | "credit" | "debit" | "pix" | "other";

function formatElapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function MesasPage() {
  const { isAdmin, roles } = useAuth();
  const canManage = isAdmin || roles.includes("manager");
  const [tables, setTables] = useState<MesaTable[]>([]);
  const [openOrders, setOpenOrders] = useState<Record<string, OpenOrder>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [activeTable, setActiveTable] = useState<MesaTable | null>(null);
  const [occupyTable, setOccupyTable] = useState<MesaTable | null>(null);
  const [toDelete, setToDelete] = useState<MesaTable | null>(null);
  // tick para atualizar o cronômetro a cada minuto
  const [, setTick] = useState(0);

  useEffect(() => {
    void load();
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  async function load() {
    setLoading(true);
    const [tRes, oRes] = await Promise.all([
      supabase.from("tables").select("id,number,name,seats,status").order("number"),
      supabase.from("table_orders").select("id,table_id,customer_name,opened_at").eq("status", "open"),
    ]);
    if (tRes.error) toast.error("Erro ao carregar mesas");
    setTables((tRes.data ?? []) as MesaTable[]);
    const map: Record<string, OpenOrder> = {};
    (oRes.data ?? []).forEach((o: any) => { map[o.table_id] = o as OpenOrder });
    setOpenOrders(map);
    setLoading(false);
  }

  async function removeTable() {
    if (!toDelete) return;
    const { error } = await supabase.from("tables").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mesa removida");
    setToDelete(null);
    void load();
  }

  function handleTableClick(t: MesaTable) {
    if (t.status === "free") {
      // Abrir diálogo para coletar nome
      setOccupyTable(t);
    } else {
      setActiveTable(t);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Utensils className="h-6 w-6 text-primary" /> Mesas
          </h1>
          <p className="text-sm text-muted-foreground">Toque numa mesa para abrir comanda. Clientes ficam registrados na venda.</p>
        </div>
        {canManage && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova mesa
          </Button>
        )}
      </header>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-card border-2 border-border"/>Livre</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary"/>Ocupada</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-warning"/>Reservada</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Nenhuma mesa cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((t) => {
            const order = openOrders[t.id];
            return (
              <button
                key={t.id}
                onClick={() => handleTableClick(t)}
                className={`relative aspect-square rounded-2xl border-2 p-3 flex flex-col items-center justify-center gap-1 transition-all hover:shadow-[var(--shadow-card)] active:scale-95 ${
                  t.status === "free"
                    ? "border-border bg-card hover:border-primary/40"
                    : t.status === "occupied"
                    ? "border-primary bg-primary/10"
                    : "border-warning bg-warning/10"
                }`}
              >
                <div className="text-3xl font-bold">{t.number}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-1">{t.name || `${t.seats} lugares`}</div>
                {order?.customer_name && (
                  <div className="text-[11px] font-medium text-primary line-clamp-1 flex items-center gap-1">
                    <User className="h-2.5 w-2.5" /> {order.customer_name}
                  </div>
                )}
                {t.status === "occupied" && order && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> {formatElapsed(order.opened_at)}
                  </div>
                )}
                <span
                  className={`text-[10px] uppercase font-semibold tracking-wide ${
                    t.status === "free" ? "text-success" : t.status === "occupied" ? "text-primary" : "text-warning"
                  }`}
                >
                  {t.status === "free" ? "Livre" : t.status === "occupied" ? "Ocupada" : "Reservada"}
                </span>
                {canManage && t.status === "free" && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(t);
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <NewTableDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => void load()} />
      {occupyTable && (
        <OccupyTableDialog
          table={occupyTable}
          onClose={() => setOccupyTable(null)}
          onOpened={(table) => {
            setOccupyTable(null);
            void load();
            setActiveTable(table);
          }}
        />
      )}
      {activeTable && (
        <TableOrderDialog
          table={activeTable}
          onClose={() => {
            setActiveTable(null);
            void load();
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mesa {toDelete?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Comandas associadas também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeTable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewTableDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [number, setNumber] = useState<number | "">("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(4);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!number || Number(number) < 1) {
      toast.error("Informe o número da mesa");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Não autenticado"); return; }
    const { error } = await supabase.from("tables").insert({
      number: Number(number),
      name: name.trim() || null,
      seats,
      owner_id: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mesa criada");
    setNumber("");
    setName("");
    setSeats(4);
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova mesa</DialogTitle>
          <DialogDescription>Cadastre uma nova mesa do salão.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Número *</Label>
            <Input type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value ? Number(e.target.value) : "")} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome (opcional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Varanda" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label>Lugares</Label>
            <Input type="number" min={1} max={50} value={seats} onChange={(e) => setSeats(Number(e.target.value) || 1)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OccupyTableDialog({
  table,
  onClose,
  onOpened,
}: {
  table: MesaTable;
  onClose: () => void;
  onOpened: (t: MesaTable) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void supabase.from("customers").select("id,name").order("name").limit(200).then(({ data }) => {
      setCustomers((data ?? []) as CustomerLite[]);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, search]);

  function pickCustomer(c: CustomerLite) {
    setCustomerName(c.name);
    setCustomerId(c.id);
    setSearch("");
  }

  async function open() {
    setSubmitting(true);
    const { error } = await supabase.rpc("open_table_order", {
      _table_id: table.id,
      _customer_name: customerName.trim() || undefined,
      _customer_id: customerId ?? undefined,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Mesa ocupada");
    onOpened(table);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ocupar mesa {table.number}</DialogTitle>
          <DialogDescription>
            Quem vai usar esta mesa? Pode deixar em branco se for venda rápida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do cliente</Label>
            <Input
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setCustomerId(null); setSearch(e.target.value); }}
              placeholder="Digite o nome..."
              maxLength={120}
              autoFocus
            />
            {filtered.length > 0 && (
              <div className="rounded-md border border-border bg-popover shadow-md text-sm divide-y divide-border max-h-40 overflow-auto">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                  >
                    <User className="h-3 w-3 text-muted-foreground" /> {c.name}
                  </button>
                ))}
              </div>
            )}
            {customerId && (
              <p className="text-xs text-success">✓ Cliente cadastrado vinculado</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={open} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Abrir comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TableOrderDialog({ table, onClose }: { table: MesaTable; onClose: () => void }) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OpenOrder | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    void init();
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, [table.id]);

  async function init() {
    setLoading(true);
    const [orderRes, prodRes] = await Promise.all([
      supabase.rpc("open_table_order", { _table_id: table.id }),
      supabase.from("products").select("id,name,price,stock,unit").eq("active", true).order("name"),
    ]);
    const oid = orderRes.data as string;
    setOrderId(oid);
    setProducts((prodRes.data ?? []) as ProductLite[]);
    if (oid) {
      const { data: oData } = await supabase.from("table_orders").select("id,table_id,customer_name,opened_at").eq("id", oid).maybeSingle();
      if (oData) setOrder(oData as OpenOrder);
      await loadItems(oid);
    }
    setLoading(false);
  }

  async function loadItems(id: string) {
    const { data } = await supabase
      .from("table_order_items")
      .select("id,product_id,product_name,quantity,unit_price,subtotal")
      .eq("order_id", id)
      .order("created_at");
    setItems((data ?? []) as OrderItem[]);
  }

  async function addItem(p: ProductLite) {
    if (!orderId) return;
    const { error } = await supabase.rpc("add_table_item", {
      _order_id: orderId,
      _product_id: p.id,
      _quantity: 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadItems(orderId);
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("table_order_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (orderId) await loadItems(orderId);
  }

  async function changeQty(item: OrderItem, delta: number) {
    const newQty = Number(item.quantity) + delta;
    if (newQty <= 0) return removeItem(item.id);
    const { error } = await supabase
      .from("table_order_items")
      .update({ quantity: newQty, subtotal: newQty * Number(item.unit_price) })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (orderId) await loadItems(orderId);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 40);
  }, [search, products]);

  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Utensils className="h-5 w-5 text-primary" /> Mesa {table.number}
              {table.name && <span className="text-muted-foreground font-normal text-sm">— {table.name}</span>}
              {order?.customer_name && (
                <span className="ml-1 inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <User className="h-3 w-3" /> {order.customer_name}
                </span>
              )}
              {order && (
                <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatElapsed(order.opened_at)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>Adicione itens à comanda. Feche em pagamento para gerar a venda.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 overflow-hidden">
              <div className="flex flex-col overflow-hidden">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar produto..."
                    className="pl-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[50vh] pr-1">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="text-left rounded-lg border border-border bg-card p-2 hover:border-primary/40 transition-all"
                    >
                      <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                      <p className="text-sm font-bold text-primary mt-1">{BRL.format(Number(p.price))}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col overflow-hidden border border-border rounded-lg">
                <div className="px-3 py-2 border-b border-border bg-muted/40 text-sm font-semibold">
                  Comanda ({items.length})
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1.5 max-h-[45vh]">
                  {items.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Sem itens.</p>
                  ) : (
                    items.map((i) => (
                      <div key={i.id} className="rounded-md border border-border p-2 text-sm bg-background">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium flex-1">{i.product_name}</span>
                          <button onClick={() => removeItem(i.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => changeQty(i, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-xs font-medium">{Number(i.quantity)}</span>
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => changeQty(i, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-semibold">{BRL.format(Number(i.subtotal))}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-border px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">{BRL.format(total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={() => setPayOpen(true)} disabled={items.length === 0}>
              <Receipt className="h-4 w-4 mr-1" /> Fechar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orderId && payOpen && (
        <PayTableDialog
          orderId={orderId}
          total={total}
          onClose={() => setPayOpen(false)}
          onPaid={() => {
            setPayOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

function PayTableDialog({
  orderId,
  total,
  onClose,
  onPaid,
}: {
  orderId: string;
  total: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [splitCount, setSplitCount] = useState(1);

  const finalTotal = Math.max(total - discount, 0);
  const perPerson = splitCount > 1 ? finalTotal / splitCount : finalTotal;

  async function pay() {
    setSubmitting(true);
    const amountReceived = payment === "cash" && received ? Number(received) : null;
    const { error } = await supabase.rpc("close_table_order", {
      _order_id: orderId,
      _payment_method: payment,
      _discount: discount,
      _amount_received: amountReceived as number,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Comanda fechada e venda registrada!");
    onPaid();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar conta</DialogTitle>
          <DialogDescription>
            Total: <strong className="text-primary">{BRL.format(finalTotal)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={payment} onValueChange={(v) => setPayment(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 Dinheiro</SelectItem>
                <SelectItem value="pix">📱 PIX</SelectItem>
                <SelectItem value="credit">💳 Crédito</SelectItem>
                <SelectItem value="debit">💳 Débito</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Desconto</Label>
            <Input type="number" min={0} step={0.01} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
          </div>

          {/* Dividir conta */}
          <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
            <Label className="flex items-center gap-1.5"><Split className="h-3.5 w-3.5" /> Dividir conta</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setSplitCount(Math.max(1, splitCount - 1))}>
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1}
                max={20}
                className="text-center h-8 w-16"
                value={splitCount}
                onChange={(e) => setSplitCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setSplitCount(Math.min(20, splitCount + 1))}>
                <Plus className="h-3 w-3" />
              </Button>
              <span className="text-sm text-muted-foreground">pessoa{splitCount === 1 ? "" : "s"}</span>
            </div>
            {splitCount > 1 && (
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-muted-foreground">Cada pessoa paga</span>
                <span className="font-bold text-primary">{BRL.format(perPerson)}</span>
              </div>
            )}
          </div>

          {payment === "cash" && (
            <div>
              <Label>Valor recebido</Label>
              <Input type="number" min={0} step={0.01} value={received} onChange={(e) => setReceived(e.target.value)} />
              {received && Number(received) >= finalTotal && (
                <p className="text-sm text-success mt-1">Troco: {BRL.format(Number(received) - finalTotal)}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={pay} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Banknote className="h-4 w-4 mr-1" /> Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
