interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "positive" | "negative";
}

export function SummaryCard({ title, value, subtitle, variant = "default" }: SummaryCardProps) {
  const colorClass =
    variant === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${colorClass}`}>{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}
