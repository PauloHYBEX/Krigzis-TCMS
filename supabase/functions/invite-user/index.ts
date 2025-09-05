// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Expect the following environment variables to be set as Function secrets:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY (required for admin.inviteUserByEmail)

// CORS helpers
const buildCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-debug",
  };
};

const json = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
  });

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { email, role, organization_id } = await req.json().catch(() => ({ email: undefined }));
    const debug = (req.headers.get("x-debug") ?? req.headers.get("X-Debug")) === "1";

    if (!email || typeof email !== "string") {
      return json(req, { error: "Email inválido" }, 400);
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

    // Client with end-user JWT to check caller permissions via RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: caller, error: callerErr } = await supabase.auth.getUser();
    if (callerErr || !caller?.user) {
      return json(req, { error: "Não autenticado" }, 401);
    }

    const callerId = caller.user.id;

    // Check if caller is master (global or org-specific if org provided)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .single();

    if (profileErr) {
      return json(req, { error: "Falha ao verificar perfil do usuário" }, 500);
    }

    // Only global masters can invite for now (simpler and aligns with policy)
    if (profile?.role !== "master") {
      return json(req, { error: "Apenas usuários Master podem convidar" }, 403);
    }

    // Admin client for invitation and privileged writes
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Compute redirectTo for the email link: prefer INVITE_REDIRECT_URL secret; fallback to request Origin.
    const configuredBase = Deno.env.get("INVITE_REDIRECT_URL") || undefined;
    const requestOrigin = req.headers.get("Origin") || undefined;
    const baseRedirect = configuredBase ?? requestOrigin;
    const redirectTo = baseRedirect ? `${baseRedirect}/reset-password` : undefined;

    // Create invitation
    const { data: inviteRes, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      // Force initial role to viewer for security. UI selection is ignored intentionally.
      data: { initial_role: "viewer", invited_by: callerId, requested_role: role ?? "viewer", organization_id: organization_id ?? null },
    });

    if (inviteErr) {
      const msg = (inviteErr.message || "").toLowerCase();
      const alreadyExists = msg.includes("already registered") || msg.includes("already exists") || msg.includes("user exists") || msg.includes("user already");

      // Helper p/ gerar link (recovery primeiro; se falhar, tenta magiclink)
      const attempts: Array<{ type: string; withRedirect: boolean; ok: boolean; error?: string | null }> = [];

      const gen = async (type: "recovery" | "magiclink", withRedirect: boolean) => {
        return await admin.auth.admin.generateLink({
          type,
          email,
          options: withRedirect && redirectTo ? { redirectTo } : undefined,
        } as any);
      };

      const isRedirectIssue = (m?: string) => {
        const s = (m || "").toLowerCase();
        return s.includes("redirect") || s.includes("whitelist") || s.includes("not allowed") || s.includes("invalid url");
      };

      if (alreadyExists) {
        // Se o usuário já existe, tente obter seu user_id para garantir associação à organização
        let existingUserId: string | null = null;
        try {
          const { data: fetchData } = await admin.auth.admin.generateLink({ type: 'recovery', email } as any);
          existingUserId = (fetchData as any)?.user?.id ?? null;
        } catch (_e) {
          // ignore; ainda tentaremos enviar o email abaixo
        }
        if (existingUserId) {
          // Upsert perfil mínimo (sem organization_id) e associação à organização (papel viewer por segurança)
          await admin.from('profiles').upsert({
            id: existingUserId,
            role: 'viewer',
            updated_at: new Date().toISOString(),
          } as any);
          if (organization_id) {
            await admin.from('organization_members').upsert({
              organization_id,
              user_id: existingUserId,
              role: 'viewer',
              status: 'invited',
              accepted_at: null,
            } as any, { onConflict: 'organization_id,user_id' } as any);
          }
        }
        // Client público (sem Authorization) para disparar e-mail via GoTrue
        const pub = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        let resetErr: any = null;
        // Tenta enviar com redirectTo (quando permitido)
        {
          const { error } = await pub.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined as any);
          resetErr = error;
        }
        // Se houver problema de redirect/whitelist, tenta sem redirect
        if (resetErr && isRedirectIssue(resetErr.message) && redirectTo) {
          const { error } = await pub.auth.resetPasswordForEmail(email);
          resetErr = error;
        }
        if (!resetErr) {
          return json(req, {
            success: true,
            message: "Usuário já existia. E-mail de recuperação enviado.",
            email_sent_via: "password_reset",
          }, 200);
        }
        // Se não conseguiu enviar e-mail, cai no fallback de gerar link abaixo
      }

      let linkType: "recovery" | "magiclink" | null = null;
      let linkRes: any = null;
      let linkErr: any = null;

      // Tentativa 1: recovery com redirect
      {
        const { data, error } = await gen("recovery", true);
        linkRes = data; linkErr = error; if (!linkErr && linkRes) { linkType = "recovery"; }
        attempts.push({ type: "recovery", withRedirect: true, ok: !error, error: error?.message || null });
      }

      // Se falhar e for redirect, tenta recovery sem redirect
      if (!linkType && linkErr && isRedirectIssue(linkErr.message) && redirectTo) {
        const retry = await gen("recovery", false);
        linkRes = retry.data; linkErr = retry.error; if (!linkErr && linkRes) { linkType = "recovery"; }
        attempts.push({ type: "recovery", withRedirect: false, ok: !retry.error, error: retry.error?.message || null });
      }

      // Se ainda falhar, tenta magiclink com redirect
      if (!linkType && linkErr) {
        const try2 = await gen("magiclink", true);
        linkRes = try2.data; linkErr = try2.error; if (!linkErr && linkRes) { linkType = "magiclink"; }
        attempts.push({ type: "magiclink", withRedirect: true, ok: !try2.error, error: try2.error?.message || null });
      }

      // Se falhar por redirect em magiclink, tenta sem redirect
      if (!linkType && linkErr && isRedirectIssue(linkErr.message) && redirectTo) {
        const try3 = await gen("magiclink", false);
        linkRes = try3.data; linkErr = try3.error; if (!linkErr && linkRes) { linkType = "magiclink"; }
        attempts.push({ type: "magiclink", withRedirect: false, ok: !try3.error, error: try3.error?.message || null });
      }

      if (!linkErr && linkRes) {
        const actionLink = (linkRes as any)?.properties?.action_link || (linkRes as any)?.action_link || null;
        return json(req, {
          success: true,
          message: alreadyExists
            ? (linkType === "recovery" ? "Usuário já existia. Link de recuperação gerado." : "Usuário já existia. Magic Link gerado.")
            : (linkType === "recovery" ? "Convite não pôde ser enviado, mas um link de recuperação foi gerado." : "Convite não pôde ser enviado, mas um Magic Link foi gerado."),
          recovery_link: actionLink,
          link_type: linkType,
        }, 200);
      }

      // Se ainda falhou, retornar o erro original do convite (com debug opcional)
      const errBody: Record<string, unknown> = { error: inviteErr.message || "Falha ao enviar convite" };
      if (debug) {
        errBody["debug_info"] = {
          invite_error: inviteErr.message,
          invite_error_status: (inviteErr as any)?.status ?? null,
          invite_error_name: (inviteErr as any)?.name ?? null,
          last_link_error: linkErr?.message || null,
          last_link_error_status: (linkErr as any)?.status ?? null,
          last_link_error_name: (linkErr as any)?.name ?? null,
          redirect_used: redirectTo || null,
          attempts,
        };
      }
      // Em modo debug, não quebrar a UI: retornar 200 com success:false
      if (debug) {
        return json(req, { success: false, ...errBody }, 200);
      }
      return json(req, errBody, 400);
    }

    const invitedUser = inviteRes?.user;

    // Upsert minimal profile for the invited user (role viewer by default)
    if (invitedUser?.id) {
      await admin.from("profiles").upsert({
        id: invitedUser.id,
        display_name: invitedUser.user_metadata?.full_name ?? null,
        role: "viewer",
        updated_at: new Date().toISOString(),
      } as any);

      // Optionally add to organization_members if provided
      if (organization_id) {
        await admin.from("organization_members").upsert({
          organization_id,
          user_id: invitedUser.id,
          role: "viewer",
          status: "invited",
          accepted_at: null,
        } as any, { onConflict: "organization_id,user_id" } as any);
      }
    }

    return json(req, {
      success: true,
      message: "Convite enviado com sucesso",
      invited_user_id: invitedUser?.id ?? null,
    }, 200);
  } catch (e: any) {
    return json(req, { error: e?.message || "Erro interno" }, 500);
  }
});
