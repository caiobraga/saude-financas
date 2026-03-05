/**
 * Roda os mesmos SELECTs que o admin usa e imprime as respostas.
 * Uso: node --env-file=.env scripts/check-admin-db.mjs
 * (ou defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: node --env-file=.env scripts/check-admin-db.mjs)");
  process.exit(1);
}

const admin = createClient(url, serviceKey);

async function main() {
  console.log("=== 1. SELECT em profiles (id, email, full_name) ===\n");

  const { data: profiles, error: err1 } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .order("full_name", { ascending: true })
    .limit(10);

  if (err1) {
    console.log("Erro:", err1.message);
  } else {
    console.log("Linhas:", profiles?.length ?? 0);
    console.log(JSON.stringify(profiles, null, 2));
  }

  const userIds = (profiles ?? []).map((p) => p.id);
  if (userIds.length === 0) {
    console.log("\nSem perfis, parando.");
    return;
  }

  console.log("\n=== 2. SELECT na view user_financial_stats (user_id, receitas, despesas) ===\n");

  const { data: stats, error: err2 } = await admin
    .from("user_financial_stats")
    .select("user_id, receitas, despesas")
    .in("user_id", userIds);

  if (err2) {
    console.log("Erro na view:", err2.message);
    console.log("\n=== 2b. Fallback: SELECT direto em bank_connections + accounts + transactions ===\n");

    const { data: conns } = await admin.from("bank_connections").select("id, user_id").in("user_id", userIds);
    const connectionIds = (conns ?? []).map((c) => c.id);
    const connToUser = new Map((conns ?? []).map((c) => [c.id, c.user_id]));

    if (connectionIds.length === 0) {
      console.log("Nenhuma bank_connection para esses usuários.");
      return;
    }

    const { data: accts } = await admin.from("accounts").select("id, connection_id").in("connection_id", connectionIds);
    const accountIds = (accts ?? []).map((a) => a.id);
    const accToUser = new Map(
      (accts ?? []).map((a) => [a.id, connToUser.get(a.connection_id)]).filter(([, u]) => u)
    );

    if (accountIds.length === 0) {
      console.log("Nenhuma account para essas conexões.");
      return;
    }

    const { data: tx } = await admin
      .from("transactions")
      .select("account_id, amount, type")
      .in("account_id", accountIds);

    console.log("Transações brutas (primeiras 15):", JSON.stringify((tx ?? []).slice(0, 15), null, 2));

    const totals = {};
    for (const id of userIds) totals[id] = { receitas: 0, despesas: 0 };
    for (const t of tx ?? []) {
      const uid = accToUser.get(t.account_id);
      if (!uid) continue;
      const amount = Number(t.amount) || 0;
      if (t.type === "credit") totals[uid].receitas += amount;
      else if (t.type === "debit") totals[uid].despesas += Math.abs(amount);
    }
    console.log("\nTotais calculados (fallback):", JSON.stringify(totals, null, 2));
    return;
  }

  console.log("Linhas:", stats?.length ?? 0);
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n=== 3. Resumo: o que o admin monta para cada perfil ===\n");
  for (const p of profiles ?? []) {
    const s = (stats ?? []).find((r) => r.user_id === p.id);
    console.log({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      receitas: s ? Number(s.receitas) : 0,
      despesas: s ? Number(s.despesas) : 0,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
