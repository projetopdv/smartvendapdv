import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserBody {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "manager" | "cashier";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Acesso negado: somente admin" }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const body: CreateUserBody = await req.json();
    if (!body.email || !body.password || !body.role) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Erro ao criar" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Ensure profile (trigger may not run if email/role conflict)
    await admin.from("profiles").upsert({
      id: created.user.id,
      email: body.email,
      full_name: body.full_name,
    });

    // Insert role
    await admin.from("user_roles").insert({
      user_id: created.user.id,
      role: body.role,
    });

    // Send welcome email with current plan & expiration
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const { data: sub } = await admin
          .from("user_subscriptions")
          .select("expires_at, plans(name, billing_cycle)")
          .eq("user_id", created.user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const planName = (sub as any)?.plans?.name ?? "Plano Free";
        const cycle = (sub as any)?.plans?.billing_cycle ?? "mensal";
        const expires = (sub as any)?.expires_at
          ? new Date((sub as any).expires_at).toLocaleDateString("pt-BR")
          : (cycle === "lifetime" ? "Vitalício" : "—");
        const roleNames: Record<string, string> = {
          admin: "Administrador", manager: "Gerente", cashier: "Caixa", support: "Suporte",
        };
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <h2 style="color:#4f46e5">👋 Bem-vindo ao SmartVenda PDV!</h2>
            <p>Olá <b>${body.full_name}</b>,</p>
            <p>Sua conta foi criada com sucesso pelo administrador.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
              <tr><td style="padding:6px;background:#f3f4f6"><b>Email de acesso</b></td><td style="padding:6px">${body.email}</td></tr>
              <tr><td style="padding:6px;background:#f3f4f6"><b>Senha provisória</b></td><td style="padding:6px"><code>${body.password}</code></td></tr>
              <tr><td style="padding:6px;background:#f3f4f6"><b>Permissão</b></td><td style="padding:6px">${roleNames[body.role] ?? body.role}</td></tr>
              <tr><td style="padding:6px;background:#f3f4f6"><b>Plano atual</b></td><td style="padding:6px">${planName}</td></tr>
              <tr><td style="padding:6px;background:#f3f4f6"><b>Vencimento</b></td><td style="padding:6px">${expires}</td></tr>
            </table>
            <p>Acesse: <a href="https://loja-inteligente-br.lovable.app/login">https://loja-inteligente-br.lovable.app/login</a></p>
            <p style="color:#6b7280;font-size:12px">Recomendamos alterar sua senha no primeiro acesso.</p>
          </div>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "SmartVenda <onboarding@resend.dev>",
            to: [body.email],
            subject: "Bem-vindo ao SmartVenda PDV — Seus dados de acesso",
            html,
          }),
        });
      }
    } catch (e) {
      console.error("welcome email failed", e);
    }

    return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
