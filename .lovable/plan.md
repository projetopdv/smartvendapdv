## Objetivo

Em vez de depender de domínio verificado no Resend, vamos usar **sua conta Gmail** como remetente. Os emails sairão como se você mesmo tivesse enviado (do seu endereço, com seu nome). É exatamente o caso de uso do conector Google Mail do Lovable.

## Como vai funcionar

- Você conecta sua conta Gmail uma única vez (OAuth do Google, 2 cliques).
- A função `admin-send-email` passa a montar a mensagem em RFC 2822, codificar em base64url e enviar via Gmail API (`/users/me/messages/send`) usando o gateway de conectores do Lovable.
- Remetente = seu Gmail. Destinatário = qualquer email (sem limite de sandbox).
- Quem recebe vê a mensagem chegando do seu endereço pessoal e pode responder direto pra você.

## Pontos importantes (precisa saber)

1. **Todos os emails saem da SUA conta** — o app inteiro compartilha sua caixa. Quando qualquer admin do sistema usar a função "enviar email", sai do seu Gmail.
2. Aparece na sua pasta **Enviados** do Gmail normalmente.
3. Limite do Gmail: ~500 emails/dia (conta gratuita) ou ~2000/dia (Workspace). Mais que suficiente pra suporte.
4. Quando você comprar o domínio depois, a gente troca pro Lovable Emails sem refazer nada na UI.

## Plano de execução

### 1. Conectar sua conta Google Mail
Vou abrir o fluxo de conexão pedindo apenas o escopo `gmail.send` (mínimo necessário — não leio nada da sua caixa, só envio).

### 2. Reescrever `supabase/functions/admin-send-email/index.ts`
- Mantém a checagem de auth + role admin (igual hoje).
- Remove a chamada ao Resend.
- Monta o email em RFC 2822 com headers `To`, `Subject`, `From` (seu nome + email), `Reply-To`, `Content-Type: text/html; charset=UTF-8`.
- Codifica em base64url e faz `POST` para `https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send` com headers:
  - `Authorization: Bearer ${LOVABLE_API_KEY}`
  - `X-Connection-Api-Key: ${GOOGLE_MAIL_*}` (variável injetada pelo conector)
- Mantém o mesmo HTML bonitinho que já existe (cabeçalho roxo, mensagem, assinatura).

### 3. "Pré-setar" o Lovable Emails para o futuro
Como você pediu pra deixar pronto pro dia que comprar o domínio: **não faço nada agora** nessa parte (configurar domínio sem ter o domínio real só gera lixo de DNS). Quando você comprar, é só me avisar "configurei o domínio X" e em 1 mensagem eu migro tudo pro Lovable Emails (que é mais robusto: fila, retry, supressão, unsubscribe automático).

### 4. Testar
Depois de implementar, mando você abrir Mensagens → Suporte e enviar um email de teste pra qualquer endereço pra confirmar que chega.

## Arquivos que serão alterados

- `supabase/functions/admin-send-email/index.ts` — reescrito para usar Gmail API.

Nenhuma migração de banco, nenhuma mudança de UI.

## Confirma que posso seguir?

Se sim, ao aprovar o plano eu já chamo o fluxo de conexão do Google Mail e em seguida atualizo a edge function.