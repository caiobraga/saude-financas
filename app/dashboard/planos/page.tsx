"use client";

import { useState } from "react";

export default function PlanosPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribePro() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/dashboard?success=pro`,
          cancelUrl: `${window.location.origin}/dashboard/planos`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar checkout");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao assinar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Planos
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Escolha o plano ideal para organizar suas finanças
      </p>

      <div className="mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Gratuito
          </h2>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
            R$ 0
            <span className="text-sm font-normal text-zinc-500">/mês</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>1 conta conectada</li>
            <li>Transações dos últimos 30 dias</li>
            <li>Visualização em planilha</li>
          </ul>
        </div>

        <div className="rounded-xl border-2 border-emerald-500 bg-white p-6 dark:border-emerald-500 dark:bg-zinc-900">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            Pro
          </span>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
            Pro
          </h2>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
            Valor no checkout
            <span className="text-sm font-normal text-zinc-500">/mês</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Contas ilimitadas</li>
            <li>Histórico completo de transações</li>
            <li>Categorização automática</li>
            <li>Exportação para planilha</li>
          </ul>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleSubscribePro}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Redirecionando..." : "Assinar Pro"}
          </button>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">
        Pagamento processado com segurança pelo Stripe. Para ativar o plano Pro,
        crie um produto e um preço recorrente no Stripe Dashboard e defina{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">
          STRIPE_PRO_PRICE_ID
        </code>{" "}
        no .env.
      </p>
    </div>
  );
}
