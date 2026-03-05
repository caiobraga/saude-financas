"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
};

type Account = { id: string; name: string };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function TransacoesTable({
  transactions: initial,
  accounts,
}: {
  transactions: Transaction[];
  accounts: Account[];
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    account_id: accounts[0]?.id ?? "",
    date: todayStr(),
    description: "",
    type: "debit" as "credit" | "debit",
    amount: "",
    category: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = Array.from(
    new Set(transactions.map((t) => t.category ?? "").filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredTransactions = transactions.filter((t) => {
    const matchSearch =
      !searchQuery.trim() ||
      t.description.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchCategory =
      !categoryFilter || (t.category ?? "") === categoryFilter;
    return matchSearch && matchCategory;
  });

  const selectableIds = filteredTransactions
    .filter((t) => editingId !== t.id)
    .map((t) => t.id);
  const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIds));
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditForm({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category ?? undefined,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setTransactions((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...data } : t))
      );
      cancelEdit();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir");
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setDeletingId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir");
      setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  }

  async function submitAdd() {
    if (!addForm.account_id || !addForm.description.trim()) {
      setError("Preencha a conta e a descrição.");
      return;
    }
    const amount = parseFloat(addForm.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount === 0) {
      setError("Informe o valor.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: addForm.account_id,
          date: addForm.date,
          description: addForm.description.trim(),
          type: addForm.type,
          amount: Math.abs(amount),
          category: addForm.category.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
      setTransactions((prev) => [{ ...data, category: data.category ?? null }, ...prev]);
      setShowAddModal(false);
      setAddForm({
        account_id: accounts[0]?.id ?? "",
        date: todayStr(),
        description: "",
        type: "debit",
        amount: "",
        category: "",
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          title={accounts.length === 0 ? "Importe um extrato PDF ou conecte uma conta para poder adicionar transações" : undefined}
          disabled={accounts.length === 0}
          onClick={() => {
            if (accounts.length === 0) return;
            setShowAddModal(true);
            setError(null);
            setAddForm((f) => ({ ...f, date: todayStr(), account_id: accounts[0]?.id ?? f.account_id }));
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-600"
        >
          Adicionar transação
        </button>
        {!transactions.length && (
          <a
            href="/dashboard/importar-extrato"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Importar extrato PDF
          </a>
        )}
      </div>

      {transactions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {(searchQuery.trim() || categoryFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("");
              }}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Limpar filtros
            </button>
          )}
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {filteredTransactions.length} de {transactions.length} transações
          </span>
        </div>
      )}

      {!transactions.length ? (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            {accounts.length === 0
              ? "Importe um extrato em PDF para criar uma conta; depois você poderá adicionar transações manualmente."
              : "Nenhuma transação ainda. Adicione uma acima ou importe um extrato em PDF."}
          </p>
        </div>
      ) : (
    <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <p className="bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/80">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
          </span>
          {!confirmBulkDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                disabled={loading}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Excluir selecionadas
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
              >
                Limpar seleção
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Excluir {selectedIds.size} transação(ões)?
              </span>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={loading}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Excluindo..." : "Sim, excluir"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                disabled={loading}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todas"
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </th>
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
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                {editingId === t.id ? (
                  <>
                    <td className="w-10 px-2 py-2" />
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editForm.date ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, date: e.target.value }))
                        }
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.description ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.category ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            category: e.target.value || undefined,
                          }))
                        }
                        placeholder="—"
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <select
                          value={editForm.type ?? "debit"}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              type: e.target.value as "credit" | "debit",
                            }))
                          }
                          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                        >
                          <option value="debit">Débito</option>
                          <option value="credit">Crédito</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          value={
                            editForm.amount != null
                              ? Math.abs(Number(editForm.amount))
                              : ""
                          }
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            const type = editForm.type ?? "debit";
                            setEditForm((f) => ({
                              ...f,
                              amount:
                                type === "debit" ? (Number.isNaN(v) ? 0 : -Math.abs(v)) : Math.abs(v),
                            }));
                          }}
                          className="w-28 rounded border border-zinc-300 bg-white px-2 py-1.5 text-right tabular-nums text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={loading}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={loading}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="w-10 px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        aria-label={`Selecionar ${t.description.slice(0, 30)}`}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          Editar
                        </button>
                        {deletingId === t.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button
                              type="button"
                              onClick={() => confirmDelete(t.id)}
                              disabled={loading}
                              className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="text-zinc-500 hover:underline"
                            >
                              Não
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingId(t.id)}
                            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deletingId && (
        <p className="border-t border-zinc-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-zinc-800 dark:bg-amber-900/20 dark:text-amber-200">
          Excluir esta transação? Clique em &quot;Sim&quot; na linha para
          confirmar.
        </p>
      )}
    </div>
      )}

      {showAddModal && accounts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Nova transação</h2>
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Conta</label>
                <select
                  value={addForm.account_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, account_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Data</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Descrição</label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Supermercado"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as "credit" | "debit" }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="debit">Débito</option>
                    <option value="credit">Crédito</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Valor (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={addForm.amount}
                    onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0,00"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Categoria (opcional)</label>
                <input
                  type="text"
                  value={addForm.category}
                  onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Ex: Alimentação"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={loading}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitAdd}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
