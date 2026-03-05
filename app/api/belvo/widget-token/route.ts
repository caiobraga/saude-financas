import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const BELVO_SANDBOX = "https://sandbox.belvo.com";
const BELVO_PRODUCTION = "https://api.belvo.com";

// CPF/nome de teste do sandbox Belvo (Mockbank) - ver doc Belvo Brazil Widget
const SANDBOX_CPF = "76109277673";
const SANDBOX_NAME = "Ralph Bragg";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const origin =
      request.headers.get("origin") ??
      request.headers.get("x-forwarded-host")
        ? `https://${request.headers.get("x-forwarded-host")}`
        : "http://localhost:3000";
    const basePath = `${origin}/dashboard/conectar`;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, cpf")
      .eq("id", user.id)
      .single();

    let cpf = (profile?.cpf ?? "").replace(/\D/g, "").slice(0, 11);
    let name = (profile?.full_name ?? "").trim().slice(0, 100);

    if (!cpf || !name) {
      try {
        const body = await request.json();
        if (body?.cpf && body?.name) {
          cpf = String(body.cpf).replace(/\D/g, "").slice(0, 11);
          name = String(body.name).trim().slice(0, 100);
        }
      } catch {
        // body opcional
      }
    }

    const isSandbox = env.belvo.env() !== "production";
    if (!cpf || !name) {
      if (isSandbox) {
        cpf = SANDBOX_CPF;
        name = SANDBOX_NAME;
      } else {
        return NextResponse.json(
          {
            error:
              "Preencha nome e CPF no seu Perfil antes de conectar um banco.",
          },
          { status: 400 }
        );
      }
    }

    const secretKey = env.belvo.secretKey();
    const secretPassword = env.belvo.secretPassword();
    const baseUrl =
      env.belvo.env() === "production" ? BELVO_PRODUCTION : BELVO_SANDBOX;

    const scopes =
      "read_institutions,write_links,read_links,read_consents,write_consents,write_consent_callback,delete_consents";

    // Payload OFDA Brasil: widget deve ser objeto com consent, callback_urls e branding
    const payload = {
      id: secretKey,
      password: secretPassword,
      scopes,
      stale_in: "300d",
      fetch_resources: [
        "ACCOUNTS",
        "TRANSACTIONS",
        "OWNERS",
        "BILLS",
        "INVESTMENTS",
        "INVESTMENT_TRANSACTIONS",
      ],
      widget: {
        purpose:
          "Organizar suas finanças e visualizar transações e saldos em um só lugar.",
        openfinance_feature: "consent_link_creation",
        callback_urls: {
          success: `${basePath}?success=1`,
          exit: `${basePath}?exit=1`,
          event: `${basePath}?event=error`,
        },
        consent: {
          terms_and_conditions_url: `${origin}/termos`,
          permissions: [
            "REGISTER",
            "ACCOUNTS",
            "CREDIT_CARDS",
            "CREDIT_OPERATIONS",
          ],
          identification_info: [
            {
              type: "CPF",
              number: cpf,
              name,
            },
          ],
        },
        branding: {
          company_name: "Saúde Finanças",
          company_icon: `${origin}/logo.svg`,
          company_logo: `${origin}/logo.svg`,
          company_terms_url: `${origin}/termos`,
          overlay_background_color: "#F0F2F4",
          social_proof: true,
        },
        theme: [],
      },
    };

    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`${baseUrl}/api/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        break;
      } catch (err) {
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!res) throw new Error("Failed to get response from Belvo");

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

    return NextResponse.json({
      access,
      institutions: env.belvo.env() !== "production" ? ["ofmockbank_br_retail"] : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar token do widget";
    console.error("Belvo widget token error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
