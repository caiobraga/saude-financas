"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
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

const PROLABORE_CATEGORY_REGEX = /s[oó]cio|pr[oó]-?labore|prolabore|retirada/i;

function isProLabore(t: Transaction): boolean {
  const cat = (t.category ?? "").trim();
  return cat.length > 0 && PROLABORE_CATEGORY_REGEX.test(cat);
}

type PeriodMode = "month" | "range";

type PlanilhaTab = "tudo" | "despesas" | "receitas";

const TAB_LABELS: { id: PlanilhaTab; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "despesas", label: "Gastos por categoria (%)" },
  { id: "receitas", label: "Lucros por categoria (%)" },
];

function PlanilhasContent() {
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<PlanilhaTab>("tudo");
  const [mode, setMode] = useState<PeriodMode>(() => {
    const de = searchParams.get("de");
    const ate = searchParams.get("ate");
    return de && ate ? "range" : "month";
  });
  const [ano, setAno] = useState(() => {
    const y = searchParams.get("ano");
    return y ? parseInt(y, 10) : new Date().getFullYear();
  });
  const [mes, setMes] = useState(() => {
    const m = searchParams.get("mes");
    return m ? parseInt(m, 10) : new Date().getMonth() + 1;
  });
  const [dataInicio, setDataInicio] = useState(() => {
    const de = searchParams.get("de");
    if (de && /^\d{4}-\d{2}-\d{2}$/.test(de)) return de;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const ate = searchParams.get("ate");
    if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) return ate;
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const from = mode === "month"
    ? `${ano}-${String(mes).padStart(2, "0")}-01`
    : dataInicio;
  const lastDay = mode === "month" ? new Date(ano, mes, 0).getDate() : 31;
  const to = mode === "month"
    ? `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    : dataFim;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar");
      setTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar transações");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const receitas = transactions.filter((t) => t.type === "credit");
  const debits = transactions.filter((t) => t.type === "debit");
  const prolabore = debits.filter(isProLabore);
  const despesasOutras = debits.filter((t) => !isProLabore(t));

  const totalReceitas = receitas.reduce((s, t) => s + Number(t.amount), 0);
  const totalProlabore = prolabore.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalDespesasOutras = despesasOutras.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalDespesas = totalProlabore + totalDespesasOutras;
  const resultado = totalReceitas - totalDespesas;

  const despesasOutrasPorCategoria = despesasOutras.reduce<Record<string, Transaction[]>>((acc, t) => {
    const cat = (t.category && t.category.trim()) || "Outras despesas";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const categoriasOrdenadas = Object.keys(despesasOutrasPorCategoria).sort((a, b) => {
    const sumA = despesasOutrasPorCategoria[a].reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const sumB = despesasOutrasPorCategoria[b].reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    return sumB - sumA;
  });

  const despesasPorCategoria = debits.reduce<Record<string, Transaction[]>>((acc, t) => {
    const cat = (t.category && t.category.trim()) || "Outras despesas";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const categoriasDespesasOrdenadas = Object.keys(despesasPorCategoria).sort((a, b) => {
    const sumA = despesasPorCategoria[a].reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const sumB = despesasPorCategoria[b].reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    return sumB - sumA;
  });

  const receitasPorCategoria = receitas.reduce<Record<string, Transaction[]>>((acc, t) => {
    const cat = (t.category && t.category.trim()) || "Outras receitas";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const categoriasReceitasOrdenadas = Object.keys(receitasPorCategoria).sort((a, b) => {
    const sumA = receitasPorCategoria[a].reduce((s, t) => s + Number(t.amount), 0);
    const sumB = receitasPorCategoria[b].reduce((s, t) => s + Number(t.amount), 0);
    return sumB - sumA;
  });

  function updatePeriodMonth(newAno: number, newMes: number) {
    setAno(newAno);
    setMes(newMes);
    setMode("month");
    const params = new URLSearchParams();
    params.set("ano", String(newAno));
    params.set("mes", String(newMes));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  function updatePeriodRange(de: string, ate: string) {
    setDataInicio(de);
    setDataFim(ate);
    setMode("range");
    const params = new URLSearchParams();
    params.set("de", de);
    params.set("ate", ate);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  function setModeAndUrl(newMode: PeriodMode) {
    setMode(newMode);
    const params = new URLSearchParams();
    if (newMode === "month") {
      params.set("ano", String(ano));
      params.set("mes", String(mes));
    } else {
      params.set("de", dataInicio);
      params.set("ate", dataFim);
    }
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const periodoLabel = mode === "month"
    ? `${MONTHS[mes - 1]} / ${ano}`
    : `${new Date(from + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(to + "T12:00:00").toLocaleDateString("pt-BR")}`;

  async function downloadXls() {
    const mod = await import("xlsx");
    const XLSX = "default" in mod && mod.default ? mod.default : mod;
    const wb = XLSX.utils.book_new();

    const resumoData = [
      ["Resumo gerencial"],
      ["Receitas", formatCurrency(totalReceitas)],
      ["Despesas operacionais + Impostos + Fornecedores", formatCurrency(totalDespesasOutras)],
      ["Retiradas sócio", formatCurrency(totalProlabore)],
      ["Resultado", formatCurrency(resultado)],
    ];
    wb.SheetNames.push("Resumo");
    wb.Sheets["Resumo"] = XLSX.utils.aoa_to_sheet(resumoData);

    const receitasData = [
      ["Data", "Descrição", "Valor"],
      ...receitas.sort((a, b) => a.date.localeCompare(b.date)).map((t) => [
        formatDateShort(t.date),
        t.description,
        formatCurrency(Number(t.amount)),
      ]),
      [],
      ["Total", "", formatCurrency(totalReceitas)],
    ];
    wb.SheetNames.push("Receitas");
    wb.Sheets["Receitas"] = XLSX.utils.aoa_to_sheet(receitasData);

    const prolaboreData = [
      ["Data", "Descrição", "Valor"],
      ...prolabore.sort((a, b) => a.date.localeCompare(b.date)).map((t) => [
        formatDateShort(t.date),
        t.description,
        "-" + formatCurrency(Math.abs(Number(t.amount))),
      ]),
      [],
      ["Total retiradas sócio", "", formatCurrency(totalProlabore)],
    ];
    wb.SheetNames.push("Pro-labore");
    wb.Sheets["Pro-labore"] = XLSX.utils.aoa_to_sheet(prolaboreData);

    const despesasRows: (string | number)[][] = [
      ["Data", "Descrição", "Valor", "Categoria"],
      ...despesasOutras
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => [
          formatDateShort(t.date),
          t.description,
          "-" + formatCurrency(Math.abs(Number(t.amount))),
          (t.category && t.category.trim()) || "Outras despesas",
        ]),
      [],
      ["Total despesas operacionais", "", formatCurrency(totalDespesasOutras), ""],
    ];
    wb.SheetNames.push("Despesas");
    wb.Sheets["Despesas"] = XLSX.utils.aoa_to_sheet(despesasRows);

    const nomeArquivo = `planilha_${from}_${to}.xls`;
    XLSX.writeFile(wb, nomeArquivo, { bookType: "xls", bookSST: true });
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Planilhas
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Extrato organizado por categorias para o período selecionado. Use as categorias nas transações para agrupar aqui.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Período:</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModeAndUrl("month")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "month"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            Por mês
          </button>
          <button
            type="button"
            onClick={() => setModeAndUrl("range")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "range"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            Início e fim
          </button>
        </div>
        {mode === "month" ? (
          <>
            <select
              value={mes}
              onChange={(e) => updatePeriodMonth(ano, parseInt(e.target.value, 10))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            >
              {MONTHS.map((label, i) => (
                <option key={i} value={i + 1}>{label}</option>
              ))}
            </select>
            <select
              value={ano}
              onChange={(e) => updatePeriodMonth(parseInt(e.target.value, 10), mes)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            >
              {anosDisponiveis.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              De
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => updatePeriodRange(e.target.value, dataFim)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Até
              <input
                type="date"
                value={dataFim}
                onChange={(e) => updatePeriodRange(dataInicio, e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </>
        )}
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {periodoLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {TAB_LABELS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                aba === id
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={downloadXls}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            Baixar .xls
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 text-zinc-500 dark:text-zinc-400">Carregando…</div>
      )}

      {!loading && !error && (
        <div className="mt-8 space-y-10">
          {aba === "tudo" && (
          <>
          {/* 1. Receitas Operacionais */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              1️⃣ Receitas operacionais
            </h2>
            {receitas.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma receita no período.</p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Data</th>
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Descrição</th>
                        <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receitas
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((t) => (
                          <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{formatDateShort(t.date)}</td>
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{t.description}</td>
                            <td className="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(Number(t.amount))}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Total Receitas Operacionais: {formatCurrency(totalReceitas)}
                </p>
              </>
            )}
          </section>

          {/* 2. Transferências Sócio / Pró-labore */}
          {prolabore.length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                2️⃣ Transferências para sócio / pró-labore
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Data</th>
                      <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Descrição</th>
                      <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prolabore
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((t) => (
                        <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{formatDateShort(t.date)}</td>
                          <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{t.description}</td>
                          <td className="py-2 text-right font-medium text-red-600 dark:text-red-400">
                            -{formatCurrency(Math.abs(Number(t.amount)))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Total retiradas sócio: {formatCurrency(totalProlabore)}
              </p>
            </section>
          )}

          {/* 3. Despesas Operacionais por categoria */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              3️⃣ Despesas operacionais
            </h2>
            {categoriasOrdenadas.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma despesa categorizada no período (exceto pró-labore).</p>
            ) : (
              <div className="mt-4 space-y-6">
                {categoriasOrdenadas.map((cat) => {
                  const itens = despesasOutrasPorCategoria[cat];
                  const totalCat = itens.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
                  return (
                    <div key={cat}>
                      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{cat}</h3>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[320px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-700">
                              <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-500">Data</th>
                              <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-500">Descrição</th>
                              <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-500">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itens
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((t) => (
                                <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
                                  <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{formatDateShort(t.date)}</td>
                                  <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{t.description}</td>
                                  <td className="py-2 text-right font-medium text-red-600 dark:text-red-400">
                                    -{formatCurrency(Math.abs(Number(t.amount)))}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Total {cat}: {formatCurrency(totalCat)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Resumo gerencial */}
          <section className="rounded-xl border-2 border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/80">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              📈 Resumo gerencial {mode === "month" ? "do mês" : "do período"}
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between gap-4">
                <span className="text-zinc-600 dark:text-zinc-400">Receitas:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalReceitas)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-zinc-600 dark:text-zinc-400">Despesas operacionais + Impostos + Fornecedores:</span>
                <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(totalDespesasOutras)}</span>
              </li>
              {totalProlabore > 0 && (
                <li className="flex justify-between gap-4">
                  <span className="text-zinc-600 dark:text-zinc-400">Retiradas sócio:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(totalProlabore)}</span>
                </li>
              )}
              <li className="flex justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Resultado do mês:</span>
                <span className={`font-semibold ${resultado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(resultado)}
                </span>
              </li>
            </ul>
            {resultado < 0 && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                🔻 Saída superior à entrada no período.
              </p>
            )}
          </section>
          </>
          )}

          {aba === "despesas" && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Gastos por categoria (% do total de despesas)
            </h2>
            {categoriasDespesasOrdenadas.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma despesa no período.</p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Categoria</th>
                        <th className="pb-2 pr-4 text-right font-medium text-zinc-600 dark:text-zinc-400">Valor</th>
                        <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriasDespesasOrdenadas.map((cat) => {
                        const itens = despesasPorCategoria[cat];
                        const totalCat = itens.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
                        const pct = totalDespesas > 0 ? (totalCat / totalDespesas) * 100 : 0;
                        return (
                          <tr key={cat} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{cat}</td>
                            <td className="py-2 pr-4 text-right font-medium text-red-600 dark:text-red-400">
                              {formatCurrency(totalCat)}
                            </td>
                            <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">{pct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Total despesas: {formatCurrency(totalDespesas)}
                </p>
              </>
            )}
          </section>
          )}

          {aba === "receitas" && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Lucros / receitas por categoria (% do total de receitas)
            </h2>
            {categoriasReceitasOrdenadas.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma receita no período.</p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Categoria</th>
                        <th className="pb-2 pr-4 text-right font-medium text-zinc-600 dark:text-zinc-400">Valor</th>
                        <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriasReceitasOrdenadas.map((cat) => {
                        const itens = receitasPorCategoria[cat];
                        const totalCat = itens.reduce((s, t) => s + Number(t.amount), 0);
                        const pct = totalReceitas > 0 ? (totalCat / totalReceitas) * 100 : 0;
                        return (
                          <tr key={cat} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{cat}</td>
                            <td className="py-2 pr-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(totalCat)}
                            </td>
                            <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">{pct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Total receitas: {formatCurrency(totalReceitas)}
                </p>
              </>
            )}
          </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlanilhasPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 md:p-8"><p className="text-zinc-500">Carregando planilhas…</p></div>}>
      <PlanilhasContent />
    </Suspense>
  );
}
