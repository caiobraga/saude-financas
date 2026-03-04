import { createClient } from "@/lib/supabase/server";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function TransacoesPage() {
  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, date, description, amount, type, category")
    .order("date", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Transações
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Todas as movimentações das suas contas, em formato de planilha
      </p>

      {!transactions?.length ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            Nenhuma transação ainda. Conecte um banco para ver suas movimentações.
          </p>
          <a
            href="/dashboard/conectar"
            className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            Conectar instituição
          </a>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Data
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Descrição
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Categoria
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300 text-right">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                      {t.description}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t.category ?? "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium ${
                        t.type === "credit"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {t.type === "credit" ? "+" : ""}
                      {formatCurrency(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
