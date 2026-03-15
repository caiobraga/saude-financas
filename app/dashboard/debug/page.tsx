"use client";

import { useState } from "react";

type Transacao = {
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
};

type DebugResult = {
  rawText: string;
  rawLines: string[];
  afterMerge: string[];
  afterExpand: string[];
  transacoes: Transacao[];
  transacoesFallback: Transacao[];
  count: number;
  csv: string;
};

export default function DebugExtratoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [view, setView] = useState<"raw" | "lines" | "merge" | "expand" | "table">("table");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Selecione um PDF.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/debug/extrato", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao processar PDF.");
        return;
      }
      setResult(data);
      setView("table");
    } catch {
      setError("Erro ao enviar o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!result?.csv) return;
    const blob = new Blob(["\uFEFF" + result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debug-extrato.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const transacoes = result?.transacoesFallback ?? result?.transacoes ?? [];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Debug: PDF em tabela
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Envie um PDF de extrato para ver o texto extraído, cada etapa do pipeline e a tabela
        final. Use para debugar reconhecimento e padronizar extratos de diferentes bancos.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="file" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            PDF do extrato
          </label>
          <input
            id="file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? "Processando..." : "Transformar em tabela"}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-700">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ver:
            </span>
            {(["table", "lines", "merge", "expand", "raw"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded px-3 py-1.5 text-sm ${
                  view === v
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {v === "table" && "Tabela"}
                {v === "lines" && `Linhas brutas (${result.rawLines.length})`}
                {v === "merge" && `Após merge (${result.afterMerge.length})`}
                {v === "expand" && `Após expandir (${result.afterExpand.length})`}
                {v === "raw" && "Texto bruto"}
              </button>
            ))}
            {result.csv && (
              <button
                type="button"
                onClick={downloadCSV}
                className="ml-auto rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Download CSV
              </button>
            )}
          </div>

          {view === "table" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {transacoes.length} transação(ões) reconhecidas
                </p>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                    <tr>
                      <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Data</th>
                      <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Descrição</th>
                      <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Valor</th>
                      <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Tipo</th>
                      <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">Categoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {transacoes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                          Nenhuma transação extraída. Ajuste os padrões em <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">lib/extrato-pdf.ts</code>.
                        </td>
                      </tr>
                    ) : (
                      transacoes.map((t, i) => (
                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.date}</td>
                          <td className="max-w-md truncate px-4 py-2 text-zinc-800 dark:text-zinc-200" title={t.description}>
                            {t.description}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 font-medium tabular-nums">
                            {t.amount >= 0 ? "+" : ""}{t.amount.toFixed(2).replace(".", ",")}
                          </td>
                          <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                            {t.type === "credit" ? "Crédito" : "Débito"}
                          </td>
                          <td className="max-w-[120px] truncate px-4 py-2 text-zinc-500 dark:text-zinc-400">
                            {t.category ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "lines" && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Linhas brutas (split por \\n) — {result.rawLines.length} linha(s)
                </p>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="w-12 py-1 pr-2 font-medium text-zinc-500">#</th>
                      <th className="font-medium text-zinc-700 dark:text-zinc-300">Conteúdo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {result.rawLines.map((line, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2 font-mono text-zinc-400">{i + 1}</td>
                        <td className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
                          {line || "(vazio)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "merge" && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Após juntar linhas de continuação (linhas sem data no início anexadas à anterior) — {result.afterMerge.length} linha(s)
                </p>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="w-12 py-1 pr-2 font-medium text-zinc-500">#</th>
                      <th className="font-medium text-zinc-700 dark:text-zinc-300">Conteúdo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {result.afterMerge.map((line, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2 font-mono text-zinc-400">{i + 1}</td>
                        <td className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
                          {line || "(vazio)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "expand" && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Após expandir blob (uma linha com várias transações → uma linha por transação) — {result.afterExpand.length} linha(s)
                </p>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="w-12 py-1 pr-2 font-medium text-zinc-500">#</th>
                      <th className="font-medium text-zinc-700 dark:text-zinc-300">Conteúdo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {result.afterExpand.map((line, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2 font-mono text-zinc-400">{i + 1}</td>
                        <td className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
                          {line || "(vazio)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "raw" && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Texto bruto extraído do PDF
                </p>
              </div>
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                {result.rawText || "(vazio)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
