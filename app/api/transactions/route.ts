import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to"); // YYYY-MM-DD

    let query = supabase
      .from("transactions")
      .select("id, date, description, amount, type, category, parcela_numero, parcela_total")
      .order("date", { ascending: false });

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      query = query.gte("date", from);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      query = query.lte("date", to);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Transaction GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar transações" },
      { status: 500 }
    );
  }
}

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
    const accountId = body?.account_id ?? body?.accountId;
    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        { error: "account_id é obrigatório" },
        { status: 400 }
      );
    }

    const date = body.date != null ? String(body.date).slice(0, 10) : null;
    const description = body.description != null ? String(body.description).slice(0, 500) : "";
    const amount = body.amount != null ? Number(body.amount) : null;
    const type = body.type === "credit" || body.type === "debit" ? body.type : null;
    const category = body.category != null ? (body.category ? String(body.category).slice(0, 100) : null) : null;
    const parcelaNumero = body.parcela_numero != null ? (Number(body.parcela_numero) || null) : null;
    const parcelaTotal = body.parcela_total != null ? (Number(body.parcela_total) || null) : null;

    if (!date || description === "" || amount === null || !type) {
      return NextResponse.json(
        { error: "Preencha data, descrição, valor e tipo (crédito/débito)" },
        { status: 400 }
      );
    }

    const externalId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const insertRow: Record<string, unknown> = {
      account_id: accountId,
      external_id: externalId,
      date,
      description,
      raw_description: description,
      amount: type === "debit" ? -Math.abs(amount) : Math.abs(amount),
      type,
      category,
    };
    if (parcelaNumero != null) insertRow.parcela_numero = parcelaNumero;
    if (parcelaTotal != null) insertRow.parcela_total = parcelaTotal;

    const { data, error } = await supabase
      .from("transactions")
      .insert(insertRow)
      .select("id, date, description, amount, type, category, parcela_numero, parcela_total")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Transaction POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar transação" },
      { status: 500 }
    );
  }
}
