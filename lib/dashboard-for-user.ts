import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch account ids for a user. Use with admin client.
 * Usa accounts.user_id (preenchido por trigger a partir de bank_connections).
 */
export async function getAccountIdsForUser(
  admin: SupabaseClient,
  userId: string
): Promise<string[]> {
  const uid = userId?.trim?.() ?? "";
  if (!uid) return [];

  const { data: accounts, error } = await admin
    .from("accounts")
    .select("id")
    .eq("user_id", uid);

  if (error) {
    console.error("[getAccountIdsForUser] accounts:", error.message);
    throw new Error(`Erro ao buscar contas: ${error.message}`);
  }

  return (accounts ?? []).map((a) => a.id);
}

/**
 * Fetch accounts (id, name, balance, etc.) for a user. Use with admin client.
 * Usa accounts.user_id.
 */
export async function getAccountsForUser(
  admin: SupabaseClient,
  userId: string
) {
  const uid = userId?.trim?.() ?? "";
  if (!uid) return [];

  const { data, error } = await admin
    .from("accounts")
    .select("id, name, balance, connection_id")
    .eq("user_id", uid)
    .order("name");

  if (error) {
    console.error("[getAccountsForUser] accounts:", error.message);
    throw new Error(`Erro ao buscar contas: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch bank connections with their accounts for a user. Use with admin client.
 */
export async function getConnectionsWithAccountsForUser(admin: SupabaseClient, userId: string) {
  const { data: connections } = await admin
    .from("bank_connections")
    .select("id, institution, status")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });
  if (!connections?.length) return [];
  const result: Array<{
    conn: { id: string; institution: string; status: string };
    accounts: Array<{ id: string; name: string; type: string; balance: number | null }>;
  }> = [];
  for (const conn of connections) {
    const { data: accounts } = await admin
      .from("accounts")
      .select("id, name, type, balance")
      .eq("connection_id", conn.id);
    result.push({
      conn: { id: conn.id, institution: conn.institution, status: conn.status },
      accounts: (accounts ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance != null ? Number(a.balance) : null,
      })),
    });
  }
  return result;
}

/**
 * Fetch transactions for a user. Use with admin client.
 * Usa transactions.user_id (preenchido por trigger a partir de accounts).
 */
export async function getTransactionsForUser(
  admin: SupabaseClient,
  userId: string,
  options?: { order?: "asc" | "desc"; limit?: number }
) {
  const uid = userId?.trim?.() ?? "";
  if (!uid) return [];

  const orderAsc = (options?.order ?? "desc") === "asc";

  const { data, error } = await admin
    .from("transactions")
    .select("id, date, description, amount, type, category, subcategoria, account_id, parcela_numero, parcela_total")
    .eq("user_id", uid)
    .order("date", { ascending: orderAsc });

  if (error) {
    console.error("[getTransactionsForUser]", error.message);
    throw new Error(`Erro ao buscar transações: ${error.message}`);
  }

  const all = (data ?? []) as Array<{ id: string; date: string; description: string; amount: number; type: string; category: string | null; subcategoria: string | null; account_id: string; parcela_numero: number | null; parcela_total: number | null }>;
  return options?.limit ? all.slice(0, options.limit) : all;
}
