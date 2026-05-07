import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "cashier";

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  rolesLoading: boolean;
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  isAdmin: boolean;
} {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setRolesLoading(true);
        // Defer Supabase call to avoid deadlock
        setTimeout(() => {
          void loadRoles(newSession.user.id);
        }, 0);
      } else {
        setRoles([]);
        setRolesLoading(false);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        setRolesLoading(true);
        void loadRoles(existing.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
    setRolesLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRoles([]);
  }

  return {
    user,
    session,
    roles,
    loading,
    rolesLoading,
    signOut,
    isAdmin: roles.includes("admin"),
  };
}
