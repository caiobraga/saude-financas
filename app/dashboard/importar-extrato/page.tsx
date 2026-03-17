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
};

type Account = { id: string; name: string };

export default function ImportarExtratoPage() {
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
    fetch("/api/accounts")
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

      const res = await fetch("/api/import/extrato", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao ler extrato.");
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
      setError("Selecione a conta de destino. Crie uma conta em Contas se necessário.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("account_id", accountId.trim());

      const res = await fetch("/api/import/extrato", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao importar extrato.");
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
    a.download = "extrato-transacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Importar extrato (PDF)
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Envie um PDF de extrato bancário. As transações serão extraídas e
        adicionadas à conta que você escolher. Vários PDFs podem ser importados na mesma conta.
      </p>

      {accounts.length === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Crie pelo menos uma conta em{" "}
            <Link href="/dashboard/contas" className="font-medium underline">
              Contas
            </Link>{" "}
            antes de importar um extrato. As transações do PDF serão vinculadas à conta que você selecionar.
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
            Importar para a conta
          </label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            disabled={accounts.length === 0}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white disabled:opacity-60"
          >
            <option value="">Selecione a conta</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Vários extratos podem ser importados na mesma conta.
          </p>
        </div>
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Arquivo PDF do extrato
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
            {success.count} transação(ões) importada(s). Veja em{" "}
            <a href="/dashboard/transacoes" className="font-medium underline">
              Transações
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
            {loading ? "Lendo..." : "Pré-visualizar em tabela"}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !file || !accountId || accounts.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Importando..." : "Importar extrato"}
          </button>
        </div>
      </form>

      {preview && preview.transacoes.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {preview.transacoes.length} transação(ões) encontrada(s) — visualize como tabela ou baixe em CSV
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
                onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Importar estas transações
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Data</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Descrição</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Valor</th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {preview.transacoes.map((t, i) => (
                  <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.date}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-zinc-800 dark:text-zinc-200" title={t.description}>
                      {t.description}
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

      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Dicas
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
          <li>Use extratos exportados em PDF pelo banco (texto selecionável).</li>
          <li>Extratos escaneados (imagem) não são suportados.</li>
          <li>O formato esperado é: data (dd/mm/aaaa), descrição e valor (ex: 1.234,56).</li>
        </ul>
      </div>
    </div>
  );
}
