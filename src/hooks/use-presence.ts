import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Heartbeat de presença: marca o usuário como online enquanto a aba estiver aberta. */
export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    let stopped = false;

    async function ping(status: "online" | "offline") {
      try {
        await supabase.from("user_presence").upsert(
          {
            user_id: userId!,
            status,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      } catch {
        /* noop */
      }
    }

    void ping("online");
    const t = setInterval(() => {
      if (!stopped && document.visibilityState === "visible") void ping("online");
    }, 30_000);

    const onHide = () => {
      if (document.visibilityState === "hidden") void ping("offline");
      else void ping("online");
    };
    document.addEventListener("visibilitychange", onHide);
    const onUnload = () => {
      const blob = new Blob(
        [
          JSON.stringify({
            user_id: userId,
            status: "offline",
            last_seen_at: new Date().toISOString(),
          }),
        ],
        { type: "application/json" },
      );
      // best-effort
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`,
        blob,
      );
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      void ping("offline");
    };
  }, [userId]);
}
