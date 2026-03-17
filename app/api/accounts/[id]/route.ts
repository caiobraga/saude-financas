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
      return NextResponse.json({ error: "ID da conta obrigatório" }, { status: 400 });
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
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Nome da conta é obrigatório" }, { status: 400 });
      updates.name = name.slice(0, 200);
    }
    if (body.type != null) {
      const type = body.type;
      if (type !== "checking" && type !== "savings" && type !== "credit") {
        return NextResponse.json({ error: "Tipo deve ser checking, savings ou credit" }, { status: 400 });
      }
      updates.type = type;
    }
    if (body.balance != null) updates.balance = Number(body.balance);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", id)
      .select("id, name, type, balance")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Account PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar conta" },
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
      return NextResponse.json({ error: "ID da conta obrigatório" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { error } = await supabase.from("accounts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Account DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir conta" },
      { status: 500 }
    );
  }
}
