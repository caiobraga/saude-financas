import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Busca receitas e despesas por usuário. Usa a view user_financial_stats; se falhar, calcula em memória. */
async function getStatsByUser(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Record<string, { despesas: number; receitas: number }>> {
  if (userIds.length === 0) return {};
  const out: Record<string, { despesas: number; receitas: number }> = {};
  for (const id of userIds) out[id] = { despesas: 0, receitas: 0 };

  const { data: rows, error } = await admin
    .from("user_financial_stats")
    .select("user_id, receitas, despesas")
    .in("user_id", userIds);

  if (!error && rows?.length !== undefined) {
    for (const r of rows) {
      const uid = r.user_id as string;
      if (!uid) continue;
      out[uid] = {
        receitas: Number(r.receitas) || 0,
        despesas: Number(r.despesas) || 0,
      };
    }
    return out;
  }

  if (error) console.warn("[admin/users] view user_financial_stats falhou, usando fallback:", error.message);

  const { data: transactions } = await admin
    .from("transactions")
    .select("user_id, amount, type")
    .in("user_id", userIds);

  for (const t of transactions ?? []) {
    const uid = t.user_id as string;
    if (!uid || !out[uid]) continue;
    const amount = Number(t.amount) || 0;
    if (t.type === "credit") out[uid].receitas += amount;
    else if (t.type === "debit") out[uid].despesas += Math.abs(amount);
  }
  return out;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== env.admin.email.toLowerCase()) {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    const admin = createAdminClient();
    let query = admin.from("profiles").select("id, email, full_name").order("full_name", { ascending: true });

    if (q.length >= 1) {
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data: profiles, error } = await query.limit(500);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = (profiles ?? []).map((p) => p.id);
    const statsByUser = await getStatsByUser(admin, userIds);
    const list = (profiles ?? []).map((p) => ({
      ...p,
      despesas: statsByUser[p.id]?.despesas ?? 0,
      receitas: statsByUser[p.id]?.receitas ?? 0,
    }));

    return NextResponse.json(list);
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "Admin não configurado (service role key)" },
        { status: 503 }
      );
    }
    console.error("Admin users list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar usuários" },
      { status: 500 }
    );
  }
}
