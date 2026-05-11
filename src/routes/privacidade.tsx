import { createFileRoute, Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — SmartVenda PDV" },
      { name: "description", content: "Política de privacidade da plataforma SmartVenda PDV." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <Store className="h-5 w-5 text-primary" /> SmartVenda PDV
          </Link>
          <Link to="/termos" className="text-sm text-primary hover:underline">
            Termos de Uso
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-sm sm:prose-base">
        <h1>Política de Privacidade</h1>
        <p>
          Esta política descreve como o SmartVenda PDV coleta, usa e protege seus dados.
        </p>
        <h2>1. Dados coletados</h2>
        <ul>
          <li>Dados de cadastro (nome, email, telefone, CNPJ).</li>
          <li>Dados operacionais (vendas, produtos, clientes, mesas, financeiro).</li>
          <li>Dados técnicos (presença online, último acesso, navegador).</li>
          <li>Mensagens trocadas com o suporte.</li>
        </ul>
        <h2>2. Uso dos dados</h2>
        <p>
          Usamos seus dados para operar a plataforma, prestar suporte, enviar notificações
          relevantes (estoque baixo, contas a pagar, assinatura) e melhorar o serviço.
        </p>
        <h2>3. Compartilhamento</h2>
        <p>
          Não vendemos seus dados. Compartilhamos apenas com provedores de infraestrutura (hospedagem
          e envio de email) sob contrato de confidencialidade.
        </p>
        <h2>4. Segurança</h2>
        <p>
          Aplicamos criptografia em trânsito (HTTPS) e regras de acesso por linha (RLS) no banco de
          dados, garantindo que cada cliente acesse apenas seus próprios registros.
        </p>
        <h2>5. Seus direitos (LGPD)</h2>
        <p>
          Você pode solicitar a qualquer momento: acesso, correção, exportação ou exclusão dos seus
          dados. Basta abrir um chamado pela Central de Mensagens.
        </p>
        <h2>6. Cookies</h2>
        <p>Usamos apenas cookies essenciais para autenticação e preferências de tema.</p>
        <h2>7. Contato</h2>
        <p>Dúvidas sobre privacidade? Fale com o suporte pela Central de Mensagens.</p>
      </main>
    </div>
  );
}
