"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/transacoes", label: "Transações" },
  { href: "/dashboard/planilhas", label: "Planilhas" },
  { href: "/dashboard/contas", label: "Contas" },
  { href: "/dashboard/importar-extrato", label: "Importar extrato PDF" },
  { href: "/dashboard/perfil", label: "Perfil" },
  { href: "/dashboard/planos", label: "Planos" },
];

function NavContent({
  pathname,
  isAdmin,
  onNavClick,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavClick?: () => void;
}) {
  return (
    <>
      {nav.map(({ href, label }) => {
        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavClick}
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
      {isAdmin && (
        <Link
          href="/dashboard/admin"
          onClick={onNavClick}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/dashboard/admin"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              : "text-amber-700 hover:bg-amber-100/80 dark:text-amber-400 dark:hover:bg-amber-900/30"
          }`}
        >
          Admin
        </Link>
      )}
    </>
  );
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Mobile: top bar + hamburger */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-zinc-50/95 px-4 dark:border-zinc-800 dark:bg-zinc-900/95 md:hidden">
        <Link href="/dashboard" className="font-semibold tracking-tight text-zinc-900 dark:text-white">
          Saúde Finanças
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Abrir menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile: overlay + drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                aria-label="Fechar menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-auto px-3 py-4">
              <NavContent pathname={pathname} isAdmin={isAdmin} onNavClick={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-zinc-200 px-3 py-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void handleLogout();
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Sair
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Desktop: sidebar fixa na altura da viewport; Sair sempre embaixo */}
      <aside className="hidden h-screen w-56 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50 md:flex md:sticky md:top-0">
        <div className="shrink-0 p-5">
          <Link href="/dashboard" className="block">
            <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Saúde Finanças
            </span>
          </Link>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-col gap-0.5">
            <NavContent pathname={pathname} isAdmin={isAdmin} />
          </div>
        </nav>
        <div className="shrink-0 border-t border-zinc-200 px-3 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
