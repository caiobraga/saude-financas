"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSubcategoria, ordenarSubcategorias } from "@/lib/categorias";

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
  subcategoria?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  import_source?: string | null;
  card_line_kind?: string | null;
};

const PROLABORE_CATEGORY_REGEX = /s[oó]cio|pr[oó]-?labore|prolabore|retirada/i;

function isProLabore(t: Transaction): boolean {
  const cat = (t.category ?? "").trim();
  return cat.length > 0 && PROLABORE_CATEGORY_REGEX.test(cat);
}

function hasParcelaAlguma(lista: Transaction[]): boolean {
  return lista.some((t) => t.parcela_numero != null && t.parcela_total != null);
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
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [accountFilter, setAccountFilter] = useState("");
  const [excludeCardResumoFromTotals, setExcludeCardResumoFromTotals] = useState(true);
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
      const params = new URLSearchParams({ from, to });
      if (accountFilter && accountFilter.trim()) params.set("account_id", accountFilter.trim());
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar");
      setTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar transações");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, accountFilter]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isCardResumoLineExcluded = (t: Transaction) =>
    excludeCardResumoFromTotals &&
    t.import_source === "pdf_cartao" &&
    t.card_line_kind === "resumo";

  const transactionsForTotals = transactions.filter((t) => !isCardResumoLineExcluded(t));
  const cardFaturaLines = transactions.filter((t) => t.import_source === "pdf_cartao");

  const receitas = transactionsForTotals.filter((t) => t.type === "credit");
  const debits = transactionsForTotals.filter((t) => t.type === "debit");
  const prolabore = debits.filter(isProLabore);
  const despesasOutras = debits.filter((t) => !isProLabore(t));

  const totalReceitas = receitas.reduce((s, t) => s + Number(t.amount), 0);
  const totalProlabore = prolabore.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalDespesasOutras = despesasOutras.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalDespesas = totalProlabore + totalDespesasOutras;
  const resultado = totalReceitas - totalDespesas;

  const despesasPorSubcategoria = despesasOutras.reduce<Record<string, Record<string, Transaction[]>>>((acc, t) => {
    const sub = t.subcategoria ?? getSubcategoria(t.category);
    const cat = (t.category && t.category.trim()) || "Outras despesas";
    if (!acc[sub]) acc[sub] = {};
    if (!acc[sub][cat]) acc[sub][cat] = [];
    acc[sub][cat].push(t);
    return acc;
  }, {});
  const subcategoriasOrdenadas = ordenarSubcategorias(Object.keys(despesasPorSubcategoria));
  const linhasCategoriaSubcategoria: { subcategoria: string; categoria: string; total: number }[] = [];
  type CasaRow = { type: "sub"; name: string } | { type: "cat"; categoria: string; total: number };
  const casaRows: CasaRow[] = [];
  for (const sub of subcategoriasOrdenadas) {
    const cats = Object.keys(despesasPorSubcategoria[sub] ?? {}).sort((a, b) => {
      const sumA = (despesasPorSubcategoria[sub][a] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const sumB = (despesasPorSubcategoria[sub][b] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      return sumB - sumA;
    });
    casaRows.push({ type: "sub", name: sub });
    for (const cat of cats) {
      const total = (despesasPorSubcategoria[sub][cat] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      linhasCategoriaSubcategoria.push({ subcategoria: sub, categoria: cat, total });
      casaRows.push({ type: "cat", categoria: cat, total });
    }
  }

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
  const despesasPorSubcategoriaTab = debits.reduce<Record<string, Record<string, Transaction[]>>>((acc, t) => {
    const sub = t.subcategoria ?? getSubcategoria(t.category);
    const cat = (t.category && t.category.trim()) || "Outras despesas";
    if (!acc[sub]) acc[sub] = {};
    if (!acc[sub][cat]) acc[sub][cat] = [];
    acc[sub][cat].push(t);
    return acc;
  }, {});
  const subcategoriasDespesasOrdenadas = ordenarSubcategorias(Object.keys(despesasPorSubcategoriaTab));
  const linhasDespesasSubcategoria: { subcategoria: string; categoria: string; total: number }[] = [];
  for (const sub of subcategoriasDespesasOrdenadas) {
    const cats = Object.keys(despesasPorSubcategoriaTab[sub] ?? {}).sort((a, b) => {
      const sumA = (despesasPorSubcategoriaTab[sub][a] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const sumB = (despesasPorSubcategoriaTab[sub][b] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      return sumB - sumA;
    });
    for (const cat of cats) {
      const total = (despesasPorSubcategoriaTab[sub][cat] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      linhasDespesasSubcategoria.push({ subcategoria: sub, categoria: cat, total });
    }
  }

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
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    type CasaRow = { type: "sub"; name: string } | { type: "cat"; categoria: string; total: number };
    const HEADER_GREEN_XLS = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF93C47D" } };
    const colWidths = [
      { width: 22 }, { width: 24 }, { width: 12 }, { width: 14 }, { width: 14 },
      { width: 36 }, { width: 14 }, { width: 12 }, { width: 24 }, { width: 20 }, { width: 12 },
    ];

    function buildCasaRowsForMonth(monthTransactions: Transaction[]): CasaRow[] {
      const debitsMonth = monthTransactions.filter((t) => t.type === "debit");
      const despesasOutrasMonth = debitsMonth.filter((t) => !isProLabore(t));
      const despesasPorSub = despesasOutrasMonth.reduce<Record<string, Record<string, Transaction[]>>>((acc, t) => {
        const sub = t.subcategoria ?? getSubcategoria(t.category);
        const cat = (t.category && t.category.trim()) || "Outras despesas";
        if (!acc[sub]) acc[sub] = {};
        if (!acc[sub][cat]) acc[sub][cat] = [];
        acc[sub][cat].push(t);
        return acc;
      }, {});
      const subsOrdered = ordenarSubcategorias(Object.keys(despesasPorSub));
      const rows: CasaRow[] = [];
      for (const sub of subsOrdered) {
        const cats = Object.keys(despesasPorSub[sub] ?? {}).sort((a, b) => {
          const sumA = (despesasPorSub[sub][a] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
          const sumB = (despesasPorSub[sub][b] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
          return sumB - sumA;
        });
        rows.push({ type: "sub", name: sub });
        for (const cat of cats) {
          const total = (despesasPorSub[sub][cat] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
          rows.push({ type: "cat", categoria: cat, total });
        }
      }
      return rows;
    }

    // Lista de meses no período (from .. to) para uma aba cada: [ { year, month }, ... ]
    const monthsInRange: { year: number; month: number }[] = [];
    const [fromY, fromM] = from.split("-").map(Number);
    const [toY, toM] = to.split("-").map(Number);
    for (let y = fromY; y <= toY; y++) {
      const startM = y === fromY ? fromM : 1;
      const endM = y === toY ? toM : 12;
      for (let m = startM; m <= endM; m++) {
        monthsInRange.push({ year: y, month: m });
      }
    }

    for (const { year, month } of monthsInRange) {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const inMonth = (t: Transaction) => t.date >= monthStart && t.date <= monthEnd;
      const txMonth = transactionsForTotals.filter(inMonth);
      const receitasMonth = txMonth.filter((t) => t.type === "credit");
      const debitsMonth = txMonth.filter((t) => t.type === "debit");
      const cardMonth = txMonth.filter((t) => t.import_source === "pdf_cartao");
      const despesasOutrasMonth = debitsMonth.filter((t) => !isProLabore(t));

      const casaRowsMonth = buildCasaRowsForMonth(txMonth);
      const despesasDetalhadasMonth = [...despesasOutrasMonth]
        .map((t) => ({
          ...t,
          subcategoria: t.subcategoria ?? getSubcategoria(t.category),
          categoria: (t.category && t.category.trim()) || "Outras despesas",
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const receitasOrdenadasMonth = [...receitasMonth].sort((a, b) => a.date.localeCompare(b.date));

      // Nome da aba: MM/AA (Excel não aceita /, usamos -)
      const sheetName = `${String(month).padStart(2, "0")}-${String(year).slice(-2)}`;
      const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = colWidths;

      let row = 1;
      ws.mergeCells(row, 1, row, 3);
      ws.getCell(row, 1).value = "DESPESAS (DETALHE)";
      ws.getCell(row, 1).fill = HEADER_GREEN_XLS;
      ws.mergeCells(row, 6, row, 8);
      ws.getCell(row, 6).value = "RECEITA";
      ws.getCell(row, 6).fill = HEADER_GREEN_XLS;
      ws.mergeCells(row, 9, row, 10);
      ws.getCell(row, 9).value = "DESPESA (RESUMO)";
      ws.getCell(row, 9).fill = HEADER_GREEN_XLS;
      row++;

      ws.getCell(row, 1).value = "Subcategoria";
      ws.getCell(row, 2).value = "Descricao";
      ws.getCell(row, 3).value = "Valor";
      ws.getCell(row, 6).value = "Descricao";
      ws.getCell(row, 7).value = "Valor";
      ws.getCell(row, 8).value = "Parcela";
      for (let c = 6; c <= 8; c++) {
        ws.getCell(row, c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        ws.getCell(row, c).font = { bold: true };
      }
      for (let c = 1; c <= 3; c++) {
        ws.getCell(row, c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        ws.getCell(row, c).font = { bold: true };
      }
      row++;

      const despesasStartRow = row;
      const receitasStartRow = row;
      const maxDataRows = Math.max(despesasDetalhadasMonth.length, receitasOrdenadasMonth.length, 1);
      for (let i = 0; i < maxDataRows; i++) {
        if (i < despesasDetalhadasMonth.length) {
          const t = despesasDetalhadasMonth[i];
          ws.getCell(row, 1).value = t.subcategoria;
          ws.getCell(row, 2).value = t.description;
          ws.getCell(row, 3).value = Math.abs(Number(t.amount));
          ws.getCell(row, 3).numFmt = '"R$"#,##0.00';
        }
        if (i < receitasOrdenadasMonth.length) {
          const t = receitasOrdenadasMonth[i];
          ws.getCell(row, 6).value = t.description;
          ws.getCell(row, 7).value = Number(t.amount);
          ws.getCell(row, 7).numFmt = '"R$"#,##0.00';
          ws.getCell(row, 8).value =
            t.parcela_numero != null && t.parcela_total != null
              ? `${t.parcela_numero}/${t.parcela_total}`
              : "";
        }
        row++;
      }
      const despesasEndRow = Math.max(despesasStartRow, row - 1);
      const receitasEndRow = Math.max(receitasStartRow, row - 1);

      ws.getCell(row, 6).value = "TOTAL";
      ws.getCell(row, 6).fill = HEADER_GREEN_XLS;
      ws.getCell(row, 7).value = receitasOrdenadasMonth.length
        ? { formula: `SUM(G${receitasStartRow}:G${receitasEndRow})` }
        : 0;
      ws.getCell(row, 7).numFmt = '"R$"#,##0.00';
      ws.getCell(row, 9).value = "TOTAL";
      ws.getCell(row, 9).fill = HEADER_GREEN_XLS;
      ws.getCell(row, 10).value = despesasDetalhadasMonth.length
        ? { formula: `SUM(C${despesasStartRow}:C${despesasEndRow})` }
        : 0;
      ws.getCell(row, 10).numFmt = '"R$"#,##0.00';
      row++;

      ws.getCell(row, 9).value = "RESULTADO";
      ws.getCell(row, 9).fill = HEADER_GREEN_XLS;
      ws.getCell(row, 10).value = { formula: `G${row - 1}-J${row - 1}` };
      ws.getCell(row, 10).numFmt = '"R$"#,##0.00';

      row += 2;
      ws.mergeCells(row, 9, row, 10);
      ws.getCell(row, 9).value = "DESPESAS POR SUBCATEGORIA/CATEGORIA";
      ws.getCell(row, 9).fill = HEADER_GREEN_XLS;
      row++;
      ws.getCell(row, 9).value = "Categoria";
      ws.getCell(row, 10).value = "Valor";
      row++;

      for (const item of casaRowsMonth) {
        if (item.type === "sub") {
          ws.mergeCells(row, 9, row, 10);
          ws.getCell(row, 9).value = item.name;
          ws.getCell(row, 9).fill = HEADER_GREEN_XLS;
        } else {
          ws.getCell(row, 9).value = item.categoria;
          if (despesasDetalhadasMonth.length > 0) {
            const catEsc = item.categoria.replace(/"/g, '""');
            ws.getCell(row, 10).value = {
              formula: `SUMIF(B${despesasStartRow}:B${despesasEndRow},"${catEsc}",C${despesasStartRow}:C${despesasEndRow})`,
            };
          } else {
            ws.getCell(row, 10).value = 0;
          }
          ws.getCell(row, 10).numFmt = '"R$"#,##0.00';
        }
        row++;
      }

      // Lançamentos de fatura de cartão no mesmo mês (sem aba separada)
      if (cardMonth.length > 0) {
        row += 2;
        ws.getCell(row, 1).value = "LANCAMENTOS CARTAO (PDF)";
        ws.getCell(row, 1).fill = HEADER_GREEN_XLS;
        row++;
        ws.getCell(row, 1).value = "Data";
        ws.getCell(row, 2).value = "Descricao";
        ws.getCell(row, 3).value = "Tipo linha";
        ws.getCell(row, 4).value = "Valor";
        ws.getCell(row, 5).value = "CreditoDebito";
        ws.getCell(row, 6).value = "Cartao";
        ws.getCell(row, 7).value = "Parcela";
        for (let c = 1; c <= 7; c++) {
          ws.getCell(row, c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
          };
          ws.getCell(row, c).font = { bold: true };
        }
        row++;

        const sortedCard = [...cardMonth].sort((a, b) => {
          const ao = a.import_order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.import_order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return a.date.localeCompare(b.date);
        });

        for (const t of sortedCard) {
          const kind =
            t.card_line_kind === "compra"
              ? "Compra"
              : t.card_line_kind === "resumo"
                ? "Resumo/total"
                : t.card_line_kind === "pagamento"
                  ? "Pagamento"
                  : t.card_line_kind === "encargo"
                    ? "Encargo/taxa"
                    : t.card_line_kind === "outro"
                      ? "Outro"
                      : "";
          ws.getCell(row, 1).value = t.date;
          ws.getCell(row, 2).value = t.description;
          ws.getCell(row, 3).value = kind;
          ws.getCell(row, 4).value = Number(t.amount);
          ws.getCell(row, 4).numFmt = '"R$"#,##0.00';
          ws.getCell(row, 5).value = t.type === "credit" ? "Credito" : "Debito";
          ws.getCell(row, 6).value = "Sim";
          ws.getCell(row, 7).value =
            t.parcela_numero != null && t.parcela_total != null
              ? `${t.parcela_numero}/${t.parcela_total}`
              : "";
          row++;
        }
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planilha_${from}_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Planilhas
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Extrato organizado por categorias para o período selecionado. Use as categorias nas transações para agrupar aqui.
      </p>

      {/* Barra de período e filtro por conta */}
      <div className="sticky top-14 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-4 overflow-visible bg-zinc-100 px-4 py-3 dark:bg-zinc-950 md:static md:z-auto md:mx-0 md:bg-transparent md:py-0 md:dark:bg-transparent">
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          aria-label="Conta"
        >
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <label className="flex max-w-sm cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={excludeCardResumoFromTotals}
            onChange={(e) => setExcludeCardResumoFromTotals(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span>
            Excluir linhas <strong>Resumo</strong> do cartão (tipo &quot;Resumo / total&quot;, ex.: limite) dos totais acima — se existirem, continuam na tabela abaixo
          </span>
        </label>
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
          <div className="flex flex-wrap items-center gap-2 overflow-visible">
            <select
              value={mes}
              onChange={(e) => updatePeriodMonth(ano, parseInt(e.target.value, 10))}
              className="min-w-[7rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              aria-label="Mês"
            >
              {MONTHS.map((label, i) => (
                <option key={i} value={i + 1}>{label}</option>
              ))}
            </select>
            <select
              value={ano}
              onChange={(e) => updatePeriodMonth(parseInt(e.target.value, 10), mes)}
              className="min-w-[5rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              aria-label="Ano"
            >
              {anosDisponiveis.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 overflow-visible">
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
          </div>
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
            Baixar .xlsx
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
                        {hasParcelaAlguma(receitas) && (
                          <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Parcela</th>
                        )}
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
                            {hasParcelaAlguma(receitas) && (
                              <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                                {t.parcela_numero != null && t.parcela_total != null ? `${t.parcela_numero}/${t.parcela_total}` : "—"}
                              </td>
                            )}
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
                      {hasParcelaAlguma(prolabore) && (
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Parcela</th>
                      )}
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
                          {hasParcelaAlguma(prolabore) && (
                            <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                              {t.parcela_numero != null && t.parcela_total != null ? `${t.parcela_numero}/${t.parcela_total}` : "—"}
                            </td>
                          )}
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

          {/* 3. Despesas Operacionais por subcategoria e categoria */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              3️⃣ Despesas operacionais
            </h2>
            {subcategoriasOrdenadas.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma despesa categorizada no período (exceto pró-labore).</p>
            ) : (
              <div className="mt-4 space-y-8">
                {subcategoriasOrdenadas.map((sub) => {
                  const catsNaSub = Object.keys(despesasPorSubcategoria[sub] ?? {}).sort((a, b) => {
                    const sumA = (despesasPorSubcategoria[sub][a] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
                    const sumB = (despesasPorSubcategoria[sub][b] ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
                    return sumB - sumA;
                  });
                  return (
                    <div key={sub}>
                      <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{sub}</h3>
                      <div className="mt-3 space-y-4">
                {catsNaSub.map((cat) => {
                  const itens = despesasPorSubcategoria[sub][cat] ?? [];
                  const totalCat = itens.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
                  const showParcela = hasParcelaAlguma(itens);
                  return (
                    <div key={cat}>
                      <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{cat}</h4>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[320px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-700">
                              <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-500">Data</th>
                              <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-500">Descrição</th>
                              {showParcela && (
                                <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-500">Parcela</th>
                              )}
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
                                  {showParcela && (
                                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                                      {t.parcela_numero != null && t.parcela_total != null ? `${t.parcela_numero}/${t.parcela_total}` : "—"}
                                    </td>
                                  )}
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Detalhe fatura cartão (importação PDF) */}
          {cardFaturaLines.length > 0 && (
            <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-6 dark:border-violet-900/50 dark:bg-violet-950/30">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                💳 Fatura do cartão (PDF) — lançamentos importados
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Compras, pagamentos e encargos. Saldo anterior, subtotal e total da fatura (BB) <strong>não</strong> são importados para não duplicar totais.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-violet-200 dark:border-violet-800">
                      <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Data</th>
                      <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Descrição</th>
                      <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Tipo linha</th>
                      <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cardFaturaLines]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((t) => (
                        <tr key={t.id} className="border-b border-violet-100 dark:border-violet-900/40">
                          <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{formatDateShort(t.date)}</td>
                          <td className="py-2 pr-4 text-zinc-800 dark:text-zinc-200">{t.description}</td>
                          <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                            {t.card_line_kind === "compra" && "Compra"}
                            {t.card_line_kind === "resumo" && "Resumo / total"}
                            {t.card_line_kind === "pagamento" && "Pagamento"}
                            {t.card_line_kind === "encargo" && "Encargo / taxa"}
                            {t.card_line_kind === "outro" && "Outro"}
                            {!t.card_line_kind && "—"}
                          </td>
                          <td
                            className={`py-2 text-right font-medium tabular-nums ${
                              t.type === "credit"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCurrency(Number(t.amount))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

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
              Gastos por subcategoria e categoria (% do total de despesas)
            </h2>
            {linhasDespesasSubcategoria.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma despesa no período.</p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Subcategoria</th>
                        <th className="pb-2 pr-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Categoria</th>
                        <th className="pb-2 pr-4 text-right font-medium text-zinc-600 dark:text-zinc-400">Valor</th>
                        <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasDespesasSubcategoria.map(({ subcategoria, categoria, total: totalCat }) => {
                        const pct = totalDespesas > 0 ? (totalCat / totalDespesas) * 100 : 0;
                        return (
                          <tr key={`${subcategoria}-${categoria}`} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{subcategoria}</td>
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{categoria}</td>
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
