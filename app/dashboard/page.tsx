import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SummaryCard } from "../components/SummaryCard";

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

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, balance");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, type");

  const saldoTotal =
    accounts?.reduce((s, a) => s + Number(a.balance ?? 0), 0) ?? 0;
  const receitas =
    transactions?.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const despesas =
    transactions?.filter((t) => t.type === "debit").reduce((s, t) => s + Math.abs(Number(t.amount)), 0) ?? 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Visão geral
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Resumo das suas contas conectadas
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

      <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Conectar sua conta bancária
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Conecte seu banco de forma segura via Open Finance Brasil (Belvo).
          Suas transações e saldos serão sincronizados e exibidos aqui em
          formato de planilha.
        </p>
        <Link
          href="/dashboard/conectar"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Conectar instituição
        </Link>
      </section>
    </div>
  );
}
