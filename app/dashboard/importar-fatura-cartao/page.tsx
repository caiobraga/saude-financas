"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TransacaoPreview = {
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  card_line_kind?: string;
};

type Account = { id: string; name: string; type?: string };

const LINE_LABELS: Record<string, string> = {
  compra: "Compra",
  resumo: "Resumo / total",
  pagamento: "Pagamento",
  encargo: "Encargo / taxa",
  outro: "Outro",
};

export default function ImportarFaturaCartaoPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number } | null>(null);
  const [preview, setPreview] = useState<{
    transacoes: TransacaoPreview[];
    csv: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/accounts?type=credit")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAccounts(list);
        if (list.length > 0 && !accountId) setAccountId(list[0].id);
      })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && accountId && !accounts.some((a) => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPreview(null);
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("preview", "1");

      const res = await fetch("/api/import/extrato-cartao", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao ler fatura.");
        return;
      }
      if (data.preview && data.transacoes) {
        setPreview({ transacoes: data.transacoes, csv: data.csv ?? "" });
      }
    } catch {
      setError("Erro ao enviar o arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    if (!accountId.trim()) {
      setError("Selecione o cartão (conta crédito). Crie um em Contas se necessário.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("account_id", accountId.trim());

      const res = await fetch("/api/import/extrato-cartao", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao importar fatura.");
        return;
      }
      setSuccess({ count: data.count ?? 0 });
      setFile(null);
      setPreview(null);
      router.refresh();
    } catch {
      setError("Erro ao enviar o arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!preview?.csv) return;
    const blob = new Blob(["\uFEFF" + preview.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fatura-cartao-transacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Importar fatura do cartão (PDF)
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Use esta tela para o PDF da <strong>fatura do cartão</strong> (compras, parcelas, pagamentos e encargos — sem saldo anterior, subtotal ou total da fatura).
        O extrato da <strong>conta corrente</strong> continua em{" "}
        <Link href="/dashboard/importar-extrato" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
          Importar extrato PDF
        </Link>
        .
      </p>

      {accounts.length === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Crie uma conta do tipo <strong>Crédito</strong> em{" "}
            <Link href="/dashboard/contas" className="font-medium underline">
              Contas
            </Link>{" "}
            (ex.: &quot;Cartão Nubank&quot;). Depois selecione-a aqui.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label
            htmlFor="account"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Cartão (conta crédito)
          </label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            disabled={accounts.length === 0}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white disabled:opacity-60"
          >
            <option value="">Selecione o cartão</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            PDF da fatura
          </label>
          <input
            id="file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-900/30 dark:file:text-emerald-300"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {success.count} linha(s) importada(s). Veja em{" "}
            <a href="/dashboard/transacoes-cartao" className="font-medium underline">
              Transações do cartão
            </a>
            .
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading || !file}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {loading ? "Lendo..." : "Pré-visualizar"}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !file || !accountId || accounts.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Importando..." : "Importar fatura"}
          </button>
        </div>
      </form>

      {preview && preview.transacoes.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {preview.transacoes.length} linha(s) — tipo &quot;Resumo&quot; aparece na planilha para conferência
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadCSV}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={(ev) => { ev.preventDefault(); void handleSubmit(ev); }}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Importar estas linhas
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Data</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Descrição</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Tipo linha</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Valor</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Créd/Déb</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {preview.transacoes.map((t, i) => (
                  <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.date}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-zinc-800 dark:text-zinc-200" title={t.description}>
                      {t.description}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {LINE_LABELS[t.card_line_kind ?? ""] ?? t.card_line_kind ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-medium tabular-nums">
                      {t.amount >= 0 ? "+" : ""}{t.amount.toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {t.type === "credit" ? "Crédito" : "Débito"}
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
