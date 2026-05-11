# SmartVenda PDV — Deploy fora do Lovable

Projeto 100% portável: React + TanStack Start (Cloudflare Workers) + Supabase (DB/Auth/Storage/Edge Functions) + Gmail SMTP para envio de email.

---

## 1. Pré-requisitos

- **Bun** (https://bun.sh) ou Node 20+
- **Wrangler CLI**: `npm install -g wrangler`
- **Supabase CLI**: `npm install -g supabase` (para deploy das edge functions e migrations)
- Conta Cloudflare (free funciona)
- Conta Supabase (free funciona) — https://supabase.com
- Conta Gmail com **App Password** habilitado

---

## 2. Instalar dependências

```bash
bun install
```

---

## 3. Criar seu projeto Supabase

1. Crie um projeto novo em https://supabase.com
2. Anote: **Project URL**, **anon key** e **service_role key** (Settings → API)
3. Anote o **Project Ref** (parte do subdomínio: `xxxx.supabase.co` → `xxxx`)

---

## 4. Configurar `.env`

Crie/edite o arquivo `.env` na raiz com SEUS valores:

```env
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_ANON_KEY
VITE_SUPABASE_PROJECT_ID=SEU_REF
```

---

## 5. Aplicar migrations no SEU Supabase

```bash
supabase login
supabase link --project-ref SEU_REF
supabase db push
```

Isso cria todas as tabelas, RLS policies, funções, triggers e buckets de storage.

---

## 6. Configurar Auth (Supabase Dashboard)

Authentication → Providers:
- **Email**: ativar (e desativar "Confirm email" se quiser auto-login no signup)
- **Google** (opcional): configurar OAuth Client ID/Secret

Authentication → URL Configuration:
- **Site URL**: URL do seu Cloudflare Worker (ex: `https://smartvenda.SEU.workers.dev` ou seu domínio)
- **Redirect URLs**: adicione a mesma URL + `/**`

---

## 7. Configurar secrets das Edge Functions

No Supabase Dashboard → Edge Functions → Secrets, adicione:

| Secret | Valor |
|---|---|
| `GMAIL_USER` | seu email Gmail (ex: `voce@gmail.com`) |
| `GMAIL_APP_PASSWORD` | App Password de 16 caracteres (veja abaixo) |
| `ADMIN_NOTIFICATION_EMAIL` | email para receber notificações de estoque baixo |

**Como gerar Gmail App Password:**
1. Ative 2FA na sua conta Google: https://myaccount.google.com/security
2. Acesse: https://myaccount.google.com/apppasswords
3. Crie um app password chamado "SmartVenda" → copie os 16 caracteres (sem espaços)

> **Obs:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` já são injetados automaticamente pelo Supabase nas edge functions, NÃO precisa adicionar.

---

## 8. Deploy das Edge Functions

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-update-role
supabase functions deploy admin-send-email
supabase functions deploy notify-low-stock
```

Ou tudo de uma vez:
```bash
supabase functions deploy
```

---

## 9. Rodar local

```bash
bun run dev
```

Abre em http://localhost:8080

---

## 10. Deploy no Cloudflare Workers

### 10.1 Login

```bash
wrangler login
```

### 10.2 (Opcional) Renomear o worker

Edite `wrangler.jsonc` e troque `"name"` para o nome desejado.

### 10.3 Build + Deploy

```bash
bun run build
wrangler deploy
```

A URL final será algo como `https://smartvenda.SEU.workers.dev`.

> Como as variáveis começam com `VITE_`, elas são embutidas no bundle no momento do build. Não precisa configurar secrets no Cloudflare.

### 10.4 Voltar no Supabase

Após ter a URL do Cloudflare, volte em **Auth → URL Configuration** e atualize **Site URL** + **Redirect URLs** com a URL real.

---

## 11. Domínio customizado

Cloudflare Dashboard → Workers & Pages → seu worker → Settings → Triggers → **Custom Domains** → Add Custom Domain.

O domínio precisa estar gerenciado pela Cloudflare (DNS na Cloudflare).

Depois, atualize de novo a **Site URL** no Supabase.

---

## 12. GitHub + CI/CD (opcional)

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/SEU_USER/SEU_REPO.git
git push -u origin main
```

Para deploy automático via GitHub Actions, criar `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Adicione `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` em Settings → Secrets do GitHub.

---

## 13. Estrutura

- `src/routes/` — páginas (TanStack Router file-based)
- `src/components/` — componentes React
- `src/integrations/supabase/` — cliente Supabase (NÃO EDITAR `client.ts` e `types.ts` — gere `types.ts` com `supabase gen types typescript --linked > src/integrations/supabase/types.ts`)
- `supabase/functions/` — edge functions (Deno)
- `supabase/migrations/` — histórico de schema
- `wrangler.jsonc` — config do Cloudflare Worker
- `.wrangler/` — cache local do wrangler (incluso no zip pra acelerar primeiro deploy)

---

## 14. Sobre o envio de email (Mensagens → Suporte)

A função `admin-send-email` usa **Gmail SMTP via `denomailer`**. NÃO depende mais do conector Lovable. Funciona em qualquer Supabase desde que `GMAIL_USER` e `GMAIL_APP_PASSWORD` estejam setados.

O `Reply-To` do email vai com o email do admin que enviou — então quando o usuário responder no Gmail dele, a resposta cai direto na caixa do admin (não passa pelo painel).

---

## 15. Problemas comuns

| Problema | Solução |
|---|---|
| `Failed to fetch dynamically imported module` | Limpar cache do navegador (Ctrl+Shift+R) |
| Email não envia | Conferir `GMAIL_USER` e `GMAIL_APP_PASSWORD` nos secrets do Supabase. App Password é diferente da senha normal! |
| 401 nas edge functions | Usuário não logado ou token expirou. Logar de novo. |
| `relation "xxx" does not exist` | Migrations não aplicadas. Rodar `supabase db push`. |
| Worker retorna 500 | Ver logs: `wrangler tail` |
| Login com Google falha | Conferir Site URL + Redirect URLs no Supabase Auth |

---

Pronto! Qualquer dúvida, os logs são seus melhores amigos:
- Cloudflare: `wrangler tail`
- Supabase Edge Functions: Dashboard → Edge Functions → Logs
- Supabase DB: Dashboard → Database → Logs
