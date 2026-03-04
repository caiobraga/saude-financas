import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const BELVO_SANDBOX = "https://sandbox.belvo.com";
const BELVO_PRODUCTION = "https://api.belvo.com";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const secretKey = env.belvo.secretKey();
    const secretPassword = env.belvo.secretPassword();
    const baseUrl =
      env.belvo.env() === "production" ? BELVO_PRODUCTION : BELVO_SANDBOX;

    // Escopos para o widget Brasil (Open Finance): links + consentimentos
    const scopes =
      "read_institutions,write_links,read_links,read_consents,write_consents,write_consent_callback,delete_consents";

    const res = await fetch(`${baseUrl}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: secretKey,
        password: secretPassword,
        scopes,
        widget: true,
      }),
    });

    const data = (await res.json()) as {
      access?: string;
      detail?: unknown;
      message?: string;
    };

    if (!res.ok) {
      const detail = Array.isArray(data?.detail)
        ? (data.detail as Array<{ message?: string }>)[0]?.message
        : (data as { message?: string })?.message ?? JSON.stringify(data?.detail ?? data);
      const requestId = (data as { request_id?: string })?.request_id;
      console.error("Belvo token API error:", res.status, data);
      const userMessage =
        res.status === 401
          ? "Credenciais Belvo inválidas. Verifique BELVO_SECRET_KEY e BELVO_SECRET_PASSWORD no .env (use aspas na senha se tiver #)."
          : res.status >= 500
            ? `Erro no servidor Belvo (500). Isso pode ser temporário ou exigir ativação do widget Brasil no seu conta Belvo.${requestId ? ` Solicite suporte com o request_id: ${requestId}` : ""}`
            : `Belvo: ${String(detail)}`;
      return NextResponse.json(
        { error: userMessage },
        { status: 500 }
      );
    }

    const access = data.access;
    if (!access) {
      console.error("Belvo token response missing access:", data);
      return NextResponse.json(
        { error: "Token não retornado pelo Belvo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ access });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar token do widget";
    console.error("Belvo widget token error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
