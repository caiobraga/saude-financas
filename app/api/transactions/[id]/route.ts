import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.date != null) updates.date = String(body.date).slice(0, 10);
    if (body.description != null) updates.description = String(body.description).slice(0, 500);
    if (body.amount != null) updates.amount = Number(body.amount);
    if (body.type != null && (body.type === "credit" || body.type === "debit")) updates.type = body.type;
    if (body.category != null) updates.category = body.category ? String(body.category).slice(0, 100) : null;
    if (body.parcela_numero !== undefined) updates.parcela_numero = body.parcela_numero == null || body.parcela_numero === "" ? null : Math.max(1, Math.floor(Number(body.parcela_numero)));
    if (body.parcela_total !== undefined) updates.parcela_total = body.parcela_total == null || body.parcela_total === "" ? null : Math.max(1, Math.floor(Number(body.parcela_total)));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .select("id, date, description, amount, type, category, parcela_numero, parcela_total")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Transaction PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Transaction DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir" },
      { status: 500 }
    );
  }
}
