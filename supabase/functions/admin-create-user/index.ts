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
