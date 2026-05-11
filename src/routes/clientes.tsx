import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Search, Loader2, Pencil, Trash2, Phone, Mail, FileText, Truck, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes & Fornecedores — SmartVenda PDV" },
      { name: "description", content: "Cadastro completo de clientes e fornecedores da sua empresa." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <Page />
      </AppShell>
    </AuthGate>
  ),
});

interface Customer {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

function Page() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Clientes & Fornecedores
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie sua base de contatos comerciais.</p>
      </header>
      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes"><Users className="h-4 w-4 mr-1" />Clientes</TabsTrigger>
          <TabsTrigger value="fornecedores"><Truck className="h-4 w-4 mr-1" />Fornecedores</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="mt-4"><ClientesTab /></TabsContent>
        <TabsContent value="fornecedores" className="mt-4"><FornecedoresTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ClientesTab() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) toast.error("Erro ao carregar clientes");
    setItems((data ?? []) as Customer[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.document?.toLowerCase().includes(q),
    );
  }, [items, search]);

  async function remove() {
    if (!toDelete) return;
    const { error } = await supabase.from("customers").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente removido");
    setToDelete(null);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-10" />
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Novo cliente</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {items.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum cliente encontrado."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  {c.document && <p className="text-xs text-muted-foreground">{c.document}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /> {c.email}</p>}
                {c.notes && <p className="flex items-start gap-1.5 line-clamp-2"><FileText className="h-3 w-3 mt-0.5" /> {c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerDialog open={creating || !!editing} editing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => void load()} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FornecedoresTab() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("suppliers").select("*").order("name");
    if (error) toast.error("Erro ao carregar fornecedores");
    setItems((data ?? []) as Supplier[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.document?.toLowerCase().includes(q),
    );
  }, [items, search]);

  async function remove() {
    if (!toDelete) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor removido");
    setToDelete(null);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fornecedor..." className="pl-10" />
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Novo fornecedor</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {items.length === 0 ? "Nenhum fornecedor cadastrado." : "Nenhum fornecedor encontrado."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-primary" />{c.name}</h3>
                  {c.document && <p className="text-xs text-muted-foreground">{c.document}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /> {c.email}</p>}
                {c.address && <p className="flex items-center gap-1.5 truncate"><MapPin className="h-3 w-3" /> {c.address}</p>}
                {c.notes && <p className="flex items-start gap-1.5 line-clamp-2"><FileText className="h-3 w-3 mt-0.5" /> {c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <SupplierDialog open={creating || !!editing} editing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => void load()} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: Customer | null; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setDoc(editing.document ?? ""); setPhone(editing.phone ?? "");
      setEmail(editing.email ?? ""); setNotes(editing.notes ?? "");
    } else { setName(""); setDoc(""); setPhone(""); setEmail(""); setNotes(""); }
  }, [editing, open]);

  async function save() {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const payload = { name: name.trim(), document: doc.trim() || null, phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null };
    if (editing) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Cliente atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return toast.error("Não autenticado"); }
      const { error } = await supabase.from("customers").insert({ ...payload, owner_id: user.id });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Cliente cadastrado");
    }
    onClose(); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Cadastro fixo de cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CPF/CNPJ</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} maxLength={20} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: Supplier | null; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setDoc(editing.document ?? ""); setPhone(editing.phone ?? "");
      setEmail(editing.email ?? ""); setAddress(editing.address ?? ""); setNotes(editing.notes ?? "");
    } else { setName(""); setDoc(""); setPhone(""); setEmail(""); setAddress(""); setNotes(""); }
  }, [editing, open]);

  async function save() {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const payload = { name: name.trim(), document: doc.trim() || null, phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null, notes: notes.trim() || null };
    if (editing) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Fornecedor atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return toast.error("Não autenticado"); }
      const { error } = await supabase.from("suppliers").insert({ ...payload, owner_id: user.id });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Fornecedor cadastrado");
    }
    onClose(); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>Cadastro de fornecedor para contas a pagar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome / Razão Social *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CNPJ/CPF</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} maxLength={20} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></div>
          <div className="space-y-1.5"><Label>Endereço</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
