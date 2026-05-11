import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Plus, Loader2, Trash2, ShieldAlert, Crown, Sparkles, Mail } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — SmartVenda PDV" },
      { name: "description", content: "Gerencie usuários, permissões e papéis do sistema." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <UsersGate />
      </AppShell>
    </AuthGate>
  ),
});

function UsersGate() {
  const { isAdmin, loading, rolesLoading } = useAuth();
  if (loading || rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" />;
  return <UsersPage />;
}

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  role: "admin" | "manager" | "cashier" | "support" | null;
  plan_name: string | null;
  plan_status: string | null;
  plan_expires_at: string | null;
  subscription_id: string | null;
  presence_status: "online" | "offline";
  last_seen_at: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  active: boolean;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const newUserSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  full_name: z.string().trim().min(1, "Nome obrigatório").max(120),
  password: z.string().min(8, "Senha mínima de 8 caracteres").max(72),
  role: z.enum(["admin", "manager", "cashier", "support"]),
});

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Caixa",
  support: "Suporte",
};

function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [planUser, setPlanUser] = useState<UserRow | null>(null);
  const [emailUser, setEmailUser] = useState<UserRow | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: subs }, { data: pls }, { data: presence }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,created_at"),
      supabase.from("user_roles").select("user_id,role"),
      supabase
        .from("user_subscriptions")
        .select("id,user_id,status,expires_at,plan_id,plans(name)")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase.from("plans").select("*").order("price"),
      supabase.from("user_presence").select("user_id,status,last_seen_at"),
    ]);
    const merged: UserRow[] = (profiles ?? []).map((p) => {
      const sub = subs?.find((s: any) => s.user_id === p.id);
      const pres = presence?.find((x: any) => x.user_id === p.id);
      const isOnline =
        pres?.status === "online" &&
        pres?.last_seen_at &&
        Date.now() - new Date(pres.last_seen_at).getTime() < 90_000;
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        role: (roles?.find((r) => r.user_id === p.id)?.role ?? null) as UserRow["role"],
        plan_name: (sub as any)?.plans?.name ?? null,
        plan_status: sub?.status ?? null,
        plan_expires_at: sub?.expires_at ?? null,
        subscription_id: sub?.id ?? null,
        presence_status: isOnline ? "online" : "offline",
        last_seen_at: pres?.last_seen_at ?? null,
      };
    });
    merged.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    setUsers(merged);
    setPlans((pls ?? []) as Plan[]);
    setLoading(false);
  }

  async function changeRole(userId: string, role: UserRow["role"]) {
    if (!role) return;
    const { error } = await supabase.functions.invoke("admin-update-role", {
      body: { user_id: userId, role },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Permissão atualizada");
    void load();
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    const { error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: deleteUser.id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Usuário removido");
    setDeleteUser(null);
    void load();
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Usuários & Permissões
          </h1>
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem criar, editar ou remover usuários.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {p.billing_cycle === "lifetime" ? <Crown className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.billing_cycle === "lifetime" ? "Pagamento único" : "Cobrança mensal"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{BRL.format(Number(p.price))}</div>
              <div className="text-xs text-muted-foreground">
                {p.billing_cycle === "lifetime" ? "vitalício" : "/mês"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const expDate = u.plan_expires_at ? new Date(u.plan_expires_at) : null;
                const now = new Date();
                const expired = expDate && expDate < now;
                const daysLeft = expDate
                  ? Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000)
                  : null;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">
                        {u.full_name || "—"}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            u.presence_status === "online" ? "bg-emerald-500" : "bg-gray-400"
                          }`}
                        />
                        <span className="text-xs">
                          {u.presence_status === "online"
                            ? "Online"
                            : u.last_seen_at
                              ? `Visto ${new Date(u.last_seen_at).toLocaleString("pt-BR")}`
                              : "Nunca acessou"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role ?? ""}
                        onValueChange={(v) => changeRole(u.id, v as UserRow["role"])}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Sem papel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="cashier">Caixa</SelectItem>
                          <SelectItem value="support">Suporte</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {!u.plan_name ? (
                        <span className="text-xs text-muted-foreground">Sem plano</span>
                      ) : expired ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                          {u.plan_name} — Atrasado
                        </span>
                      ) : daysLeft !== null && daysLeft <= 5 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                          {u.plan_name} — Vence em {daysLeft}d
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          {u.plan_name} — Ativo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEmailUser(u)} title="Enviar email" disabled={!u.email}>
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPlanUser(u)} title="Gerenciar plano">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        {!isSelf && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteUser(u)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateUserDialog open={open} onOpenChange={setOpen} onCreated={() => { setOpen(false); void load(); }} />

      <AssignPlanDialog
        user={planUser}
        plans={plans}
        onOpenChange={(o) => !o && setPlanUser(null)}
        onSaved={() => { setPlanUser(null); void load(); }}
      />

      <SendEmailDialog
        user={emailUser}
        onOpenChange={(o) => !o && setEmailUser(null)}
      />

      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Excluir usuário?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O usuário <strong>{deleteUser?.email}</strong> perderá o acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssignPlanDialog({
  user,
  plans,
  onOpenChange,
  onSaved,
}: {
  user: UserRow | null;
  plans: Plan[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState<string>("");
  const [customExpiry, setCustomExpiry] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlanId("");
    setCustomExpiry("");
  }, [user?.id]);

  if (!user) return null;

  async function assign() {
    if (!user || !planId) {
      toast.error("Selecione um plano");
      return;
    }
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setSaving(true);
    try {
      // Cancel current active subscriptions for this user
      await supabase
        .from("user_subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", user.id)
        .eq("status", "active");

      const expiresAt = customExpiry
        ? new Date(customExpiry + "T23:59:59").toISOString()
        : plan.billing_cycle === "lifetime"
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("user_subscriptions").insert({
        user_id: user.id,
        plan_id: plan.id,
        status: "active",
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
      if (error) throw error;
      toast.success("Plano atribuído");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atribuir plano");
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (!user?.subscription_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_subscriptions")
      .update({ status: "canceled" })
      .eq("id", user.subscription_id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plano cancelado");
    onSaved();
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" /> Plano de {user.full_name || user.email}
          </DialogTitle>
          <DialogDescription>
            {user.plan_name
              ? `Plano atual: ${user.plan_name}`
              : "Este usuário ainda não tem nenhum plano ativo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label>Selecione um plano</Label>
          <div className="space-y-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  planId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.billing_cycle === "lifetime" ? (
                      <Crown className="h-4 w-4 text-primary" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{BRL.format(Number(p.price))}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {p.billing_cycle === "lifetime" ? "vitalício" : "mensal"}
                    </div>
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Data de expiração customizada (opcional)</Label>
          <Input type="date" value={customExpiry} onChange={(e) => setCustomExpiry(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Se vazio: vitalício ou +30 dias conforme o plano. Use para período de teste personalizado.</p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {user.subscription_id && (
            <Button variant="outline" onClick={cancel} disabled={saving} className="text-destructive">
              Cancelar plano atual
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Fechar
          </Button>
          <Button onClick={assign} disabled={saving || !planId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Atribuir plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "cashier" | "support">("cashier");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail(""); setFullName(""); setPassword(""); setRole("cashier");
    }
  }, [open]);

  async function submit() {
    const parsed = newUserSchema.safeParse({ email, full_name: fullName, password, role });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: parsed.data,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado!");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Crie um acesso para sua equipe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label>Senha provisória</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Compartilhe com o usuário.</p>
          </div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Caixa</SelectItem>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="support">Suporte</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendEmailDialog({ user, onOpenChange }: { user: UserRow | null; onOpenChange: (o: boolean) => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { setSubject(""); setMessage(""); }, [user?.id]);
  if (!user) return null;

  async function send() {
    if (!user || !subject.trim() || !message.trim()) { toast.error("Preencha assunto e mensagem"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-send-email", {
        body: { user_id: user.id, subject: subject.trim(), message: message.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Email enviado!");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally { setSending(false); }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Enviar email</DialogTitle>
          <DialogDescription>Para: <b>{user.full_name || user.email}</b> ({user.email})</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Atualização importante" />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={4000} placeholder="Escreva sua mensagem..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={send} disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
