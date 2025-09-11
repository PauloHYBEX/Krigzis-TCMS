// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
  Edge Function: delete-user
  - Apenas usuários com papel global "master" podem executar
  - Realiza remoção segura do usuário, limpando dados relacionados
  - Suporta dois modos:
    a) hard_delete (default true): apaga perfil, permissões e usuário de auth
    b) hard_delete=false (modo leve): apenas limpa permissões/perfil (sem remover do auth)

  Requisitos (Function secrets):
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
*/

// CORS helpers
const buildCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

const json = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: buildCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { user_id, hard_delete } = await req.json().catch(() => ({ user_id: undefined }));

    if (!user_id || typeof user_id !== "string") {
      return json(req, { error: "Parâmetro user_id é obrigatório" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json(req, { error: "Configuração ausente do Supabase" }, 500);
    }
    if (!SERVICE_ROLE_KEY) {
      return json(req, { error: "SUPABASE_SERVICE_ROLE_KEY não configurado" }, 500);
    }

    // Client com JWT do usuário chamador para checar permissões via RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: caller, error: callerErr } = await supabase.auth.getUser();
    if (callerErr || !caller?.user) {
      return json(req, { error: "Não autenticado" }, 401);
    }

    const callerId = caller.user.id;

    // Checar papel global master
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .single();

    if (profileErr) {
      return json(req, { error: "Falha ao verificar perfil do usuário" }, 500);
    }

    if (profile?.role !== "master") {
      return json(req, { error: "Apenas usuários Master podem remover usuários" }, 403);
    }

    // Impedir auto-remoção
    if (callerId === user_id) {
      return json(req, { error: "Você não pode remover seu próprio usuário" }, 400);
    }

    // Cliente admin para operações privilegiadas
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Sem escopo de organizações no sistema atual

    const doHardDelete = hard_delete !== false; // default true

    if (doHardDelete) {
      // Segurança: impedir remoção do único Master global do sistema
      const { data: targetProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .maybeSingle();

      if (targetProfile?.role === "master") {
        const { data: masters } = await admin
          .from("profiles")
          .select("id, role")
          .eq("role", "master");
        const otherMasters = (masters || []).filter((m: any) => m.id !== user_id);
        if (otherMasters.length === 0) {
          return json(req, { error: "Não é possível remover o único Master global do sistema" }, 400);
        }
      }

      // Remoção completa de dados do app (sem organizações)
      await admin.from("user_permissions").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);

      // Remover usuário do Auth
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) {
        return json(req, { error: delErr.message || "Falha ao remover usuário de auth" }, 400);
      }

      return json(req, { success: true, mode: "hard_delete", user_id }, 200);
    }

    // Modo leve: apenas limpa permissões/perfil (sem remover do auth)
    await admin.from("user_permissions").delete().eq("user_id", user_id);
    await admin.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", user_id);
    return json(req, { success: true, mode: "soft_cleanup", user_id }, 200);
  } catch (e: any) {
    return json(req, { error: e?.message || "Erro interno" }, 500);
  }
});
