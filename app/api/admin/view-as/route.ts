import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { setViewAsCookies, clearViewAsCookies } from "@/lib/view-as";

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
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido (JSON)" }, { status: 400 });
  }
  if (body?.clear === true) {
    const res = NextResponse.json({ ok: true });
    clearViewAsCookies(res);
    return res;
  }

  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const userName = typeof body?.userName === "string" ? body.userName.trim() || "Usuário" : "Usuário";
  if (!userId) {
    return NextResponse.json(
      { error: "userId é obrigatório" },
      { status: 400 }
    );
  }

  const dashboardUrl = new URL("/dashboard", request.url);
  const res = NextResponse.redirect(dashboardUrl, 302);
  setViewAsCookies(res, userId, userName);
  return res;
}
