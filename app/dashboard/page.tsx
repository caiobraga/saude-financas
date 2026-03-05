import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SummaryCard } from "../components/SummaryCard";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";
import { getAccountsForUser, getTransactionsForUser } from "@/lib/dashboard-for-user";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function DashboardPage() {
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

  let accounts: { id: string; balance: number | null }[] = [];
  let transactions: { amount: number; type: string }[] = [];

  if (viewAs) {
    try {
      const admin = createAdminClient();
      const accountsForUser = await getAccountsForUser(admin, viewAs.userId);
      const transactionsForUser = await getTransactionsForUser(admin, viewAs.userId);
      accounts = accountsForUser.map((a) => ({ id: a.id, balance: a.balance != null ? Number(a.balance) : null }));
      transactions = transactionsForUser.map((t) => ({ amount: Number(t.amount), type: t.type }));
    } catch {
      accounts = [];
      transactions = [];
    }
  } else {
    const [{ data: accountsData }, { data: transactionsData }] = await Promise.all([
      supabase.from("accounts").select("id, balance"),
      supabase.from("transactions").select("amount, type"),
    ]);
    accounts = (accountsData ?? []).map((a) => ({ id: a.id, balance: a.balance != null ? Number(a.balance) : null }));
    transactions = transactionsData ?? [];
  }

  const saldoTotal =
    accounts?.reduce((s, a) => s + (a.balance ?? 0), 0) ?? 0;
  const receitas =
    transactions?.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const despesas =
    transactions?.filter((t) => t.type === "debit").reduce((s, t) => s + Math.abs(Number(t.amount)), 0) ?? 0;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl">
        Visão geral
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {viewAs ? "Resumo das contas deste usuário" : "Resumo das suas contas conectadas"}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Saldo total" value={formatCurrency(saldoTotal)} />
        <SummaryCard
          title="Receitas (período)"
          value={formatCurrency(receitas)}
          variant="positive"
        />
        <SummaryCard
          title="Despesas (período)"
          value={formatCurrency(despesas)}
          variant="negative"
        />
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:mt-10 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Importar extrato
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Envie o PDF do seu extrato bancário para extrair as transações e
          organizá-las aqui em formato de planilha.
        </p>
        <Link
          href="/dashboard/importar-extrato"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Importar extrato
        </Link>
      </section>
    </div>
  );
}
