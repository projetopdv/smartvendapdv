import { createFileRoute, Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — SmartVenda PDV" },
      { name: "description", content: "Termos de uso da plataforma SmartVenda PDV." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <Store className="h-5 w-5 text-primary" /> SmartVenda PDV
          </Link>
          <Link to="/privacidade" className="text-sm text-primary hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-sm sm:prose-base">
        <h1>Termos de Uso</h1>
        <p>
          Bem-vindo ao SmartVenda PDV. Ao usar nossa plataforma, você concorda com os termos abaixo.
        </p>
        <h2>1. Conta</h2>
        <p>
          Você é responsável pela confidencialidade da sua conta e por todas as atividades realizadas
          a partir dela. Notifique imediatamente o suporte em caso de uso indevido.
        </p>
        <h2>2. Uso permitido</h2>
        <p>
          A plataforma deve ser usada apenas para fins comerciais lícitos. Não é permitido revender o
          serviço, fazer engenharia reversa ou tentar acessar dados de outros usuários.
        </p>
        <h2>3. Pagamentos e plano</h2>
        <p>
          O acesso ao sistema depende de uma assinatura ativa. Caso a assinatura expire ou esteja em
          atraso, o acesso pode ser suspenso até a regularização.
        </p>
        <h2>4. Dados</h2>
        <p>
          Todos os dados (vendas, clientes, produtos, mesas, etc.) pertencem ao seu negócio. Tratamos
          esses dados conforme a nossa Política de Privacidade.
        </p>
        <h2>5. Disponibilidade</h2>
        <p>
          Buscamos manter a plataforma disponível 24/7, mas podemos realizar manutenções programadas
          ou interromper o serviço por motivos técnicos. Não nos responsabilizamos por perdas
          indiretas decorrentes de indisponibilidade.
        </p>
        <h2>6. Alterações</h2>
        <p>
          Estes termos podem ser atualizados a qualquer momento. Notificaremos as mudanças
          relevantes pela Central de Mensagens da plataforma.
        </p>
        <h2>7. Contato</h2>
        <p>Em caso de dúvidas, fale com nosso suporte pela Central de Mensagens.</p>
      </main>
    </div>
  );
}
