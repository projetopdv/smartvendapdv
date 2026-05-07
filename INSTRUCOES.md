# SmartVenda PDV — Guia de Instalação Externa

Sistema completo de PDV multi-empresa (SaaS), construído em React + TanStack Start + Supabase.

---

## 1. Pré-requisitos

- **Node.js 20+** ou **Bun 1.1+**
- Conta no **Supabase** (https://supabase.com) — plano free já funciona
- (Opcional) Conta no **Cloudflare Pages**, **Vercel** ou **Netlify** para publicar

---

## 2. Subindo o backend Supabase

### 2.1 Criar projeto
1. Acesse https://supabase.com/dashboard → **New project**
2. Escolha região (`South America (São Paulo)` recomendado para o Brasil)
3. Defina senha do banco e aguarde 1–2 min

### 2.2 Importar o schema
No projeto Supabase → **SQL Editor**, execute em ordem todos os arquivos da pasta `supabase/migrations/` (do mais antigo ao mais novo).

### 2.3 Configurar Auth
Em **Authentication → Providers → Email**:
- ✅ Enable email provider
- ❌ **Disable** "Enable email signups" (só admin cria contas)
- ✅ Enable "Confirm email" desativado (auto-confirm)

### 2.4 Criar o admin manualmente
SQL Editor:
```sql
-- 1. Crie o usuário admin no painel Auth → Users → Add user (ex.: dedett55@gmail.com / Nunes123!)
-- 2. Depois rode:
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'dedett55@gmail.com'
ON CONFLICT DO NOTHING;
```

### 2.5 Storage
Em **Storage**, o bucket `product-images` será criado pelas migrações. Confirme que está **público**.

### 2.6 Deploy das Edge Functions
Instale a CLI: `npm i -g supabase`. Depois:
```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-update-role --no-verify-jwt
supabase functions deploy admin-delete-user --no-verify-jwt
```

---

## 3. Rodando o frontend localmente

### 3.1 Instalar dependências
```bash
bun install         # ou: npm install
```

### 3.2 Configurar variáveis de ambiente
Crie `.env` na raiz:
```
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_ANON_KEY
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_REF
```
A `anon key` está em **Settings → API** do Supabase.

### 3.3 Rodar
```bash
bun run dev         # ou: npm run dev
```
Acesse http://localhost:8080 e entre com o usuário admin que você criou.

---

## 4. Publicando em produção

### Cloudflare Pages (recomendado, grátis)
1. Suba o código para um repositório GitHub
2. Cloudflare Pages → **Create project** → conecte o repo
3. Build command: `bun run build`
4. Build output directory: `dist`
5. Adicione as 3 variáveis `VITE_*` em **Environment Variables**

### Vercel
1. `vercel` na raiz → siga o assistente
2. Adicione as variáveis em **Settings → Environment Variables**

### Netlify
1. New site from Git
2. Build: `bun run build` · Publish dir: `dist`
3. Adicione as variáveis

---

## 5. Como usar como SaaS (vender o app)

Cada login = 1 empresa isolada (RLS por `owner_id`). Para criar uma nova empresa cliente:

1. Acesse `/usuarios` (logado como admin)
2. Clique **Adicionar usuário**
3. Informe email + senha + nome
4. O sistema cria automaticamente a empresa, perfil e plano trial de 30 dias

Você pode editar planos em **SQL Editor** na tabela `public.plans`.

---

## 6. Funcionalidades disponíveis

- **Dashboard** com métricas em tempo real
- **Frente de Caixa (PDV)** com PIX QR Code, impressão e atalhos
- **Mesas** com nome do cliente, tempo de ocupação, dividir conta
- **Clientes** — CRUD completo (busca, telefone, email, doc)
- **Produtos & Estoque** com categorias, fotos, alertas
- **Financeiro** — caixa, contas a pagar/receber, lucro real
- **Relatórios** diários/mensais/anuais
- **Configurações**: perfil, PIX, impressora, **paletas de cores** (7 temas)
- **Controle rápido** — visão mobile-first
- **Multi-tenant** com RLS total

---

## 7. Suporte / problemas comuns

| Problema | Solução |
|---|---|
| "Login não funciona" | Verifique se o usuário existe em `auth.users` e tem role admin em `user_roles` |
| "Mesa não abre" | A função RPC `open_table_order` precisa estar instalada (rode todas as migrations) |
| "Imagens não aparecem" | Bucket `product-images` precisa estar público |
| "PIX QR não funciona" | Configure chave, nome e cidade em Configurações → PIX |
| Edge Function 401 | Use `--no-verify-jwt` no deploy |

---

## 8. Próximas fases (Fase 2 — futuras)

- Integração Resend para envio de relatórios por email
- Sugestão de compra com IA (produtos sem giro)
- Modo offline completo (IndexedDB + sincronização)
- App nativo Android/iOS via Capacitor

---

**SmartVenda PDV © 2026** — Sistema próprio, 100% seu.
