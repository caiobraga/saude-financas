"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/transacoes", label: "Transações" },
  { href: "/dashboard/contas", label: "Contas" },
  { href: "/dashboard/conectar", label: "Conectar banco" },
  { href: "/dashboard/planos", label: "Planos" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="p-5">
        <Link href="/dashboard" className="block">
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
            Saúde Finanças
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-6">
        {nav.map(({ href, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 px-3 py-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
