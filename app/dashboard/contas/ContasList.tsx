"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function accountTypeLabel(type: string) {
  const map: Record<string, string> = {
    checking: "Conta corrente",
    savings: "Poupança",
    credit: "Crédito",
  };
  return map[type] ?? type;
}

type Account = { id: string; name: string; type: string; balance: number };
type Conn = { id: string; institution: string; status: string };
type ConnWithAccounts = { conn: Conn; accounts: Account[] };

type Props = {
  initialData: ConnWithAccounts[];
  readOnly?: boolean;
};

export function ContasList({ initialData, readOnly }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(accountId: string, accountName: string) {
    if (!confirm(`Excluir a conta "${accountName}"? As transações desta conta também serão removidas.`)) return;
    setDeletingId(accountId);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error ?? "Erro ao excluir");
      setData((prev) =>
        prev.map(({ conn, accounts }) => ({
          conn,
          accounts: accounts.filter((a) => a.id !== accountId),
        }))
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir conta");
    } finally {
      setDeletingId(null);
    }
  }

  function onAccountUpdated(accountId: string, updates: { name?: string; type?: string }) {
    setData((prev) =>
      prev.map(({ conn, accounts }) => ({
        conn,
        accounts: accounts.map((a) =>
          a.id === accountId ? { ...a, ...updates } : a
        ),
      }))
    );
    router.refresh();
  }

  function onAccountCreated(connectionId: string, newAccount: Account) {
    setData((prev) =>
      prev.map(({ conn, accounts }) =>
        conn.id === connectionId
          ? { conn, accounts: [...accounts, newAccount] }
          : { conn, accounts }
      )
    );
    router.refresh();
  }

  if (!data.length) {
    return (
      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-500 dark:text-zinc-400">
          Nenhuma conta. Importe um extrato PDF em Importar extrato para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
      {data.map(({ conn, accounts }) => (
        <section
          key={conn.id}
          className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {conn.institution}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                conn.status === "active"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {conn.status === "active" ? "Conectado" : conn.status}
            </span>
          </div>
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {accounts.map((acc) => (
              <li
                key={acc.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {acc.name}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {accountTypeLabel(acc.type)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                    {formatCurrency(Number(acc.balance))}
                  </span>
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <EditAccountButton
                        account={acc}
                        onSaved={(updates) => onAccountUpdated(acc.id, updates)}
                      />
                      <button
                        type="button"
                        onClick={() => handleDelete(acc.id, acc.name)}
                        disabled={deletingId === acc.id}
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {deletingId === acc.id ? "Excluindo…" : "Excluir conta"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <CreateAccountButton
                connectionId={conn.id}
                connectionName={conn.institution}
                onCreated={(newAcc) => onAccountCreated(conn.id, newAcc)}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function EditAccountButton({
  account,
  onSaved,
}: {
  account: Account;
  onSaved: (updates: { name: string; type: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.name);
  const [type, setType] = useState(account.type);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onSaved({ name: name.trim(), type });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
      >
        Editar
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da conta"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
      >
        <option value="checking">Conta corrente</option>
        <option value="savings">Poupança</option>
        <option value="credit">Crédito</option>
      </select>
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Salvando…" : "Salvar"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        Cancelar
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}

function CreateAccountButton({
  connectionId,
  connectionName,
  onCreated,
}: {
  connectionId: string;
  connectionName: string;
  onCreated: (account: Account) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: connectionId,
          name: name.trim(),
          type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar conta");
      onCreated({
        id: data.id,
        name: data.name,
        type: data.type,
        balance: data.balance ?? 0,
      });
      setName("");
      setType("checking");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
      >
        + Nova conta em {connectionName}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Conta corrente principal"
          className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          <option value="checking">Conta corrente</option>
          <option value="savings">Poupança</option>
          <option value="credit">Crédito</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Criando…" : "Criar conta"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        Cancelar
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}
