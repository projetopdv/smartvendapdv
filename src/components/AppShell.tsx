import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  Store,
  ShoppingCart,
  Package,
  BarChart3,
  LogOut,
  ShieldCheck,
  Receipt,
  Utensils,
  Settings,
  Wallet,
  Menu,
  Smartphone,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavLink {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const links: NavLink[] = [
  { to: "/dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/controle", label: "Controle rápido", icon: <Smartphone className="h-4 w-4" /> },
  { to: "/pdv", label: "Frente de Caixa", icon: <ShoppingCart className="h-4 w-4" /> },
  { to: "/mesas", label: "Mesas", icon: <Utensils className="h-4 w-4" /> },
  { to: "/produtos", label: "Produtos & Estoque", icon: <Package className="h-4 w-4" /> },
  { to: "/clientes", label: "Clientes", icon: <Users className="h-4 w-4" /> },
  { to: "/vendas", label: "Vendas", icon: <Receipt className="h-4 w-4" /> },
  { to: "/financeiro", label: "Financeiro", icon: <Wallet className="h-4 w-4" /> },
  { to: "/configuracoes", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
  { to: "/usuarios", label: "Usuários", icon: <ShieldCheck className="h-4 w-4" />, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const roleLabel = isAdmin
    ? "Administrador"
    : roles.includes("manager")
    ? "Gerente"
    : roles.includes("cashier")
    ? "Caixa"
    : "Sem permissão";

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {links.map((l) => {
        if (l.adminOnly && !isAdmin) return null;
        const active = location.pathname === l.to;
        return (
          <Link
            key={l.to}
            to={l.to}
            onClick={onItemClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            {l.icon}
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const Footer = () => (
    <div className="border-t border-sidebar-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabel}</p>
        </div>
      </div>
      <Button
        onClick={handleLogout}
        variant="ghost"
        size="sm"
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4 mr-2" /> Sair
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg">SmartVenda PDV</span>
        </div>
        <NavList />
        <Footer />
      </aside>

      {/* Conteúdo + topbar mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
              <SheetHeader className="px-6 py-4 border-b border-sidebar-border">
                <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Store className="h-4 w-4" />
                  </div>
                  SmartVenda PDV
                </SheetTitle>
              </SheetHeader>
              <NavList onItemClick={() => setMobileOpen(false)} />
              <Footer />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm">SmartVenda PDV</span>
          </div>
          <div className="w-9" /> {/* spacer */}
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
