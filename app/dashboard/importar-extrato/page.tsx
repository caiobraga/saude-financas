"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportarExtratoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

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
      router.refresh();
    } catch {
      setError("Erro ao enviar o arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Importar extrato (PDF)
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Envie um PDF de extrato bancário. As transações serão extraídas e
        sincronizadas com suas contas. Funciona melhor com extratos em texto
        (não escaneados).
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
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
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Importando..." : "Importar extrato"}
        </button>
      </form>

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
