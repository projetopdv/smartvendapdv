import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Plus,
  Search,
  Pencil,
  AlertTriangle,
  Loader2,
  Tag,
  Upload,
  ImageIcon,
  Trash2,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos & Estoque — SmartVenda PDV" },
      { name: "description", content: "Cadastre produtos, gerencie estoque e categorias da sua loja." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ProductsPage />
      </AppShell>
    </AuthGate>
  ),
});

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  description: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  active: boolean;
  image_url: string | null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const productSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  price: z.number().min(0, "Preço inválido"),
  cost: z.number().min(0, "Custo inválido"),
  stock: z.number().min(0, "Estoque inválido"),
  min_stock: z.number().min(0, "Estoque mínimo inválido"),
  unit: z.string().min(1).max(8),
});

function ProductsPage() {
  const { isAdmin, roles } = useAuth();
  const canEdit = isAdmin || roles.includes("manager");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  async function deleteProduct() {
    if (!toDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produto excluído");
    setToDelete(null);
    void load();
  }

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts((p ?? []) as Product[]);
    setCategories((c ?? []) as Category[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.min_stock)).length;
  const totalValue = products.reduce((s, p) => s + Number(p.price) * Number(p.stock), 0);

  function openNew() {
    setEditing({
      id: "",
      name: "",
      barcode: "",
      sku: "",
      description: "",
      category_id: null,
      price: 0,
      cost: 0,
      stock: 0,
      min_stock: 0,
      unit: "un",
      active: true,
      image_url: null,
    });
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Produtos & Estoque
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie seu catálogo, preços e níveis de estoque.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Categorias
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo produto
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Total de produtos" value={products.length.toString()} icon={<Package className="h-5 w-5" />} />
        <Kpi label="Valor em estoque" value={BRL.format(totalValue)} icon={<Tag className="h-5 w-5" />} />
        <Kpi
          label="Estoque baixo"
          value={lowStock.toString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          warn={lowStock > 0}
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, código ou SKU..."
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const cat = categories.find((c) => c.id === p.category_id);
                    const low = Number(p.stock) <= Number(p.min_stock);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.barcode || p.sku || "—"}
                        </TableCell>
                        <TableCell>
                          {cat ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: `${cat.color}20`, color: cat.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{BRL.format(Number(p.price))}</TableCell>
                        <TableCell className="text-right">
                          <span className={low ? "text-warning font-semibold" : ""}>
                            {Number(p.stock)} {p.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit && (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setToDelete(p)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        product={editing}
        categories={categories}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />

      <CategoriesDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        categories={categories}
        onChanged={() => void load()}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" será removido permanentemente. Vendas anteriores não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, icon, warn }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${warn ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Product | null>(product);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setForm(product), [product]);

  if (!form) return null;

  async function handleUpload(file: File) {
    if (!form) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm({ ...form, image_url: data.publicUrl });
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form) return;
    const parsed = productSchema.safeParse({
      name: form.name,
      price: Number(form.price),
      cost: Number(form.cost),
      stock: Number(form.stock),
      min_stock: Number(form.min_stock),
      unit: form.unit,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        name: form.name.trim(),
        barcode: form.barcode?.toString().trim() || null,
        sku: form.sku?.toString().trim() || null,
        description: form.description?.toString().trim() || null,
        category_id: form.category_id || null,
        price: Number(form.price),
        cost: Number(form.cost),
        stock: Number(form.stock),
        min_stock: Number(form.min_stock),
        unit: form.unit,
        active: form.active,
        image_url: form.image_url || null,
      };
      if (form.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Produto atualizado");
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, owner_id: user.id });
        if (error) throw error;
        toast.success("Produto criado");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Preencha as informações do produto.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex items-center gap-4 p-3 border border-border rounded-lg">
            <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-sm">Imagem / Ícone do produto</Label>
              <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP (máx. 5MB)</p>
              <div className="flex gap-2 pt-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  {form.image_url ? "Trocar" : "Enviar"}
                </Button>
                {form.image_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: null })}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Código de barras</Label>
            <Input value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} maxLength={64} />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={64} />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="un">Unidade (un)</SelectItem>
                <SelectItem value="kg">Quilograma (kg)</SelectItem>
                <SelectItem value="g">Grama (g)</SelectItem>
                <SelectItem value="l">Litro (l)</SelectItem>
                <SelectItem value="ml">Mililitro (ml)</SelectItem>
                <SelectItem value="cx">Caixa (cx)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preço de venda *</Label>
            <Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Custo</Label>
            <Input type="number" min={0} step={0.01} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Estoque atual</Label>
            <Input type="number" min={0} step={0.001} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Estoque mínimo</Label>
            <Input type="number" min={0} step={0.001} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  async function add() {
    if (!name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Não autenticado"); return; }
    const { error } = await supabase.from("categories").insert({ name: name.trim(), color, owner_id: user.id });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setColor("#6366f1");
    toast.success("Categoria criada");
    onChanged();
  }

  async function remove() {
    if (!toDelete) return;
    const { error } = await supabase.from("categories").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Categoria removida");
    setToDelete(null);
    onChanged();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Categorias</DialogTitle>
            <DialogDescription>Crie e organize categorias para seus produtos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bebidas" maxLength={60} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 rounded-md border border-input cursor-pointer bg-transparent"
                />
              </div>
              <Button onClick={add} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-auto">
              {categories.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma categoria criada</div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(c)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos vinculados a "{toDelete?.name}" ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
