import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, User as UserIcon, Smartphone, Printer, Crown, Loader2, Save, Palette, Moon, Sun, Check } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { generatePixPayload } from "@/lib/pix";
import { PALETTES, applyTheme, loadStoredTheme, type PaletteId, type ThemeMode } from "@/lib/themes";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — SmartVenda PDV" },
      { name: "description", content: "Configure perfil, PIX, impressora e visualize seu plano." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ConfigPage />
      </AppShell>
    </AuthGate>
  ),
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface ProfileData {
  full_name: string | null;
  phone: string | null;
  store_name: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  printer_name: string | null;
  printer_width_mm: number | null;
  printer_copies: number | null;
  auto_print: boolean | null;
}

function ConfigPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "", phone: "", store_name: "",
    pix_key: "", pix_key_type: "email", pix_merchant_name: "", pix_merchant_city: "",
    printer_name: "", printer_width_mm: 80, printer_copies: 1, auto_print: false,
  });
  const [plan, setPlan] = useState<{ name: string; expires_at: string | null; billing_cycle: string } | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, { data: sub }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_subscriptions")
        .select("expires_at, plans(name, billing_cycle)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (p) setProfile({
      full_name: p.full_name ?? "",
      phone: (p as any).phone ?? "",
      store_name: (p as any).store_name ?? "",
      pix_key: (p as any).pix_key ?? "",
      pix_key_type: (p as any).pix_key_type ?? "email",
      pix_merchant_name: (p as any).pix_merchant_name ?? "",
      pix_merchant_city: (p as any).pix_merchant_city ?? "",
      printer_name: (p as any).printer_name ?? "",
      printer_width_mm: (p as any).printer_width_mm ?? 80,
      printer_copies: (p as any).printer_copies ?? 1,
      auto_print: (p as any).auto_print ?? false,
    });
    if (sub && (sub as any).plans) {
      setPlan({
        name: (sub as any).plans.name,
        billing_cycle: (sub as any).plans.billing_cycle,
        expires_at: sub.expires_at,
      });
    }
    setLoading(false);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        store_name: profile.store_name,
        pix_key: profile.pix_key,
        pix_key_type: profile.pix_key_type,
        pix_merchant_name: profile.pix_merchant_name,
        pix_merchant_city: profile.pix_merchant_city,
        printer_name: profile.printer_name,
        printer_width_mm: profile.printer_width_mm,
        printer_copies: profile.printer_copies,
        auto_print: profile.auto_print,
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  }

  async function previewPix() {
    if (!profile.pix_key || !profile.pix_merchant_name || !profile.pix_merchant_city) {
      toast.error("Preencha chave PIX, nome e cidade");
      return;
    }
    const payload = generatePixPayload({
      pixKey: profile.pix_key,
      merchantName: profile.pix_merchant_name,
      merchantCity: profile.pix_merchant_city,
      amount: 1.0,
    });
    const url = await QRCode.toDataURL(payload, { width: 240, margin: 1 });
    setQrPreview(url);
  }

  function daysUntil(date: string): number {
    return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground">Personalize seu perfil, PIX, impressora e veja seu plano.</p>
      </header>

      {plan && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Plano atual</div>
              <div className="text-xl font-bold">{plan.name}</div>
              <div className="text-xs text-muted-foreground">
                {plan.billing_cycle === "lifetime"
                  ? "Acesso vitalício"
                  : plan.expires_at
                  ? `Expira em ${daysUntil(plan.expires_at)} dias (${new Date(plan.expires_at).toLocaleDateString("pt-BR")})`
                  : "Cobrança mensal"}
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="perfil">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="perfil"><UserIcon className="h-4 w-4 mr-1" /> Perfil</TabsTrigger>
          <TabsTrigger value="visual"><Palette className="h-4 w-4 mr-1" /> Visual</TabsTrigger>
          <TabsTrigger value="pix"><Smartphone className="h-4 w-4 mr-1" /> PIX</TabsTrigger>
          <TabsTrigger value="impressora"><Printer className="h-4 w-4 mr-1" /> Impressora</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4 mt-4">
          <VisualTab />
        </TabsContent>

        <TabsContent value="perfil" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome da loja</Label>
                <Input value={profile.store_name ?? ""} onChange={(e) => setProfile({ ...profile, store_name: e.target.value })} placeholder="Aparece no cupom" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email <span className="text-xs text-muted-foreground">(somente admin altera)</span></Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pix" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Cadastre uma chave PIX para gerar QR Codes nas vendas pagas via PIX.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de chave</Label>
                <Select value={profile.pix_key_type ?? "email"} onValueChange={(v) => setProfile({ ...profile, pix_key_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Celular</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input value={profile.pix_key ?? ""} onChange={(e) => setProfile({ ...profile, pix_key: e.target.value })} placeholder="seu@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Nome do beneficiário</Label>
                <Input value={profile.pix_merchant_name ?? ""} onChange={(e) => setProfile({ ...profile, pix_merchant_name: e.target.value })} placeholder="Max 25 caracteres" maxLength={25} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={profile.pix_merchant_city ?? ""} onChange={(e) => setProfile({ ...profile, pix_merchant_city: e.target.value })} placeholder="SAO PAULO" maxLength={15} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" type="button" onClick={previewPix}>Pré-visualizar QR Code</Button>
              {qrPreview && <img src={qrPreview} alt="QR PIX" className="h-32 w-32 rounded border" />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="impressora" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Imprima cupons de 80mm em qualquer impressora térmica ou normal via diálogo do navegador.
              Em modo Electron, configure no app a impressora padrão.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da impressora (opcional)</Label>
                <Input value={profile.printer_name ?? ""} onChange={(e) => setProfile({ ...profile, printer_name: e.target.value })} placeholder="Ex: Bematech MP-4200" />
              </div>
              <div className="space-y-2">
                <Label>Largura do cupom (mm)</Label>
                <Select value={String(profile.printer_width_mm ?? 80)} onValueChange={(v) => setProfile({ ...profile, printer_width_mm: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cópias</Label>
                <Input type="number" min={1} max={5} value={profile.printer_copies ?? 1} onChange={(e) => setProfile({ ...profile, printer_copies: Number(e.target.value) })} />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={!!profile.auto_print} onCheckedChange={(v) => setProfile({ ...profile, auto_print: v })} />
                  <span className="text-sm">Imprimir automaticamente ao finalizar venda</span>
                </label>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar tudo
        </Button>
      </div>
    </div>
  );
}

function VisualTab() {
  const [palette, setPalette] = useState<PaletteId>("indigo");
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const t = loadStoredTheme();
    setPalette(t.palette);
    setMode(t.mode);
  }, []);

  function pickPalette(id: PaletteId) {
    setPalette(id);
    applyTheme(id, mode);
    toast.success("Paleta aplicada");
  }
  function toggleMode() {
    const next: ThemeMode = mode === "light" ? "dark" : "light";
    setMode(next);
    applyTheme(palette, next);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Modo de exibição</h3>
          <p className="text-xs text-muted-foreground">Claro ou escuro.</p>
        </div>
        <Button variant="outline" onClick={toggleMode}>
          {mode === "light" ? <><Moon className="h-4 w-4 mr-2" /> Ativar modo escuro</> : <><Sun className="h-4 w-4 mr-2" /> Ativar modo claro</>}
        </Button>
      </div>

      <div>
        <h3 className="font-semibold mb-1">Paleta de cores</h3>
        <p className="text-xs text-muted-foreground mb-3">Escolha uma das paletas predefinidas. A mudança é instantânea.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PALETTES.map((p) => {
            const active = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPalette(p.id)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  active ? "border-primary shadow-[var(--shadow-card)]" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{p.name}</span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex gap-1.5 mb-2">
                  <span className="h-6 flex-1 rounded" style={{ background: p.preview.primary }} />
                  <span className="h-6 flex-1 rounded" style={{ background: p.preview.accent }} />
                  <span className="h-6 flex-1 rounded border border-border" style={{ background: p.preview.bg }} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
