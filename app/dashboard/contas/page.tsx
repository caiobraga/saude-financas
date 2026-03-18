import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";
import { getConnectionsWithAccountsForUser } from "@/lib/dashboard-for-user";
import { AddAccountButton } from "./AddAccountButton";
import { ContasList } from "./ContasList";

export default async function ContasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = user?.email?.toLowerCase() === env.admin.email.toLowerCase();
  const cookieStore = await cookies();
  const viewAs = getViewAsFromCookies(cookieStore, isAdmin ?? false);

  let accountsByConnection: { conn: { id: string; institution: string; status: string }; accounts: { id: string; name: string; type: string; balance: number }[] }[] = [];

  if (viewAs) {
    try {
      const admin = createAdminClient();
      const list = await getConnectionsWithAccountsForUser(admin, viewAs.userId);
      accountsByConnection = list.map(({ conn, accounts }) => ({
        conn,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance ?? 0,
        })),
      }));
    } catch {
      // leave empty
    }
  } else {
    const { data: connections } = await supabase
      .from("bank_connections")
      .select("id, institution, status")
      .neq("institution", "Extrato PDF")
      .order("connected_at", { ascending: false });

    if (connections?.length) {
      for (const conn of connections) {
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id, name, type, balance")
          .eq("connection_id", conn.id);
        accountsByConnection.push({
          conn,
          accounts: (accounts ?? []).map((a) => ({
            ...a,
            balance: Number(a.balance ?? 0),
          })),
        });
      }
    }
  }

  // Se não há integração bancária preenchendo `accounts.balance`,
  // usa a soma das transações (amount já vem com sinal) como saldo/total.
  const accountIds = accountsByConnection.flatMap((c) => c.accounts.map((a) => a.id));
  if (accountIds.length > 0) {
    const balancesByAccountId = new Map<string, number>();

    if (viewAs) {
      try {
        const admin = createAdminClient();
        const { data: txs, error } = await admin
          .from("transactions")
          .select("account_id, amount")
          .eq("user_id", viewAs.userId)
          .in("account_id", accountIds);
        if (!error) {
          for (const t of txs ?? []) {
            const id = String((t as { account_id: string }).account_id);
            const amount = Number((t as { amount: number }).amount ?? 0);
            balancesByAccountId.set(id, (balancesByAccountId.get(id) ?? 0) + amount);
          }
        }
      } catch {
        // ignore
      }
    } else {
      try {
        const { data: txs } = await supabase
          .from("transactions")
          .select("account_id, amount")
          .in("account_id", accountIds);
        for (const t of txs ?? []) {
          const id = String((t as { account_id: string }).account_id);
          const amount = Number((t as { amount: number }).amount ?? 0);
          balancesByAccountId.set(id, (balancesByAccountId.get(id) ?? 0) + amount);
        }
      } catch {
        // ignore
      }
    }

    // Preferir o saldo calculado quando existir (inclusive 0, se a conta tiver transações 0).
    accountsByConnection = accountsByConnection.map(({ conn, accounts }) => ({
      conn,
      accounts: accounts.map((a) => {
        const computed = balancesByAccountId.get(a.id);
        return computed == null ? a : { ...a, balance: computed };
      }),
    }));
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Contas
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Contas vinculadas às instituições. Crie, edite ou exclua contas.
          </p>
        </div>
        {!viewAs && <AddAccountButton />}
      </div>

      <ContasList initialData={accountsByConnection} readOnly={!!viewAs} />
    </div>
  );
}
