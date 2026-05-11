import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  usePresence(user?.id);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
