/**
 * Pós-processamento de texto de fatura de cartão:
 * - Fatura BB Ourocard: parser dedicado (tabela "Data Descrição País Valor").
 * - Demais: reutiliza o parser de extrato + classificação.
 */
import {
  parseExtratoTextoComFallback,
  extrairParcelaDaDescricao,
  type TransacaoExtrato,
} from "./extrato-pdf";
import { parseGenericFaturaTexto } from "./fatura-cartao-generic";

export type CardLineKind = "compra" | "resumo" | "pagamento" | "encargo" | "outro";

export interface TransacaoFaturaCartao extends TransacaoExtrato {
  cardLineKind: CardLineKind;
}

/**
 * Classifica descrição típica de fatura brasileira (BB, Itaú, etc.).
 */
export function classifyCardLineKind(description: string): CardLineKind {
  const d = description
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (
    /\b(iof|juros|multa|anuidade|tarifa|encargo|seguro\s*prestamista|cet\b|taxa\b)/.test(d)
  ) {
    return "encargo";
  }
  if (
    /\b(pgto|pagamento\s+recebido|pagamento\s+efetuado|debito\s+automatico|debito\s+em\s+conta|pagamento\s+minimo|pagamento\s+total|debito\s+agendado)\b/.test(
      d
    ) ||
    /^\s*pagamento\b/.test(d)
  ) {
    return "pagamento";
  }
  if (
    /\b(resumo\s+da\s+fatura|total\s+da\s+fatura|subtotal|totais\s+da\s+fatura|limite\s+de\s+credito|credito\s+disponivel|saldo\s+fatura\s+anterior|saldo\s+anterior|saldo\s+atual|saldo\s+rotativo|rotativo|melhor\s+dia|vencimento|fechamento|proxima\s+fatura|valor\s+total)\b/.test(
      d
    ) ||
    /\b(total\s+a\s+pagar|total\s+apagar)\b/.test(d) ||
    /^\s*saldo\b/.test(d)
  ) {
    return "resumo";
  }
  if (
    /\b(saque|saque\s+a\s+credito|saque\s+no\s+exterior|antecipacao|antecipacao\s+de\s+parcelas)\b/.test(
      d
    )
  ) {
    return "outro";
  }
  return "compra";
}

function parseBbMoneyToken(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "");
  const neg = t.startsWith("-");
  const cleaned = t.replace(/^-/, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

/** Data de fechamento da fatura BB (ciclo de compras). */
function extractBbFaturaFechamento(texto: string): { y: number; m: number; d: number } | null {
  const m = texto.match(/Fatura\s+fechada\s+em\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!m) return null;
  return { d: parseInt(m[1], 10), m: parseInt(m[2], 10), y: parseInt(m[3], 10) };
}

/**
 * Ano civil do lançamento dado o fechamento da fatura (BB).
 * - Mês > mês do fechamento → ano anterior (ex.: dez na fatura que fecha em jan).
 * - Mesmo mês e dia > dia do fechamento → mesmo ano (parcelas / lançamentos com data após o fechamento na mesma fatura).
 */
function inferBbTransactionYear(
  day: number,
  month: number,
  close: { y: number; m: number; d: number }
): number {
  if (month > close.m) return close.y - 1;
  if (month < close.m) return close.y;
  if (day <= close.d) return close.y;
  return close.y;
}

function toIso(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Valor em R$ no PDF BR: milhar com ponto, decimais com vírgula e 2 casas (ex.: -1.442,48). */
const RE_BB_MONEY = String.raw`(-?\d[\d.]*,\d{2})`;
const RE_BB_MONEY_IN_LINE = new RegExp(String.raw`R\$\s*(${RE_BB_MONEY})\b`, "gi");

const RE_BB_TABLE_HEADER = /Data\s+Descrição\s+(?:País\s+)?Valor/i;

/**
 * Linhas só de conferência na fatura BB — não importar como transação.
 */
export function isLinhaResumoFaturaCartaoIgnorada(description: string): boolean {
  const t = description.replace(/\s+/g, " ").trim();
  if (/^SALDO\s+FATURA\s+ANTERIOR\b/i.test(t)) return true;
  if (/^Subtotal\b/i.test(t)) return true;
  if (/^Total\s+da\s+Fatura\b/i.test(t)) return true;
  return false;
}

/** unpdf costuma juntar o bloco "Lançamentos" em poucas linhas; quebra antes de cada novo dd/mm ou linha de resumo. */
export function normalizeBbOurocardLancamentosText(texto: string): string {
  const m = texto.match(RE_BB_TABLE_HEADER);
  if (!m || m.index == null) return texto;
  const start = m.index + m[0].length;
  const tail = texto.slice(start);
  const endRel = tail.search(/\bFale conosco\b/i);
  const block = endRel >= 0 ? tail.slice(0, endRel) : tail;
  const rest = endRel >= 0 ? tail.slice(endRel) : "";

  const splitBeforeNewDatedTxn = (s: string): string =>
    s.replace(/(\s)(?=\d{1,2}\/\d{1,2}\s+(?=[A-Z0-9*]))/g, (sp, _g, offset, str) => {
      const before = str.slice(Math.max(0, offset - 14), offset);
      // Não partir "PARC 12/12" nem "PARCELA 3/10" (parcelas usam o mesmo padrão dd/mm)
      if (/\bPARC(?:ELA)?\s*$/i.test(before)) return sp;
      return "\n";
    });

  let b = block
    .replace(/\s+(?=SALDO\s+FATURA\s+ANTERIOR\b)/gi, "\n")
    .replace(/\s+(?=Subtotal\s+R\$)/gi, "\n")
    .replace(/\s+(?=Total\s+da\s+Fatura\s+R\$)/gi, "\n");
  b = splitBeforeNewDatedTxn(b);

  return texto.slice(0, start) + b + rest;
}

/** Remove rótulos de seção BB que ficaram colados no início da linha. */
function stripBbSectionPrefix(line: string): string {
  return line
    .replace(
      /^(?:Serviços|Servicos|Transporte|Lazer|Pagamentos\/Créditos|Outros\s+lançamentos|Outros\s+lancamentos|Compras\s+parceladas)\s+/i,
      ""
    )
    .trim();
}

/**
 * Linha que começa com dd/mm: primeira ocorrência de R$ com formato BR (…,XX) é o valor do lançamento.
 * O restante (*** dólar, cotação com 4 decimais, etc.) entra só na descrição.
 */
function parseBbDatedLine(line: string): {
  d: number;
  mo: number;
  desc: string;
  signed: number;
} | null {
  const trimmed = stripBbSectionPrefix(line);
  const head = trimmed.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
  if (!head) return null;
  const body = head[3];
  RE_BB_MONEY_IN_LINE.lastIndex = 0;
  const money = RE_BB_MONEY_IN_LINE.exec(body);
  if (!money) return null;
  const signed = parseBbMoneyToken(money[1]);
  if (signed == null) return null;
  const descPart = body.slice(0, money.index).trim();
  const after = body.slice(money.index + money[0].length).trim();
  let extra = "";
  if (after) {
    if (/^\d{1,2}\/\d{1,2}\s+[A-Z0-9*]/.test(after)) return null;
    if (
      /^\*\*\*/.test(after) ||
      /^Cotação\b/i.test(after) ||
      /\bDOLAR\s+AMERICANO\b/i.test(after)
    ) {
      extra = ` ${after}`;
    }
  }
  const desc = `${descPart}${extra}`.replace(/\s+/g, " ").trim();
  return {
    d: parseInt(head[1], 10),
    mo: parseInt(head[2], 10),
    desc,
    signed,
  };
}

const BB_SKIP_LINES = new Set(
  [
    "Data Descrição País Valor",
    "Pagamentos/Créditos",
    "Lazer",
    "Serviços",
    "Servicos",
    "Transporte",
    "Outros lançamentos",
    "Compras parceladas",
  ].map((s) => s.toLowerCase())
);

function isBbOurocardFaturaText(texto: string): boolean {
  return (
    /Lançamentos nesta fatura/i.test(texto) &&
    (/OUROCARD|Ourocard|ourocard/i.test(texto) || /Resumo da fatura/i.test(texto))
  );
}

/**
 * Parser para fatura de cartão Banco do Brasil / Ourocard (layout PDF típico).
 */
export function parseBbOurocardFaturaTexto(texto: string): TransacaoFaturaCartao[] {
  const close = extractBbFaturaFechamento(texto);
  if (!close) return [];

  const normalized = normalizeBbOurocardLancamentosText(texto);
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const headerIdx = lines.findIndex((l) => RE_BB_TABLE_HEADER.test(l));
  if (headerIdx < 0) return [];

  const out: TransacaoFaturaCartao[] = [];
  let last: TransacaoFaturaCartao | null = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const low = line.toLowerCase();

    if (/^página\s+\d+\/\d+/i.test(line) || /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line))
      continue;
    if (/^fale conosco$/i.test(line)) break;

    if (BB_SKIP_LINES.has(low)) continue;
    if (/^\([^)]+\)\s*$/i.test(line)) continue;
    if (/^Luciana\s+/i.test(line) && /\(Cartão\s+\d+\)/i.test(line)) continue;

    const dated = parseBbDatedLine(line);
    if (dated) {
      const y = inferBbTransactionYear(dated.d, dated.mo, close);
      const date = toIso(dated.d, dated.mo, y);
      const signed = dated.signed;
      const desc = dated.desc;
      const row: TransacaoFaturaCartao = {
        date,
        description: desc.slice(0, 500),
        amount: 0,
        type: "debit",
        category: null,
        cardLineKind: "compra",
      };
      row.type = signed < 0 ? "credit" : "debit";
      row.amount = row.type === "credit" ? Math.abs(signed) : -Math.abs(signed);
      const parcela = extrairParcelaDaDescricao(desc);
      if (parcela) {
        row.parcela_numero = parcela.numero;
        row.parcela_total = parcela.total;
      }
      row.cardLineKind = classifyCardLineKind(desc);
      out.push(row);
      last = out[out.length - 1];
      continue;
    }

    if (
      last &&
      (/^\*\*\*/.test(line) ||
        /^Cotação do Dólar/i.test(line) ||
        /^Parcelamento em até/i.test(line) ||
        /^Número mínimo/i.test(line))
    ) {
      last.description = `${last.description} ${line}`.replace(/\s+/g, " ").trim().slice(0, 500);
      last.cardLineKind = classifyCardLineKind(last.description);
    }
  }

  const seen = new Set<string>();
  return out.filter((t) => {
    const k = `${t.date}|${t.description.slice(0, 80)}|${t.amount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseFaturaCartaoTexto(texto: string): TransacaoFaturaCartao[] {
  let rows: TransacaoFaturaCartao[];
  if (isBbOurocardFaturaText(texto)) {
    const bb = parseBbOurocardFaturaTexto(texto);
    if (bb.length > 0) rows = bb;
    else {
      const generic = parseGenericFaturaTexto(texto);
      if (generic.length > 0) {
        rows = generic.map((t) => ({
          ...t,
          category: null,
          cardLineKind: classifyCardLineKind(t.description),
        }));
      } else {
        const base = parseExtratoTextoComFallback(texto).filter((t) => t.date.length === 10);
        rows = base.map((t) => ({
          ...t,
          cardLineKind: classifyCardLineKind(t.description),
        }));
      }
    }
  } else {
    const generic = parseGenericFaturaTexto(texto);
    if (generic.length > 0) {
      rows = generic.map((t) => ({
        ...t,
        category: null,
        cardLineKind: classifyCardLineKind(t.description),
      }));
    } else {
      const base = parseExtratoTextoComFallback(texto).filter((t) => t.date.length === 10);
      rows = base.map((t) => ({
        ...t,
        cardLineKind: classifyCardLineKind(t.description),
      }));
    }
  }
  return rows.filter((t) => !isLinhaResumoFaturaCartaoIgnorada(t.description));
}

export function transacoesFaturaParaCSV(rows: TransacaoFaturaCartao[]): string {
  const escape = (s: string) => {
    const x = String(s).replace(/"/g, '""');
    return x.includes(",") || x.includes("\n") || x.includes('"') ? `"${x}"` : x;
  };
  const header = "Data,Descrição,Valor,Tipo,Tipo linha fatura,Categoria,Parcela";
  const kindLabel: Record<CardLineKind, string> = {
    compra: "Compra",
    resumo: "Resumo / total",
    pagamento: "Pagamento",
    encargo: "Encargo / taxa",
    outro: "Outro",
  };
  const lines = rows.map((t) => {
    const parcela =
      t.parcela_numero != null && t.parcela_total != null
        ? `${t.parcela_numero}/${t.parcela_total}`
        : "";
    return [
      t.date,
      escape(t.description),
      t.amount.toFixed(2).replace(".", ","),
      t.type === "credit" ? "Crédito" : "Débito",
      kindLabel[t.cardLineKind],
      escape(t.category ?? ""),
      parcela,
    ].join(",");
  });
  return [header, ...lines].join("\n");
}
