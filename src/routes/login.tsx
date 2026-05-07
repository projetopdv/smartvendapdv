import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Lock, Mail, Store, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — SmartVenda PDV" },
      { name: "description", content: "Acesse seu painel do SmartVenda PDV: vendas, estoque e gestão em um só lugar." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Senha precisa ter no mínimo 8 caracteres").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/escolher" });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/escolher" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar";
      if (msg.toLowerCase().includes("invalid login")) {
        toast.error("Email ou senha incorretos");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT: branding panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 text-primary-foreground overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
            <Store className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">SmartVenda PDV</span>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-5xl font-bold tracking-tight leading-tight">
              O sistema de PDV completo para a sua loja.
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-md">
              Vendas, estoque, financeiro e relatórios em uma plataforma rápida, moderna e feita para o varejo brasileiro.
            </p>
          </div>

          <ul className="space-y-4 text-white/90">
            <Feature icon={<Zap className="h-5 w-5" />} title="Frente de caixa veloz" desc="Otimizado para touch, scanner e atalhos de teclado." />
            <Feature icon={<BarChart3 className="h-5 w-5" />} title="Dashboard em tempo real" desc="Acompanhe vendas, lucro e ticket médio ao vivo." />
            <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Seguro e auditável" desc="Controle de acessos e log de ações por usuário." />
          </ul>
        </div>

        <p className="relative z-10 text-sm text-white/70">© {new Date().getFullYear()} SmartVenda PDV · Pronto para o seu balcão.</p>

        {/* Decorative orbs */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      {/* RIGHT: form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">SmartVenda PDV</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Entrar na sua conta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse o painel e comece a vender em segundos.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                  maxLength={255}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={72}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-base font-semibold shadow-[var(--shadow-elegant)]"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            O cadastro de novas empresas é feito exclusivamente pelo administrador do sistema.
          </div>

          <p className="mt-10 text-xs text-muted-foreground text-center">
            Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.
          </p>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Voltar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-white/75">{desc}</p>
      </div>
    </li>
  );
}
