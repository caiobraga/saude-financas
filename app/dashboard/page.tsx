import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SummaryCard } from "../components/SummaryCard";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";
import { getAccountsForUser, getTransactionsForUser } from "@/lib/dashboard-for-user";
import { resolveDashboardPeriod, transactionInPeriod } from "@/lib/dashboard-period";
import { DashboardOverviewFilters } from "./DashboardOverviewFilters";
import {
  DashboardOverviewVisual,
  type AccountOverviewRow,
  type CategorySlice,
} from "./DashboardOverviewVisual";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

type TxRow = {
  amount: number;
  type: string;
  category: string | null;
  account_id: string;
  date: string;
};

type AccRow = {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit";
  balance: number;
};

function buildOverview(
  accounts: AccRow[],
  transactions: TxRow[],
  dateFrom: string,
  dateTo: string
): {
  receitasPeriodo: number;
  despesasPeriodo: number;
  bankAccounts: AccountOverviewRow[];
  creditAccounts: AccountOverviewRow[];
  categorySlices: CategorySlice[];
} {
  const periodTx = transactions.filter((t) => transactionInPeriod(t.date, dateFrom, dateTo));
  const byAccount = new Map<string, { rec: number; des: number }>();
  for (const t of periodTx) {
    const cur = byAccount.get(t.account_id) ?? { rec: 0, des: 0 };
    if (t.type === "credit") cur.rec += Math.abs(Number(t.amount));
    else cur.des += Math.abs(Number(t.amount));
    byAccount.set(t.account_id, cur);
  }

  const rows: AccountOverviewRow[] = accounts.map((a) => {
    const m = byAccount.get(a.id) ?? { rec: 0, des: 0 };
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      receitasMes: m.rec,
      despesasMes: m.des,
    };
  });

  const bankAccounts = rows.filter((a) => a.type === "checking" || a.type === "savings");
  const creditAccounts = rows.filter((a) => a.type === "credit");

  const receitasPeriodo = periodTx
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const despesasPeriodo = periodTx
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const catMap = new Map<string, number>();
  for (const t of periodTx) {
    if (t.type !== "debit") continue;
    const c = t.category?.trim() || "Sem categoria";
    catMap.set(c, (catMap.get(c) ?? 0) + Math.abs(Number(t.amount)));
  }
  const categorySlices: CategorySlice[] = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return {
    receitasPeriodo,
    despesasPeriodo,
    bankAccounts,
    creditAccounts,
    categorySlices,
  };
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isAdmin = user.email?.toLowerCase() === env.admin.email.toLowerCase();
  const cookieStore = await cookies();
  const viewAs = getViewAsFromCookies(cookieStore, isAdmin);

  if (isAdmin && !viewAs) {
    redirect("/dashboard/admin");
  }

  const sp = await Promise.resolve(searchParams ?? {});
  const period = resolveDashboardPeriod(sp);

  let accounts: AccRow[] = [];
  let transactions: TxRow[] = [];

  if (viewAs) {
    try {
      const admin = createAdminClient();
      const [accountsForUser, transactionsForUser] = await Promise.all([
        getAccountsForUser(admin, viewAs.userId),
        getTransactionsForUser(admin, viewAs.userId, { order: "desc" }),
      ]);
      accounts = accountsForUser.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as AccRow["type"],
        balance: a.balance != null ? Number(a.balance) : 0,
      }));
      transactions = transactionsForUser
        .filter((t) => transactionInPeriod(typeof t.date === "string" ? t.date : String(t.date), period.dateFrom, period.dateTo))
        .map((t) => ({
          amount: Number(t.amount),
          type: t.type,
          category: t.category ?? null,
          account_id: t.account_id,
          date: typeof t.date === "string" ? t.date : String(t.date),
        }));
    } catch {
      accounts = [];
      transactions = [];
    }
  } else {
    const [{ data: accountsData }, { data: transactionsData }] = await Promise.all([
      supabase.from("accounts").select("id, name, type, balance").order("name"),
      supabase
        .from("transactions")
        .select("amount, type, category, account_id, date")
        .gte("date", period.dateFrom)
        .lte("date", period.dateTo)
        .order("date", { ascending: false }),
    ]);
    accounts = (accountsData ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AccRow["type"],
      balance: a.balance != null ? Number(a.balance) : 0,
    }));
    transactions = (transactionsData ?? []).map((t) => ({
      amount: Number(t.amount),
      type: t.type,
      category: t.category ?? null,
      account_id: t.account_id as string,
      date: typeof t.date === "string" ? t.date : String(t.date),
    }));
  }

  const saldoTotal = accounts.reduce((s, a) => s + a.balance, 0);
  const { receitasPeriodo, despesasPeriodo, bankAccounts, creditAccounts, categorySlices } =
    buildOverview(accounts, transactions, period.dateFrom, period.dateTo);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl">
        Visão geral
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {viewAs ? "Resumo das contas deste usuário" : "Resumo das suas contas conectadas"}
      </p>

      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white sm:text-lg">
          Importar extrato
        </h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Envie o PDF do seu extrato bancário para extrair as transações e organizá-las aqui em formato de
          planilha.
        </p>
        <Link
          href="/dashboard/importar-extrato"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Importar extrato
        </Link>
      </section>

      <DashboardOverviewFilters
        selectedYear={period.year}
        isCustomRange={period.fromCustomRange}
        dateFrom={period.dateFrom}
        dateTo={period.dateTo}
        periodLabel={period.label}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Saldo total" value={formatCurrency(saldoTotal)} subtitle="Soma dos saldos das contas" />
        <SummaryCard
          title="Receitas no período"
          value={formatCurrency(receitasPeriodo)}
          variant="positive"
          subtitle={period.label}
        />
        <SummaryCard
          title="Despesas no período"
          value={formatCurrency(despesasPeriodo)}
          variant="negative"
          subtitle={period.label}
        />
      </div>

      <DashboardOverviewVisual
        periodLabel={period.label}
        bankAccounts={bankAccounts}
        creditAccounts={creditAccounts}
        categorySlices={categorySlices}
      />
    </div>
  );
}
