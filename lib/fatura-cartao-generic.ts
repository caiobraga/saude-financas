import { extrairParcelaDaDescricao } from "./extrato-pdf";

export interface GenericFaturaRow {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // crédito positivo, débito negativo
  type: "credit" | "debit";
  parcela_numero?: number | null;
  parcela_total?: number | null;
}

type RefDate = { y: number; m: number; d: number } | null;

const RE_DATE_PREFIX = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s+(.+)$/;
const RE_DATE_ANY = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/g;
const RE_MONEY_ANY = /(?:R\$\s*)?(-?\d[\d.]*,\d{2})(?!\d)/gi;

const SUMMARY_LINE_PATTERNS = [
  /^saldo\s+fatura\s+anterior\b/i,
  /^subtotal\b/i,
  /^total\s+da\s+fatura\b/i,
  /^resumo\s+da\s+fatura\b/i,
  /^total\s+a\s+pagar\b/i,
  /^valor\s+total\b/i,
  /^vencimento\b/i,
  /^limite\b/i,
  /^credito\s+disponivel\b/i,
  /^encargos?\s+totais?\b/i,
];

const GENERIC_SKIP_EXACT = new Set(
  [
    "Data Descrição País Valor",
    "Data Descrição Valor",
    "Lançamentos nesta fatura",
    "Pagamentos/Créditos",
    "Compras parceladas",
    "Outros lançamentos",
    "Serviços",
    "Servicos",
    "Lazer",
    "Transporte",
  ].map((s) => s.toLowerCase())
);

function parseMoneyBr(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "");
  const neg = t.startsWith("-");
  const n = parseFloat(t.replace(/^-/, "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

function normalizeGenericFaturaText(texto: string): string {
  const splitBeforeTxn = (s: string): string =>
    s.replace(/(\s)(?=\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?=[A-Z0-9*]))/g, (sp, _g, off, full) => {
      const before = full.slice(Math.max(0, off - 14), off);
      if (/\bPARC(?:ELA)?\s*$/i.test(before)) return sp;
      return "\n";
    });
  return splitBeforeTxn(texto).replace(/\s+(?=Subtotal\b|Total\s+da\s+Fatura\b|SALDO\s+FATURA)/gi, "\n");
}

function extractReferenceDate(texto: string): RefDate {
  const fechamento = texto.match(/Fatura\s+fechada\s+em\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (fechamento) return { d: parseInt(fechamento[1], 10), m: parseInt(fechamento[2], 10), y: parseInt(fechamento[3], 10) };
  const venc = texto.match(/Vencimento(?:\s+em)?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (venc) return { d: parseInt(venc[1], 10), m: parseInt(venc[2], 10), y: parseInt(venc[3], 10) };
  const any = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (any) return { d: parseInt(any[1], 10), m: parseInt(any[2], 10), y: parseInt(any[3], 10) };
  return null;
}

function inferYear(day: number, month: number, ref: RefDate): number {
  if (!ref) return new Date().getFullYear();
  if (month > ref.m) return ref.y - 1;
  if (month < ref.m) return ref.y;
  return ref.y;
}

function shouldSkipLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (GENERIC_SKIP_EXACT.has(t.toLowerCase())) return true;
  if (/^página\s+\d+\/\d+/i.test(t) || /^--\s*\d+\s+of\s+\d+\s*--$/i.test(t)) return true;
  if (/^\([^)]+\)\s*$/.test(t)) return true;
  return SUMMARY_LINE_PATTERNS.some((p) => p.test(t));
}

function parseGenericDatedLine(line: string): { d: number; m: number; y?: number; desc: string; signed: number } | null {
  const m = line.match(RE_DATE_PREFIX);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3].length === 2 ? `20${m[3]}` : m[3], 10) : undefined;
  const body = m[4];

  RE_MONEY_ANY.lastIndex = 0;
  const money = RE_MONEY_ANY.exec(body);
  if (!money) return null;
  const signed = parseMoneyBr(money[1]);
  if (signed == null) return null;
  const desc = body.slice(0, money.index).replace(/\s+/g, " ").trim();
  if (!desc) return null;
  return { d: day, m: month, y: year, desc, signed };
}

/**
 * Parser genérico de fatura de cartão:
 * - focado em linhas com data + descrição + valor BR
 * - sem regras específicas de banco
 */
export function parseGenericFaturaTexto(texto: string): GenericFaturaRow[] {
  const normalized = normalizeGenericFaturaText(texto);
  const ref = extractReferenceDate(normalized);
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const out: GenericFaturaRow[] = [];
  for (const line of lines) {
    if (shouldSkipLine(line)) continue;
    const parsed = parseGenericDatedLine(line);
    if (!parsed) continue;
    const y = parsed.y ?? inferYear(parsed.d, parsed.m, ref);
    const date = `${y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    const type: "credit" | "debit" = parsed.signed < 0 ? "credit" : "debit";
    const amount = type === "credit" ? Math.abs(parsed.signed) : -Math.abs(parsed.signed);
    const parcela = extrairParcelaDaDescricao(parsed.desc);
    out.push({
      date,
      description: parsed.desc.slice(0, 500),
      amount,
      type,
      ...(parcela ? { parcela_numero: parcela.numero, parcela_total: parcela.total } : {}),
    });
  }

  const seen = new Set<string>();
  return out.filter((t) => {
    const k = `${t.date}|${t.description.slice(0, 120)}|${t.amount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

