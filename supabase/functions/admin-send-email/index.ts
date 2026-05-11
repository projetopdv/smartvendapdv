import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!gmailUser || !gmailPass) {
      return json({ error: "GMAIL_USER e GMAIL_APP_PASSWORD não configurados" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Apenas admin" }, 403);

    const body = await req.json() as { user_id: string; subject: string; message: string };
    if (!body.user_id || !body.subject?.trim() || !body.message?.trim()) {
      return json({ error: "Dados incompletos" }, 400);
    }

    const { data: target } = await admin
      .from("profiles").select("email, full_name").eq("id", body.user_id).maybeSingle();
    if (!target?.email) return json({ error: "Usuário sem email" }, 404);

    const { data: senderProf } = await admin
      .from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const senderName = (senderProf?.full_name || senderProf?.email || "Equipe SmartVenda").replace(/"/g, "");
    const replyTo = senderProf?.email || gmailUser;

    const safeMsg = escapeHtml(body.message).replace(/\n/g, "<br/>");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#4f46e5">📩 Mensagem da equipe SmartVenda PDV</h2>
        <p>Olá <b>${escapeHtml(target.full_name ?? "")}</b>,</p>
        <div style="background:#f9fafb;border-left:3px solid #4f46e5;padding:12px 16px;margin:16px 0;border-radius:4px">${safeMsg}</div>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          Enviada por <b>${escapeHtml(senderName)}</b> em ${new Date().toLocaleString("pt-BR")}<br/>Para responder, basta responder este email.
        </p>
      </div>`;

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPass },
      },
    });

    try {
      await client.send({
        from: `${senderName} <${gmailUser}>`,
        to: target.email,
        replyTo,
        subject: body.subject.trim(),
        content: "Seu cliente de email não suporta HTML.",
        html,
      });
    } finally {
      await client.close();
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
