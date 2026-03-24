import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";
import { getAccountsForUser, getTransactionsForUser } from "@/lib/dashboard-for-user";
import { TransacoesTable } from "../transacoes/TransacoesTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  subcategoria: string | null;
  account_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  import_source: string | null;
  import_batch_id: string | null;
  import_order: number | null;
  created_at: string | null;
  card_line_kind: string | null;
};

export default async function TransacoesCartaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = user?.email?.toLowerCase() === env.admin.email.toLowerCase();
  const cookieStore = await cookies();
  const viewAs = getViewAsFromCookies(cookieStore, isAdmin ?? false);

  let transactions: Tx[] = [];
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
      const creditIds = new Set(
        accountsForUser.filter((a) => a.type === "credit").map((a) => a.id)
      );
      accounts = accountsForUser
        .filter((a) => a.type === "credit")
        .map((a) => ({ id: a.id, name: a.name }));
      transactions = transactionsForUser
        .filter((t) => t.account_id && creditIds.has(t.account_id))
        .map((t) => ({
          id: t.id,
          date: typeof t.date === "string" ? t.date : String(t.date),
          description: t.description,
          amount: Number(t.amount),
          type: t.type,
          category: t.category ?? null,
          subcategoria: t.subcategoria ?? null,
          account_id: t.account_id ?? null,
          parcela_numero: t.parcela_numero ?? null,
          parcela_total: t.parcela_total ?? null,
          import_source: t.import_source ?? null,
          import_batch_id: t.import_batch_id ?? null,
          import_order: t.import_order ?? null,
          created_at: t.created_at ?? null,
          card_line_kind: t.card_line_kind ?? null,
        }));
    } catch (err) {
      viewAsError = err instanceof Error ? err.message : "Erro ao carregar dados do usuário";
      console.error("[TransacoesCartaoPage viewAs]", err);
    }
  } else {
    const { data: creditAccounts } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("type", "credit")
      .order("name");
    accounts = creditAccounts ?? [];
    const ids = accounts.map((a) => a.id);
    if (ids.length > 0) {
      const { data: txData } = await supabase
        .from("transactions")
        .select(
          "id, date, description, amount, type, category, subcategoria, account_id, parcela_numero, parcela_total, import_source, import_batch_id, import_order, created_at, card_line_kind"
        )
        .in("account_id", ids)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      transactions = (txData ?? []).map((t) => ({
        id: t.id,
        date: typeof t.date === "string" ? t.date : String(t.date),
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
        category: t.category ?? null,
        subcategoria: t.subcategoria ?? null,
        account_id: t.account_id ?? null,
        parcela_numero: t.parcela_numero ?? null,
        parcela_total: t.parcela_total ?? null,
        import_source: t.import_source ?? null,
        import_batch_id: t.import_batch_id ?? null,
        import_order: t.import_order ?? null,
        created_at: t.created_at ?? null,
        card_line_kind: t.card_line_kind ?? null,
      }));
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Transações do cartão
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Movimentações das contas tipo <strong>Cartão de crédito</strong>. Importe a fatura em PDF em{" "}
        <Link href="/dashboard/importar-fatura-cartao" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
          Importar fatura cartão
        </Link>
        .
      </p>

      {viewAsError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          Não foi possível carregar: {viewAsError}.
        </div>
      )}

      {!viewAs && accounts.length === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Crie uma conta do tipo <strong>Crédito</strong> em{" "}
          <Link href="/dashboard/contas" className="font-medium underline">
            Contas
          </Link>{" "}
          (ex.: nome do cartão). Depois importe a fatura em PDF.
        </div>
      )}

      <TransacoesTable transactions={transactions} accounts={accounts} context="credit" />
    </div>
  );
}
