import { supabase } from "@/integrations/supabase/client";

export type TicketAction =
  | "created"
  | "accepted"
  | "closed"
  | "deleted"
  | "rated"
  | "reopened";

export async function logTicketEvent(params: {
  ticketId: string;
  actorId: string;
  actorName: string;
  actorRole: "user" | "support" | "admin" | "system";
  action: TicketAction;
  outcome?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("support_ticket_logs" as any).insert({
      ticket_id: params.ticketId,
      actor_id: params.actorId,
      actor_name: params.actorName,
      actor_role: params.actorRole,
      action: params.action,
      outcome: params.outcome ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    });
  } catch {
    /* swallow — log is best-effort */
  }
}
