import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";
import { getConnectionsWithAccountsForUser } from "@/lib/dashboard-for-user";
import { DeleteAccountButton } from "@/app/components/DeleteAccountButton";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function accountTypeLabel(type: string) {
  const map: Record<string, string> = {
    checking: "Conta corrente",
    savings: "Poupança",
    credit: "Crédito",
  };
  return map[type] ?? type;
}

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

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Contas
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Contas vinculadas às instituições conectadas
      </p>

      {!accountsByConnection.length ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            Nenhuma conta conectada. Conecte seu banco para ver as contas aqui.
          </p>
          <Link
            href="/dashboard/conectar"
            className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            Conectar instituição
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {accountsByConnection.map(({ conn, accounts }) => (
            <section
              key={conn.id}
              className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {conn.institution}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    conn.status === "active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {conn.status === "active" ? "Conectado" : conn.status}
                </span>
              </div>
              <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {accounts.map((acc) => (
                  <li
                    key={acc.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {acc.name}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {accountTypeLabel(acc.type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                        {formatCurrency(Number(acc.balance))}
                      </span>
                      <DeleteAccountButton accountId={acc.id} accountName={acc.name} readOnly={!!viewAs} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
