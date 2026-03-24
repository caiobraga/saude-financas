/**
 * Gráficos e blocos por conta / categoria na visão geral (SVG, sem libs).
 */

const COLORS = {
  pie: [
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#64748b",
  ],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export type AccountOverviewRow = {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit";
  balance: number;
  receitasMes: number;
  despesasMes: number;
};

export type CategorySlice = { name: string; value: number };

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, startAngle);
  const p2 = polar(cx, cy, rOuter, endAngle);
  const p3 = polar(cx, cy, rInner, endAngle);
  const p4 = polar(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function CategoryDonut({ slices, periodLabel }: { slices: CategorySlice[]; periodLabel: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Nenhuma despesa com categoria no período ({periodLabel}).
      </p>
    );
  }
  const cx = 120;
  const cy = 120;
  const rO = 100;
  const rI = 58;
  let angle = 0;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <svg viewBox="0 0 240 240" className="mx-auto h-56 w-56 shrink-0" aria-hidden>
        {slices.map((sl, i) => {
          if (sl.value <= 0) return null;
          const sweep = (sl.value / total) * 360;
          const start = angle;
          const end = angle + sweep;
          angle = end;
          const fill = COLORS.pie[i % COLORS.pie.length];
          return <path key={sl.name + i} d={donutSlicePath(cx, cy, rO, rI, start, end)} fill={fill} stroke="white" strokeWidth="1" className="dark:stroke-zinc-900" />;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {slices.map((sl, i) => {
          const pct = total > 0 ? Math.round((sl.value / total) * 100) : 0;
          if (sl.value <= 0) return null;
          const fill = COLORS.pie[i % COLORS.pie.length];
          return (
            <li key={sl.name} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: fill }} />
                <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">{sl.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                {formatCurrency(sl.value)}{" "}
                <span className="text-zinc-400">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HorizontalBarsByAccount({ rows, maxValue }: { rows: AccountOverviewRow[]; maxValue: number }) {
  if (rows.length === 0 || maxValue <= 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Sem movimentação no período.</p>;
  }
  return (
    <div className="space-y-4">
      {rows.map((a) => {
        const wRec = maxValue > 0 ? Math.min(100, (a.receitasMes / maxValue) * 100) : 0;
        const wDes = maxValue > 0 ? Math.min(100, (a.despesasMes / maxValue) * 100) : 0;
        const typeLabel = a.type === "credit" ? "Cartão" : a.type === "savings" ? "Poupança" : "Corrente";
        return (
          <div key={a.id}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-1">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{a.name}</span>
              <span className="text-xs text-zinc-500">{typeLabel}</span>
            </div>
            <div className="space-y-1.5">
              <div>
                <div className="mb-0.5 flex justify-between text-xs text-zinc-500">
                  <span>Receitas</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(a.receitasMes)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${wRec}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-0.5 flex justify-between text-xs text-zinc-500">
                  <span>Despesas</span>
                  <span className="tabular-nums text-red-600 dark:text-red-400">{formatCurrency(a.despesasMes)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${wDes}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccountGroup({
  title,
  subtitle,
  accounts,
}: {
  title: string;
  subtitle: string;
  accounts: AccountOverviewRow[];
}) {
  if (accounts.length === 0) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      <ul className="mt-4 space-y-3">
        {accounts.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/30"
          >
            <p className="font-medium text-zinc-900 dark:text-white">{a.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:text-sm">
              <div>
                <dt className="text-zinc-500">Saldo</dt>
                <dd className="tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(a.balance)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Receitas (mês)</dt>
                <dd className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(a.receitasMes)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Despesas (período)</dt>
                <dd className="tabular-nums font-medium text-red-600 dark:text-red-400">{formatCurrency(a.despesasMes)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Resultado</dt>
                <dd
                  className={`tabular-nums font-medium ${a.receitasMes - a.despesasMes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {formatCurrency(a.receitasMes - a.despesasMes)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardOverviewVisual({
  periodLabel,
  bankAccounts,
  creditAccounts,
  categorySlices,
}: {
  periodLabel: string;
  bankAccounts: AccountOverviewRow[];
  creditAccounts: AccountOverviewRow[];
  categorySlices: CategorySlice[];
}) {
  const allForBars = [...bankAccounts, ...creditAccounts];
  const maxMov = Math.max(
    1,
    ...allForBars.map((a) => Math.max(a.receitasMes, a.despesasMes))
  );

  if (allForBars.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        Conecte uma instituição ou importe um extrato para ver gráficos e detalhes por conta.
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Contas</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Saldo atual e movimentação em <strong>{periodLabel}</strong>, separado por tipo.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AccountGroup
            title="Conta corrente e poupança"
            subtitle="Movimentação do mês (receitas e despesas)."
            accounts={bankAccounts}
          />
          <AccountGroup
            title="Cartões de crédito"
            subtitle="Faturas e compras registradas no período."
            accounts={creditAccounts}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Movimentação por conta</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Barras proporcionais ao maior valor entre receitas e despesas no período ({periodLabel}).
        </p>
        <div className="mt-6">
          <HorizontalBarsByAccount rows={allForBars} maxValue={maxMov} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Despesas por categoria</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Distribuição das despesas no período com categoria informada ({periodLabel}).
        </p>
        <div className="mt-6">
          <CategoryDonut slices={categorySlices} periodLabel={periodLabel} />
        </div>
      </section>
    </div>
  );
}
