import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: "no resend key" }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Find low-stock products owned by caller
    const { data: products } = await admin
      .from("products")
      .select("id,name,stock,min_stock,unit")
      .eq("owner_id", user.id)
      .eq("active", true)
      .gt("min_stock", 0);

    const low = (products ?? []).filter((p: any) => Number(p.stock) <= Number(p.min_stock));
    if (low.length === 0) {
      return new Response(JSON.stringify({ ok: true, low: 0 }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: prof } = await admin
      .from("profiles").select("email,full_name,store_name")
      .eq("id", user.id).maybeSingle();
    if (!prof?.email) {
      return new Response(JSON.stringify({ ok: true, low: low.length, skipped: "no email" }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const rows = low
      .sort((a: any, b: any) => Number(a.stock) - Number(b.stock))
      .map((p: any) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${p.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#b91c1c;font-weight:bold">${Number(p.stock)} ${p.unit}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${Number(p.min_stock)} ${p.unit}</td>
      </tr>`).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
        <h2>⚠️ Alerta de estoque baixo</h2>
        <p>Olá ${prof.full_name ?? ""}, os produtos abaixo da loja <b>${prof.store_name ?? ""}</b> estão com estoque abaixo do mínimo após uma venda recente:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#f3f4f6">
            <th align="left" style="padding:6px 10px">Produto</th>
            <th align="left" style="padding:6px 10px">Atual</th>
            <th align="left" style="padding:6px 10px">Mínimo</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">SmartVenda — Reponha para evitar quebra de venda.</p>
      </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SmartVenda <onboarding@resend.dev>",
        to: [prof.email],
        subject: `⚠️ ${low.length} produto(s) com estoque baixo`,
        html,
      }),
    });

    return new Response(JSON.stringify({ ok: true, low: low.length }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
