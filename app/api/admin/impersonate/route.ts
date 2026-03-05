import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== env.admin.email.toLowerCase()) {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : null;
    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: user, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !user?.user?.email) {
      return NextResponse.json(
        { error: userError?.message ?? "Usuário não encontrado" },
        { status: 404 }
      );
    }

    let base =
      typeof body?.origin === "string" && body.origin
        ? body.origin
        : request.headers.get("origin") ?? "";
    if (!base) {
      try {
        const ref = request.headers.get("referer");
        if (ref) base = new URL(ref).origin;
      } catch {
        // ignore
      }
    }
    if (!base) {
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      if (host) base = `${proto === "https" ? "https" : "http"}://${host}`;
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.user.email,
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const hashedToken = linkData?.properties?.hashed_token ?? null;
    if (!hashedToken) {
      return NextResponse.json({ error: "Link não gerado" }, { status: 500 });
    }

    const callbackPath = "/auth/callback";
    const params = new URLSearchParams({
      token_hash: hashedToken,
      type: "magiclink",
      next: "/dashboard",
    });
    const url = base
      ? `${base.replace(/\/$/, "")}${callbackPath}?${params.toString()}`
      : `${callbackPath}?${params.toString()}`;

    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "Admin não configurado (service role key)" },
        { status: 503 }
      );
    }
    console.error("Admin impersonate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao entrar como usuário" },
      { status: 500 }
    );
  }
}
