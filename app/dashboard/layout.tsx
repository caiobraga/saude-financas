import Link from "next/link";
import { cookies } from "next/headers";
import { Sidebar } from "../components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getViewAsFromCookies } from "@/lib/view-as";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = user?.email?.toLowerCase() === env.admin.email.toLowerCase();
  const cookieStore = await cookies();
  const viewAs = getViewAsFromCookies(cookieStore, isAdmin ?? false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar isAdmin={isAdmin} />
      <main className="min-h-screen flex-1 overflow-auto pt-14 md:pt-0">
        {isAdmin && !viewAs && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Você está logado como administrador.
              </span>
              <Link
                href="/dashboard/admin"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                Ir para painel Admin
              </Link>
            </div>
          </div>
        )}
        {isAdmin && viewAs && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/40 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-sky-800 dark:text-sky-200">
                Você está vendo as informações de <strong>{viewAs.userName}</strong>
              </span>
              <Link
                href="/api/admin/view-as/clear"
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-700 dark:hover:bg-sky-600"
              >
                Parar de ver
              </Link>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
