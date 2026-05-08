import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Banknote, CreditCard, Smartphone,
  CheckCircle2, Loader2, ScanLine, Package, Printer, Download, Copy, Wallet,
  TrendingUp, Lock, Unlock, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { generatePixPayload } from "@/lib/pix";
import { printReceipt, downloadReceiptPdf, type ReceiptData } from "@/lib/receipt";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "Frente de Caixa — SmartVenda PDV" },
      { name: "description", content: "Vendas, controle de caixa, PIX e impressão." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <PdvPage />
      </AppShell>
    </AuthGate>
  ),
});

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  image_url: string | null;
  category_id: string | null;
  updated_at?: string;
}
interface CategoryLite { id: string; name: string; color: string }

interface CartItem { product: Product; quantity: number; }
type PaymentMethod = "cash" | "credit" | "debit" | "pix" | "other";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function PdvPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("venda");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user]);

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Frente de Caixa
          </h1>
          <p className="text-xs text-muted-foreground">PDV completo: vendas, caixa, lucros e configurações.</p>
        </div>
        <Link to="/dashboard"><Button variant="outline" size="sm">Sair do PDV</Button></Link>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-6">
          <TabsList>
            <TabsTrigger value="venda"><ShoppingCart className="h-4 w-4 mr-1" /> Venda</TabsTrigger>
            <TabsTrigger value="caixa"><Wallet className="h-4 w-4 mr-1" /> Caixa</TabsTrigger>
            <TabsTrigger value="lucros"><TrendingUp className="h-4 w-4 mr-1" /> Lucros do dia</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="venda" className="flex-1 overflow-hidden m-0">
          <SaleView profile={profile} cashier={user?.user_metadata?.full_name || user?.email || "Operador"} />
        </TabsContent>
        <TabsContent value="caixa" className="flex-1 overflow-auto m-0 p-6"><CashRegisterView userId={user?.id ?? ""} /></TabsContent>
        <TabsContent value="lucros" className="flex-1 overflow-auto m-0 p-6"><DailyProfitView /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== VENDA ==============
function SaleView({ profile, cashier }: { profile: any; cashier: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<string | null>(null);
  const [includeCpf, setIncludeCpf] = useState(false);
  const [customerCpf, setCustomerCpf] = useState("");
  const [lastSale, setLastSale] = useState<{ number: number; total: number; change: number; receipt: ReceiptData } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => { void loadProducts(); searchRef.current?.focus(); }, []);

  async function loadProducts() {
    setLoadingProducts(true);
    const [{ data, error }, { data: cats }] = await Promise.all([
      supabase.from("products")
        .select("id,name,barcode,sku,price,cost,stock,unit,image_url,category_id,updated_at")
        .eq("active", true).order("name"),
      supabase.from("categories").select("id,name,color").order("name"),
    ]);
    if (error) toast.error("Erro ao carregar produtos");
    setProducts((data ?? []) as Product[]);
    setCategories((cats ?? []) as CategoryLite[]);
    setLoadingProducts(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (activeCategory !== "all") {
      list = list.filter((p) => p.category_id === activeCategory);
    }
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).slice(0, 100);
  }, [search, products, activeCategory]);

  function addToCart(p: Product) {
    if (p.stock <= 0) { toast.error(`${p.name} sem estoque`); return; }
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id);
      if (ex) {
        if (ex.quantity + 1 > p.stock) { toast.error("Estoque insuficiente"); return c; }
        return c.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...c, { product: p, quantity: 1 }];
    });
  }
  function updateQty(id: string, delta: number) {
    setCart((c) => c.flatMap((i) => {
      if (i.product.id !== id) return [i];
      const nq = i.quantity + delta;
      if (nq <= 0) return [];
      if (nq > i.product.stock) { toast.error("Estoque insuficiente"); return [i]; }
      return [{ ...i, quantity: nq }];
    }));
  }
  function removeItem(id: string) { setCart((c) => c.filter((i) => i.product.id !== id)); }
  function clearCart() { setCart([]); setDiscount(0); }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const total = Math.max(subtotal - discount, 0);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search) {
      const exact = products.find((p) => p.barcode === search.trim());
      if (exact) { addToCart(exact); setSearch(""); }
      else if (filtered[0]) { addToCart(filtered[0]); setSearch(""); }
    }
  }

  // PIX QR
  useEffect(() => {
    if (payment === "pix" && payOpen && profile?.pix_key && profile?.pix_merchant_name && profile?.pix_merchant_city && total > 0) {
      const payload = generatePixPayload({
        pixKey: profile.pix_key,
        merchantName: profile.pix_merchant_name,
        merchantCity: profile.pix_merchant_city,
        amount: total,
      });
      setPixPayload(payload);
      QRCode.toDataURL(payload, { width: 280, margin: 1 }).then(setPixQr);
    } else { setPixQr(null); setPixPayload(null); }
  }, [payment, payOpen, total, profile]);

  async function finalizeSale() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const items = cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity, unit_price: i.product.price }));
      const amountReceived = payment === "cash" && received ? Number(received) : null;
      if (payment === "cash" && amountReceived !== null && amountReceived < total) {
        toast.error("Valor recebido menor que o total"); setSubmitting(false); return;
      }
      const { data, error } = await supabase.rpc("create_sale", {
        _items: items, _discount: discount, _payment_method: payment,
        _amount_received: amountReceived as number, _notes: null as unknown as string,
      });
      if (error) throw error;
      const { data: sale } = await supabase.from("sales").select("sale_number,total,change_amount").eq("id", data as string).single();

      const receipt: ReceiptData = {
        storeName: profile?.store_name || "SmartVenda PDV",
        storeCnpj: profile?.cnpj || null,
        customerCpf: includeCpf && customerCpf.trim() ? customerCpf.trim() : null,
        saleNumber: Number(sale?.sale_number ?? 0),
        items: cart.map((i) => ({
          name: i.product.name, quantity: i.quantity,
          unit_price: i.product.price, subtotal: i.product.price * i.quantity,
        })),
        subtotal, discount, total: Number(sale?.total ?? total),
        paymentMethod: payment,
        amountReceived,
        change: Number(sale?.change_amount ?? 0),
        cashier,
        date: new Date(),
        pixPayload: payment === "pix" ? pixPayload : null,
        widthMm: profile?.printer_width_mm ?? 80,
      };

      setLastSale({
        number: Number(sale?.sale_number ?? 0),
        total: Number(sale?.total ?? total),
        change: Number(sale?.change_amount ?? 0),
        receipt,
      });

      if (profile?.auto_print) printReceipt(receipt);

      clearCart(); setReceived(""); setPayOpen(false); setIncludeCpf(false); setCustomerCpf("");
      void loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar venda");
    } finally { setSubmitting(false); }
  }

  const productsPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}
            placeholder="Código de barras, nome ou SKU..." className="pl-10 h-12 text-base" autoFocus />
          <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        {categories.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activeCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
              }`}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  activeCategory === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                }`}
                style={activeCategory === c.id ? undefined : { borderColor: `${c.color}55`, color: c.color }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loadingProducts ? <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : filtered.length === 0 ? <div className="text-center text-muted-foreground py-12">Nenhum produto encontrado.</div>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-[var(--shadow-card)] transition-all active:scale-95">
                  <div className="flex h-20 items-center justify-center rounded-lg bg-muted mb-2 overflow-hidden">
                    {p.image_url ? (
                      <img src={`${p.image_url}${p.image_url.includes("?") ? "&" : "?"}v=${p.updated_at ?? ""}`} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : <Package className="h-8 w-8 text-muted-foreground/50" />}
                  </div>
                  <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-base font-bold text-primary">{BRL.format(Number(p.price))}</span>
                    <span className={`text-xs ${p.stock <= 5 ? "text-warning" : "text-muted-foreground"}`}>{Number(p.stock)} {p.unit}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );

  const cartPanel = (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Carrinho ({cart.length})</h2>
        {cart.length > 0 && <Button variant="ghost" size="sm" onClick={clearCart}>Limpar</Button>}
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {cart.length === 0 ? <div className="text-center text-muted-foreground py-12 text-sm">Adicione produtos para começar</div>
          : cart.map((i) => (
            <div key={i.product.id} className="rounded-lg border border-border p-3 bg-background">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1">{i.product.name}</p>
                <button onClick={() => removeItem(i.product.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center text-sm font-medium">{i.quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{BRL.format(Number(i.product.price))}</p>
                  <p className="text-sm font-bold">{BRL.format(Number(i.product.price) * i.quantity)}</p>
                </div>
              </div>
            </div>
          ))}
      </div>
      <div className="border-t border-border p-5 space-y-3">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{BRL.format(subtotal)}</span></div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="discount" className="text-sm text-muted-foreground">Desconto</Label>
          <Input id="discount" type="number" min={0} step={0.01} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="h-8 w-28 text-right" />
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
          <span>Total</span><span className="text-primary">{BRL.format(total)}</span>
        </div>
        <Button size="lg" className="w-full h-12 text-base font-semibold" disabled={cart.length === 0} onClick={() => setPayOpen(true)}>Finalizar Venda</Button>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-hidden">{productsPanel}</div>
          <div className="max-h-[55vh] border-t border-border overflow-hidden">{cartPanel}</div>
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={65} minSize={40}>{productsPanel}</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={25}>{cartPanel}</ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
            <DialogDescription>Total a pagar: <strong className="text-primary">{BRL.format(total)}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <PayBtn active={payment === "cash"} onClick={() => setPayment("cash")} icon={<Banknote className="h-4 w-4" />} label="Dinheiro" />
              <PayBtn active={payment === "pix"} onClick={() => setPayment("pix")} icon={<Smartphone className="h-4 w-4" />} label="PIX" />
              <PayBtn active={payment === "credit"} onClick={() => setPayment("credit")} icon={<CreditCard className="h-4 w-4" />} label="Crédito" />
              <PayBtn active={payment === "debit"} onClick={() => setPayment("debit")} icon={<CreditCard className="h-4 w-4" />} label="Débito" />
            </div>

            {payment === "cash" && (
              <div className="space-y-2">
                <Label htmlFor="received">Valor recebido</Label>
                <Input id="received" type="number" min={0} step={0.01} value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0,00" className="h-11 text-lg" autoFocus />
                {received && Number(received) >= total && <p className="text-sm text-success font-medium">Troco: {BRL.format(Number(received) - total)}</p>}
              </div>
            )}

            {payment === "pix" && (
              <div className="space-y-3 text-center">
                {!profile?.pix_key ? (
                  <div className="text-sm text-warning bg-warning/10 rounded-lg p-3">
                    Cadastre uma chave PIX em <Link to="/configuracoes" className="underline font-semibold">Configurações</Link> para gerar QR Code.
                  </div>
                ) : pixQr ? (
                  <>
                    <img src={pixQr} alt="QR Code PIX" className="mx-auto rounded-lg border" />
                    <Button variant="outline" size="sm" onClick={() => { if (pixPayload) { navigator.clipboard.writeText(pixPayload); toast.success("Código PIX copiado!"); } }}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar PIX Copia e Cola
                    </Button>
                    <p className="text-xs text-muted-foreground">Confirme o pagamento no app do banco antes de finalizar.</p>
                  </>
                ) : <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
              </div>
            )}

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">CPF na nota?</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={includeCpf ? "default" : "outline"} onClick={() => setIncludeCpf(true)}>Sim</Button>
                  <Button type="button" size="sm" variant={!includeCpf ? "default" : "outline"} onClick={() => { setIncludeCpf(false); setCustomerCpf(""); }}>Não</Button>
                </div>
              </div>
              {includeCpf && (
                <Input value={customerCpf} onChange={(e) => setCustomerCpf(e.target.value)} placeholder="000.000.000-00" maxLength={20} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={finalizeSale} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar Venda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={!!lastSale} onOpenChange={(o) => !o && setLastSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success"><CheckCircle2 className="h-5 w-5" /> Venda concluída!</DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Venda Nº</p>
              <p className="text-3xl font-bold">#{lastSale.number.toString().padStart(6, "0")}</p>
              <p className="text-sm text-muted-foreground">Total recebido</p>
              <p className="text-2xl font-bold text-primary">{BRL.format(lastSale.total)}</p>
              {lastSale.change > 0 && <><p className="text-sm text-muted-foreground">Troco</p><p className="text-xl font-semibold text-success">{BRL.format(lastSale.change)}</p></>}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {lastSale && (
              <>
                <Button variant="outline" onClick={() => printReceipt(lastSale.receipt)}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
                <Button variant="outline" onClick={() => downloadReceiptPdf(lastSale.receipt)}><Download className="h-4 w-4 mr-1" /> PDF</Button>
              </>
            )}
            <Button className="flex-1" onClick={() => setLastSale(null)}>Nova venda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PayBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
      {icon}{label}
    </button>
  );
}

// ============== CAIXA ==============
function CashRegisterView({ userId }: { userId: string }) {
  const [register, setRegister] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAmount, setOpenAmount] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [movType, setMovType] = useState<"withdrawal" | "supply">("supply");
  const [movAmount, setMovAmount] = useState("");
  const [movDesc, setMovDesc] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data: open } = await supabase.from("cash_registers").select("*").eq("status", "open").order("opened_at", { ascending: false }).limit(1).maybeSingle();
    setRegister(open);
    if (open) {
      const { data: movs } = await supabase.from("cash_movements").select("*").eq("register_id", open.id).order("created_at", { ascending: false });
      setMovements(movs ?? []);
    } else setMovements([]);
    setLoading(false);
  }

  async function openRegister() {
    const amt = Number(openAmount) || 0;
    const { error } = await supabase.from("cash_registers").insert({ opened_by: userId, opening_amount: amt, owner_id: userId });
    if (error) { toast.error(error.message); return; }
    toast.success("Caixa aberto"); setOpenAmount(""); void load();
  }

  async function closeRegister() {
    if (!register) return;
    const closing = Number(closeAmount) || 0;
    const sumMov = movements.reduce((a, m) => a + (m.type === "supply" || m.type === "income" || m.type === "sale" ? Number(m.amount) : -Number(m.amount)), 0);
    const expected = Number(register.opening_amount) + sumMov;
    const diff = closing - expected;
    const { error } = await supabase.from("cash_registers").update({
      status: "closed", closed_at: new Date().toISOString(),
      closing_amount: closing, expected_amount: expected, difference: diff,
    }).eq("id", register.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Caixa fechado"); setCloseAmount(""); void load();
  }

  async function addMovement() {
    if (!register || !movAmount) return;
    const { error } = await supabase.from("cash_movements").insert({
      register_id: register.id, type: movType, amount: Number(movAmount),
      description: movDesc || null, user_id: userId, owner_id: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Movimento registrado"); setMovAmount(""); setMovDesc(""); void load();
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (!register) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="text-xl font-semibold">Caixa fechado</h3>
          <p className="text-sm text-muted-foreground">Abra o caixa para iniciar as vendas do dia.</p>
          <div className="space-y-2 text-left">
            <Label>Valor inicial (fundo de troco)</Label>
            <Input type="number" step="0.01" value={openAmount} onChange={(e) => setOpenAmount(e.target.value)} placeholder="0,00" />
          </div>
          <Button className="w-full" onClick={openRegister}><Unlock className="h-4 w-4 mr-1" /> Abrir caixa</Button>
        </div>
      </div>
    );
  }

  const sumIn = movements.filter((m) => ["supply", "income", "sale"].includes(m.type)).reduce((a, m) => a + Number(m.amount), 0);
  const sumOut = movements.filter((m) => ["withdrawal", "expense"].includes(m.type)).reduce((a, m) => a + Number(m.amount), 0);
  const expected = Number(register.opening_amount) + sumIn - sumOut;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <div className="text-xs text-muted-foreground uppercase">Aberto em</div>
        <div className="text-sm">{new Date(register.opened_at).toLocaleString("pt-BR")}</div>
        <div className="text-xs text-muted-foreground uppercase mt-3">Fundo inicial</div>
        <div className="text-2xl font-bold">{BRL.format(Number(register.opening_amount))}</div>
        <div className="text-xs text-muted-foreground uppercase mt-3">Saldo esperado agora</div>
        <div className="text-2xl font-bold text-primary">{BRL.format(expected)}</div>
        <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-border">
          <div className="text-success flex items-center gap-1"><ArrowUpCircle className="h-3 w-3" /> Entradas: {BRL.format(sumIn)}</div>
          <div className="text-destructive flex items-center gap-1"><ArrowDownCircle className="h-3 w-3" /> Saídas: {BRL.format(sumOut)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Sangria / Suprimento</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={movType === "supply" ? "default" : "outline"} size="sm" onClick={() => setMovType("supply")}><ArrowUpCircle className="h-3 w-3 mr-1" /> Suprimento</Button>
          <Button variant={movType === "withdrawal" ? "default" : "outline"} size="sm" onClick={() => setMovType("withdrawal")}><ArrowDownCircle className="h-3 w-3 mr-1" /> Sangria</Button>
        </div>
        <Input type="number" step="0.01" value={movAmount} onChange={(e) => setMovAmount(e.target.value)} placeholder="Valor" />
        <Input value={movDesc} onChange={(e) => setMovDesc(e.target.value)} placeholder="Descrição (opcional)" />
        <Button className="w-full" onClick={addMovement} disabled={!movAmount}>Registrar</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Fechar caixa</h3>
        <div className="space-y-1">
          <Label>Valor contado em caixa</Label>
          <Input type="number" step="0.01" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} placeholder="0,00" />
        </div>
        {closeAmount && (
          <div className="text-sm">
            Diferença: <strong className={Number(closeAmount) - expected === 0 ? "text-success" : Number(closeAmount) - expected > 0 ? "text-warning" : "text-destructive"}>
              {BRL.format(Number(closeAmount) - expected)}
            </strong>
          </div>
        )}
        <Button variant="destructive" className="w-full" onClick={closeRegister} disabled={!closeAmount}><Lock className="h-4 w-4 mr-1" /> Fechar caixa</Button>
      </div>

      <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-semibold">Movimentos</div>
        {movements.length === 0 ? <div className="p-6 text-center text-muted-foreground text-sm">Nenhum movimento registrado.</div>
          : (
            <div className="divide-y divide-border">
              {movements.map((m) => (
                <div key={m.id} className="px-5 py-3 flex justify-between text-sm">
                  <div>
                    <span className={`font-medium ${["supply", "income", "sale"].includes(m.type) ? "text-success" : "text-destructive"}`}>
                      {m.type === "supply" ? "Suprimento" : m.type === "withdrawal" ? "Sangria" : m.type === "sale" ? "Venda" : m.type === "expense" ? "Despesa" : "Receita"}
                    </span>
                    {m.description && <span className="text-muted-foreground"> — {m.description}</span>}
                  </div>
                  <div className="flex gap-4">
                    <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleTimeString("pt-BR")}</span>
                    <span className={`font-semibold ${["supply", "income", "sale"].includes(m.type) ? "text-success" : "text-destructive"}`}>
                      {["supply", "income", "sale"].includes(m.type) ? "+" : "-"}{BRL.format(Number(m.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ============== LUCROS DO DIA ==============
function DailyProfitView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ revenue: 0, cost: 0, profit: 0, count: 0, byMethod: {} as Record<string, number> });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [{ data: sales }, { data: items }, { data: prods }] = await Promise.all([
      supabase.from("sales").select("id,total,payment_method,created_at").gte("created_at", start.toISOString()),
      supabase.from("sale_items").select("product_id,quantity,subtotal,sales!inner(created_at)").gte("sales.created_at", start.toISOString()),
      supabase.from("products").select("id,cost"),
    ]);
    const costMap = new Map<string, number>();
    (prods ?? []).forEach((p: any) => costMap.set(p.id, Number(p.cost) || 0));

    const revenue = (sales ?? []).reduce((a, s) => a + Number(s.total), 0);
    const cost = (items ?? []).reduce((a: number, i: any) => a + (i.product_id ? (costMap.get(i.product_id) ?? 0) : 0) * Number(i.quantity), 0);
    const byMethod: Record<string, number> = {};
    (sales ?? []).forEach((s) => { byMethod[s.payment_method] = (byMethod[s.payment_method] ?? 0) + Number(s.total); });
    setData({ revenue, cost, profit: revenue - cost, count: (sales ?? []).length, byMethod });
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Faturamento hoje</div>
          <div className="text-2xl font-bold mt-1">{BRL.format(data.revenue)}</div>
          <div className="text-xs text-muted-foreground">{data.count} venda(s)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Custo dos produtos</div>
          <div className="text-2xl font-bold mt-1 text-destructive">{BRL.format(data.cost)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Lucro bruto</div>
          <div className="text-2xl font-bold mt-1 text-success">{BRL.format(data.profit)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">Margem</div>
          <div className="text-2xl font-bold mt-1">{margin.toFixed(1)}%</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold mb-3">Por forma de pagamento</h3>
        {Object.keys(data.byMethod).length === 0 ? <p className="text-sm text-muted-foreground">Sem vendas hoje.</p>
          : (
            <div className="space-y-2">
              {Object.entries(data.byMethod).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="capitalize">{k === "cash" ? "Dinheiro" : k === "pix" ? "PIX" : k === "credit" ? "Crédito" : k === "debit" ? "Débito" : k}</span>
                  <strong>{BRL.format(v)}</strong>
                </div>
              ))}
            </div>
          )}
        <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
          Veja relatórios completos em <Link to="/financeiro" className="text-primary underline">Financeiro</Link>.
        </div>
      </div>
    </div>
  );
}
