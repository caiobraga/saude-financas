import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-xl font-semibold text-zinc-900 dark:text-white">
            Saúde Finanças
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
            Organize suas finanças em um só lugar
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Conecte suas contas bancárias com segurança pelo Open Finance e veja
            todas as suas transações organizadas em uma planilha clara. Controle
            receitas, despesas e saldos sem esforço.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/cadastro"
              className="rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-emerald-700"
            >
              Criar conta grátis
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              Já tenho conta
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-8 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-2xl">🔗</div>
            <h2 className="mt-4 font-semibold text-zinc-900 dark:text-white">
              Conexão segura
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Conecte seu banco via Open Finance Brasil. Você autoriza apenas o
              que quiser e pode revogar o acesso a qualquer momento.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-2xl">📊</div>
            <h2 className="mt-4 font-semibold text-zinc-900 dark:text-white">
              Tudo em planilha
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Transações, saldos e categorias em formato de planilha para você
              analisar e exportar como preferir.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-2xl">📱</div>
            <h2 className="mt-4 font-semibold text-zinc-900 dark:text-white">
              Simples e rápido
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Cadastro em segundos. Conecte uma ou várias contas e comece a
              organizar suas finanças hoje.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} Saúde Finanças. Dados protegidos e
          criptografados.
        </div>
      </footer>
    </div>
  );
}
