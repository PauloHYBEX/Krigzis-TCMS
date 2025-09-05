// Supabase Edge Function: reports-aggregator
// Agrega dados para relatórios como: trend-analysis, failure-analysis, requirements-defects
// Ambiente: Deno

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReportType = "trend-analysis" | "failure-analysis" | "requirements-defects";

interface ReportRequestBody {
  type: ReportType;
  filters?: {
    dateFrom?: string; // ISO yyyy-mm-dd
    dateTo?: string;   // ISO yyyy-mm-dd
    granularity?: "day" | "week" | "month";
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "*",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = authData.user.id;

    let body: ReportRequestBody;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!body?.type) {
      return json({ error: "Field 'type' is required" }, 400);
    }

    const filters = body.filters || {};
    const { dateFrom, dateTo } = normalizeDateRange(filters.dateFrom, filters.dateTo);

    switch (body.type) {
      case "trend-analysis": {
        const result = await getTrendAnalysis(supabase, userId, { dateFrom, dateTo, granularity: filters.granularity || "day" });
        return json({ type: body.type, generatedAt: new Date().toISOString(), data: result });
      }
      case "failure-analysis": {
        const result = await getFailureAnalysis(supabase, userId, { dateFrom, dateTo });
        return json({ type: body.type, generatedAt: new Date().toISOString(), data: result });
      }
      case "requirements-defects": {
        const result = await getRequirementsDefects(supabase, userId, { dateFrom, dateTo });
        return json({ type: body.type, generatedAt: new Date().toISOString(), data: result });
      }
      default:
        return json({ error: `Unsupported report type: ${body.type}` }, 400);
    }
  } catch (err) {
    console.error("reports-aggregator error:", err);
    return json({ error: "Internal error", details: String(err?.message || err) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeDateRange(from?: string, to?: string): { dateFrom?: string; dateTo?: string } {
  let dateFrom = from ? new Date(from) : undefined;
  let dateTo = to ? new Date(to) : undefined;
  if (dateFrom && isNaN(dateFrom.getTime())) dateFrom = undefined;
  if (dateTo && isNaN(dateTo.getTime())) dateTo = undefined;
  const out: { dateFrom?: string; dateTo?: string } = {};
  if (dateFrom) out.dateFrom = dateFrom.toISOString();
  if (dateTo) {
    dateTo.setHours(23, 59, 59, 999);
    out.dateTo = dateTo.toISOString();
  }
  return out;
}

// ===========================
// Report: Trend Analysis
// ===========================
async function getTrendAnalysis(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  opts: { dateFrom?: string; dateTo?: string; granularity: "day" | "week" | "month" }
) {
  let query = supabase
    .from("test_executions")
    .select("id, status, executed_at")
    .eq("user_id", userId)
    .order("executed_at", { ascending: true });

  if (opts.dateFrom) query = query.gte("executed_at", opts.dateFrom);
  if (opts.dateTo) query = query.lte("executed_at", opts.dateTo);

  const { data: executions, error } = await query;
  if (error) throw error;

  const bucketKey = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    if (opts.granularity === "day") return `${y}-${m}-${day}`;
    if (opts.granularity === "month") return `${y}-${m}`;
    // week: ISO week approximation (yyyy-Www)
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // Thursday
    const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  };

  const seriesMap: Record<string, { passed: number; failed: number; blocked: number; not_tested: number; total: number }> = {};
  for (const e of executions || []) {
    const when = new Date(e.executed_at as string);
    const key = bucketKey(when);
    if (!seriesMap[key]) seriesMap[key] = { passed: 0, failed: 0, blocked: 0, not_tested: 0, total: 0 };
    const bucket = seriesMap[key];
    if (e.status === "passed") bucket.passed++;
    else if (e.status === "failed") bucket.failed++;
    else if (e.status === "blocked") bucket.blocked++;
    else bucket.not_tested++;
    bucket.total++;
  }

  const series = Object.entries(seriesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ bucket: key, ...v }));

  const totals = series.reduce(
    (acc, cur) => {
      acc.passed += cur.passed;
      acc.failed += cur.failed;
      acc.blocked += cur.blocked;
      acc.not_tested += cur.not_tested;
      acc.total += cur.total;
      return acc;
    },
    { passed: 0, failed: 0, blocked: 0, not_tested: 0, total: 0 }
  );

  return { series, totals, granularity: opts.granularity };
}

// ===========================
// Report: Failure Analysis
// ===========================
async function getFailureAnalysis(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  opts: { dateFrom?: string; dateTo?: string }
) {
  // Fetch executions (failed + total for rate)
  let base = supabase
    .from("test_executions")
    .select("id, case_id, plan_id, status, executed_at")
    .eq("user_id", userId);

  if (opts.dateFrom) base = base.gte("executed_at", opts.dateFrom);
  if (opts.dateTo) base = base.lte("executed_at", opts.dateTo);

  const { data: allExecs, error: allErr } = await base;
  if (allErr) throw allErr;

  const failedExecs = (allExecs || []).filter((e) => e.status === "failed");

  // Map counts per case and plan
  const caseCounts = new Map<string, number>();
  const planCounts = new Map<string, number>();
  let lastFailedAt: Date | undefined;

  for (const e of failedExecs) {
    if (e.case_id) caseCounts.set(e.case_id, (caseCounts.get(e.case_id) || 0) + 1);
    if (e.plan_id) planCounts.set(e.plan_id, (planCounts.get(e.plan_id) || 0) + 1);
    const dt = new Date(e.executed_at as string);
    if (!lastFailedAt || dt > lastFailedAt) lastFailedAt = dt;
  }

  // Fetch cases and plans to resolve titles
  const caseIds = Array.from(caseCounts.keys());
  const planIds = Array.from(planCounts.keys());

  const [casesRes, plansRes] = await Promise.all([
    caseIds.length
      ? supabase.from("test_cases").select("id, title").eq("user_id", userId).in("id", caseIds)
      : Promise.resolve({ data: [], error: null } as any),
    planIds.length
      ? supabase.from("test_plans").select("id, title").eq("user_id", userId).in("id", planIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (casesRes.error) throw casesRes.error;
  if (plansRes.error) throw plansRes.error;

  const caseTitleMap = new Map<string, string>((casesRes.data || []).map((c: any) => [c.id, c.title]));
  const planTitleMap = new Map<string, string>((plansRes.data || []).map((p: any) => [p.id, p.title]));

  const topCases = Array.from(caseCounts.entries())
    .map(([id, count]) => ({ id, title: caseTitleMap.get(id) || id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topPlans = Array.from(planCounts.entries())
    .map(([id, count]) => ({ id, title: planTitleMap.get(id) || id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const totals = {
    totalExecutions: (allExecs || []).length,
    failedExecutions: failedExecs.length,
    failureRate: (allExecs || []).length > 0 ? failedExecs.length / (allExecs || []).length : 0,
    lastFailedAt: lastFailedAt ? lastFailedAt.toISOString() : null,
  };

  return { totals, topCases, topPlans };
}

// ===========================
// Report: Requirements & Defects
// ===========================
async function getRequirementsDefects(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  opts: { dateFrom?: string; dateTo?: string }
) {
  // Requirements
  let reqQ = supabase.from("requirements").select("id, status, priority, updated_at").eq("user_id", userId);
  if (opts.dateFrom) reqQ = reqQ.gte("updated_at", opts.dateFrom);
  if (opts.dateTo) reqQ = reqQ.lte("updated_at", opts.dateTo);
  const { data: requirements, error: reqErr } = await reqQ;
  if (reqErr) throw reqErr;

  // Defects
  let defQ = supabase.from("defects").select("id, status, severity, updated_at").eq("user_id", userId);
  if (opts.dateFrom) defQ = defQ.gte("updated_at", opts.dateFrom);
  if (opts.dateTo) defQ = defQ.lte("updated_at", opts.dateTo);
  const { data: defects, error: defErr } = await defQ;
  if (defErr) throw defErr;

  const countBy = (arr: any[], key: string) => arr.reduce((acc: Record<string, number>, item: any) => {
    const k = item[key] ?? "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const requirementsByStatus = countBy(requirements || [], "status");
  const requirementsByPriority = countBy(requirements || [], "priority");
  const defectsBySeverity = countBy(defects || [], "severity");
  const defectsByStatus = countBy(defects || [], "status");

  return {
    totals: {
      requirements: (requirements || []).length,
      defects: (defects || []).length,
    },
    requirementsByStatus,
    requirementsByPriority,
    defectsBySeverity,
    defectsByStatus,
  };
}
