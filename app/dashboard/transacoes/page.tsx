import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";
import { getAccountsForUser, getTransactionsForUser } from "@/lib/dashboard-for-user";
import { TransacoesTable } from "./TransacoesTable";

export const dynamic = "force-dynamic";

export default async function TransacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = user?.email?.toLowerCase() === env.admin.email.toLowerCase();
  const cookieStore = await cookies();
  const viewAs = getViewAsFromCookies(cookieStore, isAdmin ?? false);

  let transactions: Array<{ id: string; date: string; description: string; amount: number; type: string; category: string | null; subcategoria: string | null; account_id: string; parcela_numero: number | null; parcela_total: number | null }> = [];
  let accounts: Array<{ id: string; name: string }> = [];
  let viewAsError: string | null = null;

  if (viewAs) {
    try {
      const admin = createAdminClient();
      const uid = viewAs.userId.trim();
      const [accountsForUser, transactionsForUser] = await Promise.all([
        getAccountsForUser(admin, uid),
        getTransactionsForUser(admin, uid, { order: "desc" }),
      ]);
      accounts = accountsForUser.map((a) => ({ id: a.id, name: a.name }));
      transactions = transactionsForUser.map((t) => ({
        id: t.id,
        date: typeof t.date === "string" ? t.date : String(t.date),
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
        category: t.category ?? null,
        subcategoria: t.subcategoria ?? null,
        account_id: t.account_id,
        parcela_numero: t.parcela_numero ?? null,
        parcela_total: t.parcela_total ?? null,
      }));
    } catch (err) {
      viewAsError = err instanceof Error ? err.message : "Erro ao carregar dados do usuário";
      console.error("[TransacoesPage viewAs]", err);
    }
  } else {
    const [
      { data: transactionsData },
      { data: accountsData },
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, subcategoria, account_id, parcela_numero, parcela_total")
        .order("date", { ascending: false }),
      supabase.from("accounts").select("id, name").order("name"),
    ]);
    transactions = (transactionsData ?? []).map((t) => ({
      id: t.id,
      date: typeof t.date === "string" ? t.date : String(t.date),
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: t.category ?? null,
      subcategoria: t.subcategoria ?? null,
      account_id: t.account_id ?? "",
      parcela_numero: t.parcela_numero ?? null,
      parcela_total: t.parcela_total ?? null,
    }));
    accounts = accountsData ?? [];
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Transações
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {viewAs
          ? "Transações deste usuário (somente leitura no modo visualização)."
          : "Todas as movimentações das suas contas. Edite ou exclua uma entrada pelos botões na tabela."}
      </p>

      {viewAsError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          Não foi possível carregar as transações: {viewAsError}. Verifique se SUPABASE_SERVICE_ROLE_KEY está definida.
        </div>
      )}

      {viewAs && !viewAsError && transactions.length === 0 && accounts.length === 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Este usuário ainda não tem contas conectadas nem transações. Os dados aparecerão aqui após conectar um banco ou importar um extrato.
        </div>
      )}

      <TransacoesTable
        transactions={transactions ?? []}
        accounts={accounts ?? []}
      />
    </div>
  );
}
