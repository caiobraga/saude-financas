import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { AdminPanel } from "./AdminPanel";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  if (user.email?.toLowerCase() !== env.admin.email.toLowerCase()) {
    redirect("/dashboard");
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl">
        Administração
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Pesquise usuários por nome ou e-mail e entre na conta para ver e alterar dados como o cliente.
      </p>
      <AdminPanel />
    </div>
  );
}
