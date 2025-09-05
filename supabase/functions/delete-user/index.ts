// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
  Edge Function: delete-user
  - Apenas usuários com papel global "master" podem executar
  - Realiza remoção segura do usuário, limpando dados relacionados
  - Suporta dois modos:
    a) hard_delete (default true): remove de todas as organizações, apaga perfil, permissões e usuário de auth
    b) remoção por organização (quando organization_id é fornecido e hard_delete=false): remove apenas a associação e permissões dessa org

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
    const { user_id, organization_id, hard_delete } = await req.json().catch(() => ({ user_id: undefined }));

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

    // Se for remoção por organização, impedir remover último master dessa org
    if (organization_id) {
      const { data: targetMember } = await admin
        .from("organization_members")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (targetMember?.role === "master") {
        const { data: mastersCountData, error: mastersErr } = await admin
          .from("organization_members")
          .select("user_id", { count: "exact", head: true }) as any;
        // Workaround: supabase-js count with head:true returns {count, data:null}
        // We'll re-run without head to safely count
        let mastersCount = 0;
        if (!mastersErr) {
          const { data: masters } = await admin
            .from("organization_members")
            .select("user_id, role")
            .eq("organization_id", organization_id)
            .eq("role", "master");
          mastersCount = masters?.filter((m: any) => m.user_id !== user_id).length ?? 0;
        }
        if (mastersCount <= 0) {
          return json(req, { error: "Não é possível remover o último Master da organização" }, 400);
        }
      }
    }

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

      // Segurança: impedir remoção se for último Master em alguma organização
      const { data: memberships } = await admin
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user_id);
      const orgsWhereUserIsMaster = (memberships || []).filter((m: any) => m.role === "master").map((m: any) => m.organization_id);
      if (orgsWhereUserIsMaster.length > 0) {
        for (const orgId of orgsWhereUserIsMaster) {
          const { data: mastersInOrg } = await admin
            .from("organization_members")
            .select("user_id, role")
            .eq("organization_id", orgId)
            .eq("role", "master");
          const others = (mastersInOrg || []).filter((m: any) => m.user_id !== user_id);
          if (others.length === 0) {
            return json(req, { error: `Não é possível remover o último Master da organização ${orgId}` }, 400);
          }
        }
      }

      // Remoção completa de todas as organizações e dados do app
      await admin.from("organization_members").delete().eq("user_id", user_id);
      await admin.from("user_permissions").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);

      // Remover usuário do Auth
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) {
        return json(req, { error: delErr.message || "Falha ao remover usuário de auth" }, 400);
      }

      return json(req, { success: true, mode: "hard_delete", user_id }, 200);
    }

    // Remoção somente dentro da organização informada
    if (!organization_id) {
      return json(req, { error: "organization_id é obrigatório quando hard_delete=false" }, 400);
    }

    await admin.from("organization_members").delete().eq("organization_id", organization_id).eq("user_id", user_id);
    // Modelo de permissões agora é global: não há permissões por organização para remover
    // Tabela profiles não possui mais coluna organization_id

    return json(req, { success: true, mode: "org_cleanup", user_id, organization_id }, 200);
  } catch (e: any) {
    return json(req, { error: e?.message || "Erro interno" }, 500);
  }
});
