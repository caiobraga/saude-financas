"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const BELVO_WIDGET_BASE =
  process.env.NEXT_PUBLIC_BELVO_WIDGET_URL ?? "https://widget.belvo.io";

export default function ConectarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const [loading, setLoading] = useState(false);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const registerLink = useCallback(
    async (linkId: string) => {
      setSyncing(true);
      setError(null);
      try {
        const res = await fetch("/api/belvo/register-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar");
        setWidgetToken(null);
        router.push("/dashboard/conectar?success=1");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao sincronizar");
      } finally {
        setSyncing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!widgetToken) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.link_id) registerLink(data.link_id);
      if (data?.link) registerLink(data.link);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [widgetToken, registerLink]);

  async function handleOpenWidget() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/belvo/widget-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao obter token");
      if (data.access) setWidgetToken(data.access);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir widget");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
        Conectar banco
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Vincule suas contas via Open Finance (Belvo) para ver transações e
        saldos em um só lugar.
      </p>

      {success === "1" && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            Conta conectada e dados sincronizados. Veja em{" "}
            <a href="/dashboard/contas" className="font-medium underline">
              Contas
            </a>{" "}
            e{" "}
            <a href="/dashboard/transacoes" className="font-medium underline">
              Transações
            </a>
            .
          </p>
        </div>
      )}

      <div className="mt-8 max-w-2xl space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Como funciona
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Utilizamos o <strong>Open Finance Brasil</strong> através do
            agregador <strong>Belvo</strong> para conectar sua conta de forma
            segura. Você autoriza o compartilhamento apenas dos dados
            necessários (transações e saldos) e pode revogar o acesso a qualquer
            momento no seu banco.
          </p>
        </section>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}

        {!widgetToken ? (
          <div>
            <button
              type="button"
              onClick={handleOpenWidget}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Abrindo..." : "Conectar instituição"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Conecte sua conta no quadro abaixo. Ao terminar, seus dados serão
              sincronizados automaticamente.
            </p>
            <div className="relative h-[500px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <iframe
                title="Belvo Connect Widget"
                src={`${BELVO_WIDGET_BASE}/?access_token=${encodeURIComponent(widgetToken)}&locale=pt`}
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
            {syncing && (
              <p className="text-sm text-zinc-500">
                Sincronizando contas e transações...
              </p>
            )}
            <button
              type="button"
              onClick={() => setWidgetToken(null)}
              className="text-sm text-zinc-500 underline hover:text-zinc-700"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
