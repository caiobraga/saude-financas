import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const validIds = ids.filter((id: unknown) => typeof id === "string" && id.length > 0);

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum ID informado" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", validIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: validIds.length });
  } catch (err) {
    console.error("Bulk delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir" },
      { status: 500 }
    );
  }
}
