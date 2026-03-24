/**
 * Período da visão geral: ano civil (query `ano`) ou intervalo (`de` + `ate`, YYYY-MM-DD).
 */

export type DashboardPeriod = {
  dateFrom: string;
  dateTo: string;
  /** Texto curto para UI (ex.: "2025" ou "01/03/2025 a 15/06/2025") */
  label: string;
  /** true quando é 1º jan–31 dez do mesmo ano */
  isFullYear: boolean;
  year: number;
  /** Veio de `?de=&ate=` na URL (não só `?ano=`) */
  fromCustomRange: boolean;
};

function pickStr(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function isoDateOk(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * @param searchParams — use `await searchParams` no App Router quando for Promise
 */
export function resolveDashboardPeriod(
  searchParams: Record<string, string | string[] | undefined>,
  now = new Date()
): DashboardPeriod {
  const cy = now.getFullYear();
  const rawDe = pickStr(searchParams.de).trim();
  const rawAte = pickStr(searchParams.ate).trim();

  if (isoDateOk(rawDe) && isoDateOk(rawAte) && rawDe <= rawAte) {
    const y0 = parseInt(rawDe.slice(0, 4), 10);
    return {
      dateFrom: rawDe,
      dateTo: rawAte,
      label: `${formatBr(rawDe)} a ${formatBr(rawAte)}`,
      isFullYear: rawDe.endsWith("-01-01") && rawAte.endsWith("-12-31") && rawDe.slice(0, 4) === rawAte.slice(0, 4),
      year: Number.isFinite(y0) ? y0 : cy,
      fromCustomRange: true,
    };
  }

  let y = cy;
  const rawAno = pickStr(searchParams.ano).trim();
  if (rawAno) {
    const n = parseInt(rawAno, 10);
    if (!Number.isNaN(n) && n >= 2000 && n <= cy + 1) y = n;
  }

  const dateFrom = `${y}-01-01`;
  const dateTo = `${y}-12-31`;
  return {
    dateFrom,
    dateTo,
    label: String(y),
    isFullYear: true,
    year: y,
    fromCustomRange: false,
  };
}

export function transactionInPeriod(date: string, dateFrom: string, dateTo: string): boolean {
  return date >= dateFrom && date <= dateTo;
}
