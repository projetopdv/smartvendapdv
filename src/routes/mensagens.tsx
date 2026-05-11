import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Loader2,
  Send,
  Mic,
  MessageSquare,
  MessageSquarePlus,
  Megaphone,
  Headphones,
  Check,
  CheckCheck,
  Trash2,
  X,
  Star,
  CheckCircle2,
  XCircle,
  UserCheck,
  Bell,
  Image as ImageIcon,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logTicketEvent } from "@/lib/ticket-log";

export const Route = createFileRoute("/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — SmartVenda PDV" },
      { name: "description", content: "Central de mensagens, suporte e avisos." },
    ],
  }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MessagesPage />
      </AppShell>
    </AuthGate>
  ),
});

type Tab = "broadcast" | "support";

/* -------- Browser notification helpers -------- */
function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission().catch(() => undefined);
  }
}
function notify(title: string, body: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (document.visibilityState === "visible") return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/favicon.ico", tag: "smartvenda-msg" });
  } catch {
    /* noop */
  }
}

async function getMyDisplay(userId: string, asSupport: boolean) {
  const { data: prof } = await supabase
    .from("profiles")
    .select("support_display_name,full_name,email")
    .eq("id", userId)
    .maybeSingle();
  if (asSupport) {
    return (
      prof?.support_display_name ||
      `Team Support Smart PDV - ${prof?.full_name || prof?.email || "Atendente"}`
    );
  }
  return prof?.full_name || prof?.email || "Cliente";
}

function MessagesPage() {
  const { user, isAdmin, roles } = useAuth();
  const isSupport = isAdmin || roles.includes("support" as never);
  const [tab, setTab] = useState<Tab>("broadcast");
  const [notifAllowed, setNotifAllowed] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission === "granted"
      : false,
  );

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> Mensagens
          </h1>
          <p className="text-sm text-muted-foreground">
            Receba avisos do SmartVenda PDV e fale com o suporte em tempo real.
          </p>
        </div>
        {!notifAllowed && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!("Notification" in window)) {
                toast.error("Este navegador não suporta notificações.");
                return;
              }
              const p = await Notification.requestPermission();
              setNotifAllowed(p === "granted");
              if (p === "granted") toast.success("Notificações ativadas");
            }}
          >
            <Bell className="h-4 w-4 mr-1" /> Ativar notificações
          </Button>
        )}
      </header>

      <div className="flex gap-2 mb-4 border-b border-border">
        <TabButton active={tab === "broadcast"} onClick={() => setTab("broadcast")}>
          <Megaphone className="h-4 w-4" /> SmartVenda PDV
        </TabButton>
        <TabButton active={tab === "support"} onClick={() => setTab("support")}>
          <Headphones className="h-4 w-4" /> Suporte
        </TabButton>
      </div>

      {tab === "broadcast" ? (
        <BroadcastPanel canSend={isAdmin} userId={user.id} />
      ) : (
        <SupportPanel userId={user.id} isSupport={isSupport} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- BROADCAST ---------------- */

type BroadcastCategory = "info" | "warning" | "success" | "update";

interface Broadcast {
  id: string;
  sender_id: string;
  title: string | null;
  content: string;
  created_at: string;
  image_url: string | null;
  category: BroadcastCategory | string;
  link_url: string | null;
}

const CATEGORY_META: Record<
  BroadcastCategory,
  { label: string; icon: typeof Megaphone; bg: string; ring: string; chip: string }
> = {
  info: {
    label: "Informação",
    icon: Megaphone,
    bg: "bg-primary text-primary-foreground",
    ring: "ring-primary/20",
    chip: "bg-primary/10 text-primary",
  },
  warning: {
    label: "Alerta",
    icon: Bell,
    bg: "bg-amber-500 text-white",
    ring: "ring-amber-500/20",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  success: {
    label: "Sucesso",
    icon: CheckCircle2,
    bg: "bg-emerald-500 text-white",
    ring: "ring-emerald-500/20",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  update: {
    label: "Atualização",
    icon: Star,
    bg: "bg-violet-500 text-white",
    ring: "ring-violet-500/20",
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
};

function BroadcastPanel({ canSend, userId }: { canSend: boolean; userId: string }) {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [category, setCategory] = useState<BroadcastCategory>("info");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    void load(true);
    const ch = supabase
      .channel("rt-broadcasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcasts" },
        (payload: any) => {
          const b = payload.new as Broadcast;
          if (b.sender_id !== userId) {
            notify("📢 Novo aviso SmartVenda PDV", b.title || b.content.slice(0, 80));
          }
          void load(false);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "broadcasts" },
        () => void load(false),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(initial: boolean) {
    if (initial) setLoading(true);
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as Broadcast[]);
    if (initial) setLoading(false);
    if (data?.length) {
      await supabase.from("broadcast_reads").upsert(
        data.map((d: any) => ({ broadcast_id: d.id, user_id: userId })),
        { onConflict: "broadcast_id,user_id" },
      );
    }
  }

  function pickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    if (sendingRef.current) return;
    if (!content.trim()) return;
    sendingRef.current = true;
    setSending(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `broadcasts/${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-images")
          .upload(path, imageFile, { upsert: false });
        if (upErr) {
          toast.error("Falha ao enviar imagem: " + upErr.message);
          return;
        }
        const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
        image_url = pub.publicUrl;
      }
      const { error } = await supabase.from("broadcasts").insert({
        sender_id: userId,
        title: title.trim() || null,
        content: content.trim(),
        category,
        link_url: linkUrl.trim() || null,
        image_url,
      } as any);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTitle("");
      setContent("");
      setLinkUrl("");
      setCategory("info");
      clearImage();
      toast.success("Aviso enviado a todos os usuários");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar este aviso?")) return;
    await supabase.from("broadcasts").delete().eq("id", id);
  }

  return (
    <div className="space-y-4">
      {canSend && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Enviar aviso para todos
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as BroadcastCategory[]).map((k) => {
              const m = CATEGORY_META[k];
              const Icon = m.icon;
              const active = category === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCategory(k)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? `${m.bg} border-transparent shadow-sm`
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              );
            })}
          </div>

          <Input
            placeholder="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Mensagem para todos os usuários da plataforma…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <Input
            placeholder="Link opcional (https://...)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />

          {imagePreview && (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="prévia"
                className="max-h-48 rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                aria-label="Remover imagem"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
          />

          <div className="flex justify-between items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              {imageFile ? "Trocar imagem" : "Adicionar imagem"}
            </Button>
            <Button onClick={send} disabled={sending || !content.trim()}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-1" /> Enviar
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30 text-sm font-semibold flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> SmartVenda PDV — Avisos
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum aviso ainda. Os avisos enviados pela equipe SmartVenda PDV aparecerão aqui.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((b) => {
              const cat = (CATEGORY_META[b.category as BroadcastCategory] ??
                CATEGORY_META.info) as (typeof CATEGORY_META)[BroadcastCategory];
              const Icon = cat.icon;
              return (
                <div key={b.id} className="p-4 flex items-start gap-3">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ${cat.bg} ${cat.ring}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          SmartVenda PDV
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cat.chip}`}
                        >
                          {cat.label}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        {new Date(b.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {b.title && <div className="font-semibold mb-1">{b.title}</div>}
                    <div className="text-sm whitespace-pre-wrap">{b.content}</div>
                    {b.image_url && (
                      <a
                        href={b.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-2"
                      >
                        <img
                          src={b.image_url}
                          alt={b.title || "imagem do aviso"}
                          className="max-h-72 rounded-lg border border-border object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                    {b.link_url && (
                      <a
                        href={b.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-2 text-xs font-medium text-primary hover:underline break-all"
                      >
                        {b.link_url}
                      </a>
                    )}
                  </div>
                  {canSend && (
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- SUPPORT CHAT ---------------- */

interface Ticket {
  id: string;
  user_id: string;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_by_role: string | null;
  closed_reason: string | null;
  closed_outcome: string | null;
  closed_at: string | null;
  rating: number | null;
  rating_comment: string | null;
  rated_at: string | null;
  last_message_at: string;
  user_unread: number;
  support_unread: number;
  user_name?: string;
  user_email?: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  type: string;
  content: string | null;
  audio_url: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
  sender_display?: string;
  sender_avatar?: string | null;
}

interface TicketLog {
  id: string;
  ticket_id: string;
  actor_id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  outcome: string | null;
  reason: string | null;
  created_at: string;
}

function SupportPanel({ userId, isSupport }: { userId: string; isSupport: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);
  const [deleteTicket, setDeleteTicket] = useState<Ticket | null>(null);
  const [supportTab, setSupportTab] = useState<"unread" | "open" | "closed">("unread");
  const activeTicketIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTicketIdRef.current = activeTicket?.id ?? null;
  }, [activeTicket?.id]);

  useEffect(() => {
    void initTickets(true);
    const ch = supabase
      .channel("rt-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => void initTickets(false),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initTickets(initial: boolean) {
    if (initial) setLoading(true);
    if (isSupport) {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .order("last_message_at", { ascending: false });
      const list = (data ?? []) as Ticket[];
      if (list.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in(
            "id",
            list.map((t) => t.user_id),
          );
        list.forEach((t) => {
          const p = profs?.find((x) => x.id === t.user_id);
          t.user_name = p?.full_name || p?.email || "Usuário";
          t.user_email = p?.email || "";
        });
      }
      setTickets(list);
      if (activeTicketIdRef.current) {
        const refreshed = list.find((t) => t.id === activeTicketIdRef.current);
        if (refreshed) setActiveTicket(refreshed);
        else setActiveTicket(list[0] ?? null);
      } else if (list[0]) {
        setActiveTicket(list[0]);
      }
    } else {
      // Do NOT auto-create. Just load any existing tickets.
      const { data: all } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false });
      const list = (all ?? []) as Ticket[];
      setTickets(list);
      if (activeTicketIdRef.current) {
        const refreshed = list.find((t) => t.id === activeTicketIdRef.current);
        if (refreshed) {
          setActiveTicket(refreshed);
          if (initial) setLoading(false);
          return;
        }
      }
      const unrated = list.find((t) => t.status === "closed" && !t.rating);
      const openOne = list.find((t) => t.status !== "closed");
      setActiveTicket(unrated || openOne || list[0] || null);
    }
    if (initial) setLoading(false);
  }

  async function startNewTicket() {
    const { data: idData, error } = await supabase.rpc("get_or_create_my_ticket");
    if (error) {
      toast.error(error.message);
      return;
    }
    const ticketId = idData as unknown as string;
    activeTicketIdRef.current = ticketId;
    await initTickets(false);
    toast.success("Chat de suporte iniciado");
  }

  async function acceptTicket(t: Ticket) {
    const displayName = await getMyDisplay(userId, true);
    const { error } = await supabase
      .from("support_tickets")
      .update({
        assigned_to: userId,
        assigned_name: displayName,
        status: "assigned",
      })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("messages").insert({
      ticket_id: t.id,
      sender_id: userId,
      sender_role: "system",
      type: "system",
      content: `✅ Chamado aceito por ${displayName}. Em breve responderemos.`,
    });
    await logTicketEvent({
      ticketId: t.id,
      actorId: userId,
      actorName: displayName,
      actorRole: "support",
      action: "accepted",
    });
    toast.success("Chamado aceito");
  }

  async function confirmDelete() {
    if (!deleteTicket) return;
    const t = deleteTicket;
    const displayName = await getMyDisplay(userId, true);

    // Log first (FK to ticket would be lost after delete — we record before)
    await logTicketEvent({
      ticketId: t.id,
      actorId: userId,
      actorName: displayName,
      actorRole: "support",
      action: "deleted",
      outcome: t.closed_outcome,
      reason: `Chamado de ${t.user_name || t.user_email || "usuário"} excluído após encerramento.`,
      metadata: {
        was_status: t.status,
        was_rating: t.rating,
        was_closed_reason: t.closed_reason,
      },
    });

    // delete messages first then ticket
    await supabase.from("messages").delete().eq("ticket_id", t.id);
    const { error } = await supabase.from("support_tickets").delete().eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Chamado excluído");
    setDeleteTicket(null);
    if (activeTicket?.id === t.id) setActiveTicket(null);
    void initTickets(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className={`grid gap-4 ${isSupport ? "md:grid-cols-[300px_1fr]" : ""}`}>
        {isSupport && (
          <div className="rounded-xl border border-border bg-card overflow-hidden h-[70vh] flex flex-col">
            <div className="p-3 border-b border-border bg-muted/30 text-sm font-semibold flex items-center justify-between">
              <span>Chamados</span>
              <Button
                variant="ghost"
                size="icon"
                title="Histórico de auditoria"
                onClick={() => setLogsOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
            {(() => {
              const unreadList = tickets
                .filter((t) => t.status !== "closed" && (t.support_unread ?? 0) > 0)
                .sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime(),
                );
              const openList = tickets
                .filter((t) => t.status === "open" || t.status === "assigned")
                .sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime(),
                );
              const closedList = tickets
                .filter((t) => t.status === "closed")
                .sort(
                  (a, b) =>
                    new Date(b.closed_at || b.last_message_at).getTime() -
                    new Date(a.closed_at || a.last_message_at).getTime(),
                );
              const visible =
                supportTab === "unread"
                  ? unreadList
                  : supportTab === "open"
                    ? openList
                    : closedList;
              return (
                <>
                  <div className="grid grid-cols-3 border-b border-border text-[11px]">
                    {(
                      [
                        ["unread", "Recebidas", unreadList.length],
                        ["open", "Abertos", openList.length],
                        ["closed", "Encerrados", closedList.length],
                      ] as const
                    ).map(([key, label, count]) => (
                      <button
                        key={key}
                        onClick={() => setSupportTab(key)}
                        className={`py-2 px-1 font-medium transition-colors ${
                          supportTab === key
                            ? "bg-primary/10 text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        {label} ({count})
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {visible.length === 0 && (
                      <div className="p-4 text-xs text-muted-foreground">
                        {supportTab === "unread"
                          ? "Nenhuma mensagem nova."
                          : supportTab === "open"
                            ? "Nenhum chamado aberto."
                            : "Nenhum chamado encerrado."}
                      </div>
                    )}
                    {visible.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTicket(t)}
                        className={`w-full text-left p-3 text-sm hover:bg-muted/50 ${
                          activeTicket?.id === t.id
                            ? "bg-primary/5 border-l-2 border-primary"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">{t.user_name}</div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(
                              t.status === "closed"
                                ? t.closed_at || t.last_message_at
                                : t.last_message_at,
                            ).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.user_email}
                        </div>
                        {t.assigned_name && t.status !== "closed" && (
                          <div className="text-[10px] text-blue-600 truncate mt-0.5">
                            👤 {t.assigned_name}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              t.status === "open"
                                ? "bg-amber-100 text-amber-700"
                                : t.status === "assigned"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {t.status === "open"
                              ? "aberto"
                              : t.status === "assigned"
                                ? "em atendimento"
                                : "fechado"}
                          </span>
                          {t.support_unread > 0 && (
                            <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5">
                              {t.support_unread}
                            </span>
                          )}
                        </div>
                        {t.status === "closed" && t.rating && (
                          <div className="flex items-center gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-2.5 w-2.5 ${
                                  i < (t.rating || 0)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/40"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTicket ? (
          <div className="space-y-3">
            <ChatBox
              key={activeTicket.id}
              ticket={activeTicket}
              userId={userId}
              isSupport={isSupport}
              onAccept={() => acceptTicket(activeTicket)}
              onTicketChange={() => initTickets(false)}
              onRequestDelete={() => setDeleteTicket(activeTicket)}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              {isSupport
                ? "Selecione um chamado."
                : "Você ainda não tem nenhum chamado de suporte."}
            </div>
            {!isSupport && (
              <Button onClick={startNewTicket}>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Iniciar chat de suporte
              </Button>
            )}
          </div>
        )}
        {!isSupport && activeTicket && activeTicket.status === "closed" &&
          !tickets.some((t) => t.status !== "closed") && (
            <div className="md:col-span-full">
              <Button onClick={startNewTicket} variant="outline" className="w-full">
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Iniciar novo chat de suporte
              </Button>
            </div>
          )}
      </div>

      <LogsDialog open={logsOpen} onClose={() => setLogsOpen(false)} />

      <AlertDialog open={!!deleteTicket} onOpenChange={(o) => !o && setDeleteTicket(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este chamado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O chamado e todas as mensagens serão removidos. O evento
              ficará registrado no histórico de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChatBox({
  ticket,
  userId,
  isSupport,
  onAccept,
  onTicketChange,
  onRequestDelete,
}: {
  ticket: Ticket;
  userId: string;
  isSupport: boolean;
  onAccept: () => void;
  onTicketChange: () => void;
  onRequestDelete: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);

  // recording state
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cancelRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const ratingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [rating, setRating] = useState(false);

  const [closeOpen, setCloseOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOwnerOfTicket = ticket.user_id === userId;
  const myRoleInChat: "user" | "support" = isOwnerOfTicket ? "user" : "support";

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`rt-msg-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload: any) => {
          const m = payload.new as Message;
          if (m.sender_id !== userId && m.sender_role !== "system") {
            const who =
              m.sender_role === "user"
                ? ticket.user_name || "Cliente"
                : "Suporte SmartVenda PDV";
            const body =
              m.type === "audio"
                ? "🎤 Mensagem de áudio"
                : m.type === "image"
                  ? "🖼 Imagem"
                  : (m.content || "").slice(0, 100);
            notify(`💬 ${who}`, body);
          }
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    const msgs = (data ?? []) as Message[];

    const allSenders = Array.from(
      new Set(msgs.filter((m) => m.sender_role !== "system").map((m) => m.sender_id)),
    );
    if (allSenders.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,support_display_name,avatar_url")
        .in("id", allSenders);
      msgs.forEach((m) => {
        if (m.sender_role === "system") return;
        const p = profs?.find((x) => x.id === m.sender_id) as any;
        m.sender_avatar = p?.avatar_url ?? null;
        if (m.sender_role !== "user") {
          m.sender_display =
            p?.support_display_name ||
            `Team Support Smart PDV - ${p?.full_name || "Atendente"}`;
        } else {
          m.sender_display = p?.full_name || "Cliente";
        }
      });
    }
    setMessages(msgs);

    const unread = msgs.filter((m) => !m.read_at && m.sender_id !== userId);
    if (unread.length) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in(
          "id",
          unread.map((m) => m.id),
        );
      await supabase
        .from("support_tickets")
        .update(isSupport && !isOwnerOfTicket ? { support_unread: 0 } : { user_unread: 0 })
        .eq("id", ticket.id);
    }
  }

  const isClosed = ticket.status === "closed";

  async function sendText() {
    if (!text.trim() || isClosed) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: myRoleInChat,
      type: "text",
      content: text.trim(),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
  }

  /* ---- Image upload ---- */
  function pickImage() {
    if (isClosed) return;
    fileInputRef.current?.click();
  }
  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage({ file, url: URL.createObjectURL(file) });
  }

  function cancelPendingImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage(null);
  }

  async function sendPendingImage() {
    if (!pendingImage || isClosed) return;
    const file = pendingImage.file;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${ticket.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
      const { error } = await supabase.from("messages").insert({
        ticket_id: ticket.id,
        sender_id: userId,
        sender_role: myRoleInChat,
        type: "image",
        image_url: data.publicUrl,
      });
      if (error) throw error;
      cancelPendingImage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar imagem");
    } finally {
      setUploadingImage(false);
    }
  }

  /* ---- Recording ---- */
  async function startRecording() {
    if (isClosed) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (cancelRef.current) {
          chunksRef.current = [];
          setSeconds(0);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        setSeconds(0);
        if (blob.size > 0) await uploadAudio(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  }

  function cancelRecording() {
    if (!recorderRef.current) return;
    cancelRef.current = true;
    recorderRef.current.stop();
    setRecording(false);
    toast.info("Gravação cancelada");
  }

  function sendRecording() {
    if (!recorderRef.current) return;
    cancelRef.current = false;
    recorderRef.current.stop();
    setRecording(false);
  }

  async function uploadAudio(blob: Blob) {
    const path = `${ticket.id}/${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from("chat-audio").upload(path, blob, {
      contentType: "audio/webm",
    });
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("chat-audio").getPublicUrl(path);
    await supabase.from("messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: myRoleInChat,
      type: "audio",
      audio_url: data.publicUrl,
    });
  }

  /* ---- Close ticket ---- */
  async function handleClose(outcome: "resolved" | "unresolved", reason: string) {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
    if (!reason.trim()) {
      toast.error("Informe o motivo do encerramento.");
      return;
    }
    const role: "user" | "support" = isOwnerOfTicket ? "user" : "support";
    const displayName = await getMyDisplay(userId, !isOwnerOfTicket);

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: "closed",
        closed_by: userId,
        closed_by_name: displayName,
        closed_by_role: role,
        closed_outcome: outcome,
        closed_reason: reason.trim(),
        closed_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: "system",
      type: "system",
      content: `🔒 Chamado encerrado por ${displayName} — ${
        outcome === "resolved" ? "Resolvido" : "Não resolvido"
      }. Motivo: ${reason.trim()}`,
    });
    await logTicketEvent({
      ticketId: ticket.id,
      actorId: userId,
      actorName: displayName,
      actorRole: role,
      action: "closed",
      outcome,
      reason: reason.trim(),
    });
    setCloseOpen(false);
    toast.success("Chamado encerrado");
    onTicketChange();
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  }

  async function handleRate(stars: number, comment: string) {
    if (ratingRef.current) return;
    ratingRef.current = true;
    setRating(true);
    try {
    const { error } = await supabase
      .from("support_tickets")
      .update({
        rating: stars,
        rating_comment: comment.trim() || null,
        rated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: "system",
      type: "system",
      content: `⭐ Avaliação enviada: ${stars}/5${comment.trim() ? ` — "${comment.trim()}"` : ""}`,
    });
    const displayName = await getMyDisplay(userId, false);
    await logTicketEvent({
      ticketId: ticket.id,
      actorId: userId,
      actorName: displayName,
      actorRole: "user",
      action: "rated",
      outcome: `${stars}/5`,
      reason: comment.trim() || null,
    });
    setRateOpen(false);
    toast.success("Obrigado pela avaliação!");
    onTicketChange();
    } finally {
      ratingRef.current = false;
      setRating(false);
    }
  }

  const showRateBanner = isClosed && isOwnerOfTicket && !ticket.rating;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden h-[70vh] flex flex-col">
      <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {isSupport && !isOwnerOfTicket
              ? `Chamado de ${ticket.user_name || "cliente"}`
              : "Suporte SmartVenda PDV"}
          </div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
            {ticket.status === "open" && "Aguardando atendimento"}
            {ticket.status === "assigned" && (
              <>
                <UserCheck className="h-3 w-3 text-blue-600" />
                <span>
                  Em atendimento por <strong>{ticket.assigned_name || "Suporte"}</strong>
                </span>
              </>
            )}
            {ticket.status === "closed" && (
              <>
                {ticket.closed_outcome === "resolved" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span>
                  Encerrado por {ticket.closed_by_name || "—"}
                  {ticket.closed_outcome === "resolved" ? " (resolvido)" : " (não resolvido)"}
                </span>
              </>
            )}
          </div>
          {isClosed && ticket.rating && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">Cliente avaliou:</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < (ticket.rating || 0)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  }`}
                />
              ))}
              {ticket.rating_comment && (
                <span className="text-[10px] text-muted-foreground italic ml-1 truncate max-w-[200px]">
                  "{ticket.rating_comment}"
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSupport && !isOwnerOfTicket && ticket.status === "open" && (
            <Button size="sm" onClick={onAccept}>
              Aceitar chamado
            </Button>
          )}
          {!isClosed && (ticket.status === "assigned" || isOwnerOfTicket) && (
            <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
              Finalizar chamado
            </Button>
          )}
          {isSupport && !isOwnerOfTicket && isClosed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRequestDelete}
              title="Excluir chamado"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* RATING BANNER (very visible to user) */}
      {showRateBanner && (
        <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Star className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                Como foi seu atendimento?
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                Sua avaliação ajuda a equipe de suporte a melhorar.
              </div>
            </div>
          </div>
          <Button onClick={() => setRateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0">
            <Star className="h-4 w-4 mr-1" /> Avaliar
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/10">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-10">
            {isSupport && !isOwnerOfTicket
              ? "Sem mensagens ainda neste chamado."
              : "Envie sua dúvida — nossa equipe responde em breve."}
          </div>
        )}
        {messages.map((m) => {
          if (m.sender_role === "system") {
            return (
              <div key={m.id} className="flex justify-center my-1">
                <div className="text-[11px] bg-muted px-3 py-1.5 rounded-full text-muted-foreground max-w-[80%] text-center">
                  {m.content}
                </div>
              </div>
            );
          }
          const mine = m.sender_id === userId;
          const isSupportMsg = m.sender_role !== "user" && m.sender_role !== "system";
          const initial = (m.sender_display || "?").charAt(0).toUpperCase();
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="relative flex-shrink-0">
                  <Avatar className="h-8 w-8">
                    {m.sender_avatar ? <AvatarImage src={m.sender_avatar} alt={m.sender_display || ""} /> : null}
                    <AvatarFallback className="text-[10px] bg-muted">{initial}</AvatarFallback>
                  </Avatar>
                  {isSupportMsg && (
                    <span
                      title="Suporte oficial"
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center border border-background shadow-sm"
                    >
                      <Headphones className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}
              >
                {!mine && isSupportMsg && (
                  <div className="text-[10px] font-semibold mb-0.5 opacity-80 flex items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wide">
                      <Headphones className="h-2 w-2" /> Suporte
                    </span>
                    <span>{m.sender_display}</span>
                  </div>
                )}
                {m.type === "audio" && m.audio_url ? (
                  <audio controls src={m.audio_url} className="max-w-[240px]" />
                ) : m.type === "image" && m.image_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImg(m.image_url)}
                    className="block"
                  >
                    <img
                      src={m.image_url}
                      alt="anexo"
                      className="rounded-lg max-w-[240px] max-h-[280px] object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
                <div
                  className={`text-[10px] mt-0.5 flex items-center gap-1 ${
                    mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
                  }`}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {mine &&
                    (m.read_at ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    ))}
                </div>
              </div>
              {mine && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {m.sender_avatar ? <AvatarImage src={m.sender_avatar} alt={m.sender_display || ""} /> : null}
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{initial}</AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
      </div>

      {!isClosed && (
        <div className="p-2 border-t border-border">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
          {pendingImage && (
            <div className="mb-2 flex items-start gap-3 p-2 rounded-md border border-border bg-muted/30">
              <img
                src={pendingImage.url}
                alt="Pré-visualização"
                className="h-20 w-20 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{pendingImage.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(pendingImage.file.size / 1024).toFixed(0)} KB
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void sendPendingImage()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelPendingImage}
                    disabled={uploadingImage}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
          {recording ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
                <span className="text-sm font-medium text-destructive">
                  Gravando… {formatSeconds(seconds)}
                </span>
              </div>
              <Button onClick={cancelRecording} variant="outline" size="icon" title="Cancelar">
                <X className="h-4 w-4" />
              </Button>
              <Button onClick={sendRecording} size="icon" title="Enviar áudio">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Digite uma mensagem…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendText();
                  }
                }}
              />
              <Button
                onClick={pickImage}
                variant="outline"
                size="icon"
                title="Enviar imagem"
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={startRecording}
                variant="outline"
                size="icon"
                title="Gravar áudio"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button onClick={sendText} disabled={sending || !text.trim()} size="icon">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      {isClosed && !showRateBanner && (
        <div className="p-3 border-t border-border bg-muted/30 text-center text-xs text-muted-foreground">
          Este chamado foi encerrado.{" "}
          {ticket.closed_reason && <span>Motivo: {ticket.closed_reason}</span>}
        </div>
      )}

      <CloseDialog open={closeOpen} onClose={() => setCloseOpen(false)} onConfirm={handleClose} loading={closing} />
      <RateDialog open={rateOpen} onClose={() => setRateOpen(false)} onConfirm={handleRate} loading={rating} />

      {/* Image preview lightbox */}
      <Dialog open={!!previewImg} onOpenChange={(o) => !o && setPreviewImg(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/95">
          {previewImg && (
            <img
              src={previewImg}
              alt="Visualização"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/* ---- Logs Drawer ---- */
function LogsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<TicketLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("support_ticket_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs(((data ?? []) as unknown) as TicketLog[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.action === filter);
  }, [logs, filter]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Histórico de chamados
          </DialogTitle>
          <DialogDescription>
            Registro completo de todos os eventos: criação, aceite, encerramento, avaliação e
            exclusão.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 pb-2">
          {[
            { v: "all", l: "Todos" },
            { v: "accepted", l: "Aceitos" },
            { v: "closed", l: "Encerrados" },
            { v: "rated", l: "Avaliados" },
            { v: "deleted", l: "Excluídos" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === f.v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Sem registros.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((l) => (
                <div
                  key={l.id}
                  className="border border-border rounded-lg p-3 bg-card text-sm space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <ActionBadge action={l.action} outcome={l.outcome} />
                      <span className="font-medium truncate">{l.actor_name || "—"}</span>
                      <span className="text-xs text-muted-foreground">({l.actor_role})</span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ticket: <code className="text-[10px]">{l.ticket_id.slice(0, 8)}…</code>
                  </div>
                  {l.reason && (
                    <div className="text-xs text-foreground/80 bg-muted/40 rounded p-2 mt-1 whitespace-pre-wrap">
                      {l.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionBadge({ action, outcome }: { action: string; outcome: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    created: { label: "criado", className: "bg-blue-100 text-blue-700" },
    accepted: { label: "aceito", className: "bg-indigo-100 text-indigo-700" },
    closed: {
      label:
        outcome === "resolved"
          ? "encerrado ✓"
          : outcome === "unresolved"
            ? "encerrado ✗"
            : "encerrado",
      className:
        outcome === "resolved"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700",
    },
    rated: { label: `avaliado ${outcome ?? ""}`, className: "bg-amber-100 text-amber-700" },
    deleted: { label: "excluído", className: "bg-destructive/10 text-destructive" },
    reopened: { label: "reaberto", className: "bg-blue-100 text-blue-700" },
  };
  const b = map[action] ?? { label: action, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${b.className}`}>
      {b.label}
    </span>
  );
}

/* ---- Dialogs ---- */
function CloseDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (outcome: "resolved" | "unresolved", reason: string) => void;
  loading?: boolean;
}) {
  const [outcome, setOutcome] = useState<"resolved" | "unresolved">("resolved");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) {
      setOutcome("resolved");
      setReason("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar chamado</DialogTitle>
          <DialogDescription>
            Conte o que aconteceu — isso fica registrado no histórico do chamado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOutcome("resolved")}
              className={`p-3 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                outcome === "resolved"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" /> Deu certo
            </button>
            <button
              type="button"
              onClick={() => setOutcome("unresolved")}
              className={`p-3 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                outcome === "unresolved"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <XCircle className="h-4 w-4" /> Não deu certo
            </button>
          </div>
          <Textarea
            placeholder="Descreva o motivo / resultado do atendimento…"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(outcome, reason)} disabled={!reason.trim() || loading}>
            {loading ? "Finalizando..." : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (stars: number, comment: string) => void;
  loading?: boolean;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (open) {
      setStars(5);
      setComment("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar atendimento</DialogTitle>
          <DialogDescription>Sua avaliação ajuda a melhorar o suporte.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-1 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Comentário (opcional)…"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(stars, comment)} disabled={loading}>
            {loading ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
