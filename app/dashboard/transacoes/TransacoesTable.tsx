"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSubcategoria, SUBCATEGORIAS } from "@/lib/categorias";

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
  subcategoria: string | null;
  account_id: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  import_source?: string | null;
  import_batch_id?: string | null;
  import_order?: number | null;
  created_at?: string | null;
  card_line_kind?: string | null;
};

type Account = { id: string; name: string };

export type TransacoesTableContext = "bank" | "credit";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shouldSortByImportOrder(
  importBatchFilter: string,
  importSourceFilter: string,
  filtered: Transaction[]
): boolean {
  if (importBatchFilter.trim()) return true;
  if (importSourceFilter !== "pdf" && importSourceFilter !== "pdf_cartao") return false;
  const batchIds = new Set(
    filtered.map((t) => t.import_batch_id).filter((id): id is string => Boolean(id))
  );
  return batchIds.size === 1;
}

export function TransacoesTable({
  transactions: initial,
  accounts,
  context = "bank",
}: {
  transactions: Transaction[];
  accounts: Account[];
  /** bank = corrente/poupança; credit = só cartão (filtros de PDF fatura só aqui) */
  context?: TransacoesTableContext;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");
  const [addForm, setAddForm] = useState({
    account_id: accounts[0]?.id ?? "",
    date: todayStr(),
    description: "",
    type: "debit" as "credit" | "debit",
    amount: "",
    category: "",
    subcategoria: "Variáveis" as string,
    parcela_numero: "" as string | number,
    parcela_total: "" as string | number,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [importSourceFilter, setImportSourceFilter] = useState("");
  const [importBatchFilter, setImportBatchFilter] = useState("");
  const [cardLineKindFilter, setCardLineKindFilter] = useState("");

  const categories = Array.from(
    new Set(transactions.map((t) => t.category ?? "").filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const pdfBatchMeta = new Map<string, { count: number; firstCreatedAt: string | null }>();
  for (const t of transactions) {
    if (!t.import_batch_id) continue;
    if (context === "bank" && t.import_source !== "pdf") continue;
    if (context === "credit" && t.import_source !== "pdf_cartao") continue;
    const prev = pdfBatchMeta.get(t.import_batch_id);
    if (!prev) {
      pdfBatchMeta.set(t.import_batch_id, {
        count: 1,
        firstCreatedAt: t.created_at ?? null,
      });
    } else {
      prev.count += 1;
      if (t.created_at && (!prev.firstCreatedAt || t.created_at < prev.firstCreatedAt)) {
        prev.firstCreatedAt = t.created_at;
      }
    }
  }
  const pdfBatchOptions = Array.from(pdfBatchMeta.entries())
    .map(([id, meta]) => ({ id, ...meta }))
    .sort((a, b) => (b.firstCreatedAt ?? "").localeCompare(a.firstCreatedAt ?? ""));

  let filteredTransactions = transactions.filter((t) => {
    const matchSearch =
      !searchQuery.trim() ||
      t.description.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchCategory =
      !categoryFilter || (t.category ?? "") === categoryFilter;
    const matchAccount =
      !accountFilter || (t.account_id ?? "") === accountFilter;
    const matchImportSource =
      !importSourceFilter || (t.import_source ?? "") === importSourceFilter;
    const matchImportBatch =
      !importBatchFilter || (t.import_batch_id ?? "") === importBatchFilter;
    const matchCardLine =
      !cardLineKindFilter || (t.card_line_kind ?? "") === cardLineKindFilter;
    return (
      matchSearch &&
      matchCategory &&
      matchAccount &&
      matchImportSource &&
      matchImportBatch &&
      matchCardLine
    );
  });

  if (shouldSortByImportOrder(importBatchFilter, importSourceFilter, filteredTransactions)) {
    filteredTransactions = [...filteredTransactions].sort((a, b) => {
      const ao = a.import_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.import_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      const ca = a.created_at ?? "";
      const cb = b.created_at ?? "";
      if (ca !== cb) return ca.localeCompare(cb);
      return a.id.localeCompare(b.id);
    });
  }

  function getAccountName(accountId: string | null): string {
    if (!accountId) return "—";
    return accounts.find((a) => a.id === accountId)?.name ?? "—";
  }

  const selectableIds = filteredTransactions
    .filter((t) => editingId !== t.id)
    .map((t) => t.id);
  const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const showParcelaColumn = transactions.some((t) => t.parcela_numero != null && t.parcela_total != null);
  const showCardLineColumn =
    context === "credit" &&
    transactions.some((t) => t.card_line_kind != null && t.card_line_kind !== "");

  const CARD_LINE_LABELS: Record<string, string> = {
    compra: "Compra",
    resumo: "Resumo / total",
    pagamento: "Pagamento",
    encargo: "Encargo / taxa",
    outro: "Outro",
  };

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
      subcategoria: t.subcategoria ?? getSubcategoria(t.category),
      account_id: t.account_id ?? undefined,
      parcela_numero: t.parcela_numero ?? undefined,
      parcela_total: t.parcela_total ?? undefined,
      card_line_kind: t.card_line_kind ?? undefined,
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
        body: JSON.stringify({
        ...editForm,
        parcela_numero: editForm.parcela_numero ?? null,
        parcela_total: editForm.parcela_total ?? null,
      }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                ...data,
                category: data.category ?? null,
                subcategoria: data.subcategoria ?? null,
                account_id: data.account_id ?? null,
                parcela_numero: data.parcela_numero ?? null,
                parcela_total: data.parcela_total ?? null,
                card_line_kind: data.card_line_kind ?? t.card_line_kind ?? null,
              }
            : t
        )
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
    if (!addForm.description.trim()) {
      setError("Preencha a descrição.");
      return;
    }
    const amount = parseFloat(addForm.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount === 0) {
      setError("Informe o valor.");
      return;
    }
    setLoading(true);
    setError(null);
    const parcelaNumero = addForm.parcela_numero === "" ? null : Number(addForm.parcela_numero);
    const parcelaTotal = addForm.parcela_total === "" ? null : Number(addForm.parcela_total);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: addForm.account_id && addForm.account_id.trim() ? addForm.account_id : null,
          date: addForm.date,
          description: addForm.description.trim(),
          type: addForm.type,
          amount: Math.abs(amount),
          category: addForm.category.trim() || null,
          subcategoria: addForm.subcategoria || null,
          parcela_numero: parcelaNumero ?? null,
          parcela_total: parcelaTotal ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
      setTransactions((prev) => [{ ...data, category: data.category ?? null, subcategoria: data.subcategoria ?? null, account_id: data.account_id ?? null, parcela_numero: data.parcela_numero ?? null, parcela_total: data.parcela_total ?? null }, ...prev]);
      setShowAddModal(false);
      setAddForm({
        account_id: (accountFilter || accounts[0]?.id) ?? "",
        date: todayStr(),
        description: "",
        type: "debit",
        amount: "",
        category: "",
        subcategoria: "Variáveis",
        parcela_numero: "",
        parcela_total: "",
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
          onClick={() => {
            setShowAddModal(true);
            setError(null);
            const defaultAccountId = (accountFilter || accounts[0]?.id) ?? "";
            setAddForm((f) => ({ ...f, date: todayStr(), account_id: defaultAccountId }));
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
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
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
          <select
            value={importSourceFilter}
            onChange={(e) => {
              const v = e.target.value;
              setImportSourceFilter(v);
              if (
                (context === "bank" && v !== "pdf") ||
                (context === "credit" && v !== "pdf_cartao")
              ) {
                setImportBatchFilter("");
              }
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Todas as origens</option>
            {context === "bank" && (
              <option value="pdf">Extrato conta (PDF)</option>
            )}
            {context === "credit" && (
              <option value="pdf_cartao">Fatura cartão (PDF)</option>
            )}
            <option value="manual">Manuais</option>
          </select>
          <select
            value={importBatchFilter}
            onChange={(e) => {
              const v = e.target.value;
              setImportBatchFilter(v);
              if (v) {
                setImportSourceFilter(context === "credit" ? "pdf_cartao" : "pdf");
              }
            }}
            disabled={pdfBatchOptions.length === 0}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">
              {context === "credit" ? "Todas as faturas (PDF)" : "Todos os lotes (PDF extrato)"}
            </option>
            {pdfBatchOptions.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {context === "credit"
                  ? `Fatura ${batch.id.slice(-8)} (${batch.count} trans.)`
                  : `Lote extrato ${batch.id.slice(-8)} (${batch.count} trans.)`}
              </option>
            ))}
          </select>
          {showCardLineColumn && (
            <select
              value={cardLineKindFilter}
              onChange={(e) => setCardLineKindFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Todas as linhas (fatura)</option>
              <option value="compra">Compra</option>
              <option value="resumo">Resumo / total</option>
              <option value="pagamento">Pagamento</option>
              <option value="encargo">Encargo / taxa</option>
              <option value="outro">Outro</option>
            </select>
          )}
          {(searchQuery.trim() ||
            categoryFilter ||
            accountFilter ||
            importSourceFilter ||
            importBatchFilter ||
            cardLineKindFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("");
                setAccountFilter("");
                setImportSourceFilter("");
                setImportBatchFilter("");
                setCardLineKindFilter("");
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
      <datalist id="categories-datalist">
        {categories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
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
                Conta
              </th>
              <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                Categoria
              </th>
              <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                Subcategoria
              </th>
              {showCardLineColumn && (
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Linha fatura
                </th>
              )}
              {showParcelaColumn && (
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                  Parcela
                </th>
              )}
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
                      <select
                        value={editForm.account_id ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, account_id: e.target.value || undefined }))
                        }
                        className="w-full min-w-[8rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="">Nenhuma</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        list="categories-datalist"
                        value={editForm.category ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditForm((f) => ({
                            ...f,
                            category: v || undefined,
                            subcategoria: getSubcategoria(v || null),
                          }));
                        }}
                        placeholder="Digite ou selecione"
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.subcategoria ?? "Variáveis"}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, subcategoria: e.target.value }))
                        }
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      >
                        {SUBCATEGORIAS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    {showCardLineColumn && (
                      <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {editForm.card_line_kind
                          ? CARD_LINE_LABELS[editForm.card_line_kind] ?? editForm.card_line_kind
                          : "—"}
                      </td>
                    )}
                    {showParcelaColumn && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            placeholder="Nº"
                            value={editForm.parcela_numero ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                parcela_numero: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                              }))
                            }
                            className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                          />
                          <span className="text-zinc-500">/</span>
                          <input
                            type="number"
                            min={1}
                            placeholder="Total"
                            value={editForm.parcela_total ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                parcela_total: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                              }))
                            }
                            className="w-14 rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                          />
                        </div>
                      </td>
                    )}
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
                      {getAccountName(t.account_id)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {t.subcategoria ?? getSubcategoria(t.category)}
                    </td>
                    {showCardLineColumn && (
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {t.card_line_kind
                          ? CARD_LINE_LABELS[t.card_line_kind] ?? t.card_line_kind
                          : "—"}
                      </td>
                    )}
                    {showParcelaColumn && (
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {t.parcela_numero != null && t.parcela_total != null ? (
                          <span title={t.parcela_total - t.parcela_numero > 0 ? `Faltam ${t.parcela_total - t.parcela_numero} parcelas` : undefined}>
                            {t.parcela_numero}/{t.parcela_total}
                            {t.parcela_total - t.parcela_numero > 0 && (
                              <span className="ml-1 text-xs text-zinc-500">(faltam {t.parcela_total - t.parcela_numero})</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
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
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Conta (opcional)</label>
                <select
                  value={addForm.account_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, account_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">Nenhuma</option>
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
                  list="categories-datalist"
                  value={addForm.category}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAddForm((f) => ({
                      ...f,
                      category: v,
                      subcategoria: getSubcategoria(v || null),
                    }));
                  }}
                  placeholder="Digite ou selecione (ex: Alimentação)"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Subcategoria</label>
                <select
                  value={addForm.subcategoria}
                  onChange={(e) => setAddForm((f) => ({ ...f, subcategoria: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                >
                  {SUBCATEGORIAS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Parcela (opcional)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Nº"
                    value={addForm.parcela_numero === "" ? "" : addForm.parcela_numero}
                    onChange={(e) => setAddForm((f) => ({ ...f, parcela_numero: e.target.value === "" ? "" : parseInt(e.target.value, 10) || "" }))}
                    className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                  <span className="text-zinc-500">/</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="Total"
                    value={addForm.parcela_total === "" ? "" : addForm.parcela_total}
                    onChange={(e) => setAddForm((f) => ({ ...f, parcela_total: e.target.value === "" ? "" : parseInt(e.target.value, 10) || "" }))}
                    className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
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
