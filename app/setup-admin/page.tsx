"use client";

import Link from "next/link";
import { useState } from "react";

export default function SetupAdminPage() {
  const [secret, setSecret] = useState("");
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim(), force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Erro ao criar admin" });
        return;
      }
      setMessage({
        type: "ok",
        text: data.message ?? `Admin ${data.email ?? "admin@mail.com"} criado. Faça login em /login.`,
      });
      if (data.ok && !force) setSecret("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="inline-block text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Saúde Finanças
        </Link>
       
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="secret"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Chave (valor de ADMIN_SEED_SECRET)
            </label>
            <input
              id="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            Redefinir senha do admin (se já existir)
          </label>
          {message && (
            <p
              className={`text-sm ${
                message.type === "ok"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Criando…" : "Criar admin (admin@mail.com / mariagb123)"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
