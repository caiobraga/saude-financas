"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const linkId =
      searchParams.get("link_id") ??
      searchParams.get("link") ??
      searchParams.get("id");
    if (!linkId) {
      setStatus("error");
      setMessage("Link não identificado.");
      return;
    }
    fetch("/api/belvo/register-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar");
        setStatus("ok");
        router.replace("/dashboard/conectar?success=1");
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Erro ao sincronizar");
      });
  }, [searchParams, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 sm:p-8">
        <p className="text-zinc-500">Sincronizando sua conta...</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <p className="text-red-600 dark:text-red-400">{message}</p>
        <a
          href="/dashboard/conectar"
          className="mt-4 inline-block text-sm font-medium text-emerald-600"
        >
          Voltar para Conectar banco
        </a>
      </div>
    );
  }
  return null;
}

export default function ConectarCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-4 sm:p-8">
          <p className="text-zinc-500">Carregando...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
