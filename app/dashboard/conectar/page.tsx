"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const BELVO_WIDGET_BASE =
  process.env.NEXT_PUBLIC_BELVO_WIDGET_URL ?? "https://widget.belvo.io";

function ConectarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const [loading, setLoading] = useState(false);
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
        router.push("/dashboard/conectar?success=1");
        router.refresh();
        if (typeof window !== "undefined" && window.opener) {
          window.opener.postMessage(
            { type: "belvo_link_created", link_id: linkId },
            window.location.origin
          );
          window.close();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao sincronizar");
      } finally {
        setSyncing(false);
      }
    },
    [router]
  );

  const linkIdFromUrl =
    searchParams.get("link_id") ?? searchParams.get("link") ?? null;

  useEffect(() => {
    if (linkIdFromUrl) registerLink(linkIdFromUrl);
  }, [linkIdFromUrl, registerLink]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.type === "belvo_link_created" && data?.link_id) {
        registerLink(data.link_id);
        router.refresh();
      }
      if (data?.link_id && !data?.type) registerLink(data.link_id);
      if (data?.link) registerLink(data.link);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [registerLink, router]);

  async function handleOpenWidget() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/belvo/widget-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao obter token");
      const access = data.access;
      if (!access) return;
      const externalId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const params: Record<string, string> = {
        access_token: access,
        locale: "pt",
        access_mode: "recurrent",
        external_id: externalId,
        country_codes: "BR",
      };
      if (Array.isArray(data.institutions) && data.institutions.length > 0) {
        params.institutions = data.institutions.join(",");
      }
      const widgetUrl = `${BELVO_WIDGET_BASE}/?${new URLSearchParams(params).toString()}`;
      window.open(widgetUrl, "belvo-widget", "width=500,height=700,scrollbars=yes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir widget");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
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

        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Será aberta uma nova janela para você escolher o banco e autorizar o
            compartilhamento. Ao terminar, feche a janela e esta página será atualizada.
          </p>
          <button
            type="button"
            onClick={handleOpenWidget}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Abrindo..." : "Conectar instituição"}
          </button>
          {syncing && (
            <p className="text-sm text-zinc-500">
              Sincronizando contas e transações...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConectarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <p className="text-zinc-500">Carregando...</p>
        </div>
      }
    >
      <ConectarContent />
    </Suspense>
  );
}
