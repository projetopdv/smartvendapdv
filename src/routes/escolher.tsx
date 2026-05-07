import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { LayoutDashboard, Smartphone, LogOut, Store } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/escolher")({
  head: () => ({
    meta: [
      { title: "Escolher modo — SmartVenda PDV" },
      { name: "description", content: "Escolha entre o painel completo ou o controle rápido." },
    ],
  }),
  component: () => (
    <AuthGate>
      <EscolherPage />
    </AuthGate>
  ),
});

function EscolherPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--gradient-hero)" }}
    >
      <header className="flex items-center justify-between p-4 sm:p-6 text-white">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/25">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold">SmartVenda PDV</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center mb-8 sm:mb-12 text-white max-w-xl">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Olá, {user?.email?.split("@")[0]} 👋
          </h1>
          <p className="mt-3 text-base sm:text-lg text-white/85">
            Como você quer começar agora?
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 w-full max-w-3xl">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="group rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 p-6 sm:p-8 text-left text-white hover:bg-white/15 transition-all hover:scale-[1.02]"
          >
            <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:bg-white/30">
              <LayoutDashboard className="h-7 w-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Dashboard completo</h2>
            <p className="mt-2 text-sm sm:text-base text-white/80">
              Sistema inteiro: vendas, PDV, mesas, estoque, financeiro, configurações.
            </p>
            <p className="mt-4 text-xs uppercase tracking-wider text-white/60">
              Ideal para desktop / balcão →
            </p>
          </button>

          <button
            onClick={() => navigate({ to: "/controle" })}
            className="group rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 p-6 sm:p-8 text-left text-white hover:bg-white/15 transition-all hover:scale-[1.02]"
          >
            <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:bg-white/30">
              <Smartphone className="h-7 w-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Controle rápido</h2>
            <p className="mt-2 text-sm sm:text-base text-white/80">
              Visão de bolso da sua loja: vendas do dia, caixa aberto, alertas — direto do celular.
            </p>
            <p className="mt-4 text-xs uppercase tracking-wider text-white/60">
              Ideal para celular / dono na rua →
            </p>
          </button>
        </div>

        <Link
          to="/dashboard"
          className="mt-8 text-sm text-white/70 hover:text-white underline"
        >
          Pular e ir direto para o painel
        </Link>
      </main>
    </div>
  );
}
