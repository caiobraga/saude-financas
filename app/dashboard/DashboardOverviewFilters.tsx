"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  /** Ano do período civil atualmente aplicado (quando `isCustomRange` é false) */
  selectedYear: number;
  isCustomRange: boolean;
  dateFrom: string;
  dateTo: string;
  periodLabel: string;
};

export function DashboardOverviewFilters({
  selectedYear,
  isCustomRange,
  dateFrom,
  dateTo,
  periodLabel,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [customDe, setCustomDe] = useState(dateFrom);
  const [customAte, setCustomAte] = useState(dateTo);

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    const list: number[] = [];
    for (let y = cy + 1; y >= cy - 12; y--) list.push(y);
    return list;
  }, []);

  const go = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Ano civil</span>
            <select
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              value={isCustomRange ? "" : String(selectedYear)}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                go(`${pathname}?ano=${encodeURIComponent(v)}`);
              }}
            >
              {isCustomRange && (
                <option value="" disabled>
                  Intervalo personalizado
                </option>
              )}
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Período: <strong className="text-zinc-900 dark:text-white">{periodLabel}</strong>
            {isCustomRange && (
              <span className="ml-2 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                intervalo
              </span>
            )}
          </p>
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const de = customDe.trim();
            const ate = customAte.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) return;
            const q = new URLSearchParams();
            q.set("de", de);
            q.set("ate", ate);
            go(`${pathname}?${q.toString()}`);
          }}
        >
          <span className="mb-1 block w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:mb-0 sm:mr-2 sm:w-auto sm:self-center">
            Intervalo
          </span>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            De
            <input
              type="date"
              value={customDe}
              disabled={pending}
              onChange={(e) => setCustomDe(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Até
            <input
              type="date"
              value={customAte}
              disabled={pending}
              onChange={(e) => setCustomAte(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            Aplicar
          </button>
        </form>
      </div>
      {pending && <p className="mt-2 text-xs text-zinc-500">Atualizando…</p>}
    </div>
  );
}
