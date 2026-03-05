"use client";

import { useState, useEffect } from "react";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  despesas?: number;
  receitas?: number;
};

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function AdminPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) setAllUsers(data);
        else setAllUsers([]);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar usuários");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const users = q
    ? allUsers.filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      )
    : allUsers;

  async function viewAsUser(user: UserRow) {
    const userId = user?.id?.trim?.() ?? "";
    if (!userId) {
      setError("ID do usuário não disponível.");
      return;
    }
    setImpersonating(user.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userName: (user.full_name || user.email || "Usuário").toString().trim() || "Usuário",
        }),
        redirect: "manual",
      });
      if (res.type === "opaqueredirect" || res.status === 302) {
        window.location.href = "/dashboard";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro ${res.status} ao definir visualização`);
      }
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ver dados do usuário");
    } finally {
      setImpersonating(null);
    }
  }

  return (
    <div className="mt-6 space-y-4 sm:mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filtrar por nome ou e-mail..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 sm:min-w-[200px]"
        />
        {searchQuery.trim() && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {users.length} de {allUsers.length} usuários
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Ao clicar em &quot;Ver dados de&quot;, você permanece logado como admin e passa a ver as informações desse usuário no dashboard. Use &quot;Parar de ver&quot; no topo para voltar.
      </p>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Carregando usuários…
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <div className="min-w-[640px] rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {users.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 dark:text-zinc-400 sm:p-8">
                {allUsers.length === 0
                  ? "Nenhum usuário cadastrado."
                  : "Nenhum usuário corresponde ao filtro."}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                    <th className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 sm:px-4 sm:py-3">
                      Nome
                    </th>
                    <th className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 sm:px-4 sm:py-3">
                      E-mail
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 text-right sm:px-4 sm:py-3">
                      Receitas
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 text-right sm:px-4 sm:py-3">
                      Despesas
                    </th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-zinc-100 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100 sm:px-4 sm:py-3">
                        {u.full_name ?? "—"}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400 sm:max-w-none sm:px-4 sm:py-3">
                        {u.email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-700 dark:text-zinc-300 tabular-nums sm:px-4 sm:py-3">
                        {formatBRL(u.receitas ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-700 dark:text-zinc-300 tabular-nums sm:px-4 sm:py-3">
                        {formatBRL(u.despesas ?? 0)}
                      </td>
                      <td className="px-3 py-2 sm:px-4 sm:py-3">
                        <button
                          type="button"
                          onClick={() => viewAsUser(u)}
                          disabled={impersonating !== null}
                          className="whitespace-nowrap rounded-lg bg-zinc-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 sm:px-3 sm:text-sm"
                        >
                          {impersonating === u.id
                            ? "Redirecionando…"
                            : "Ver dados de"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
