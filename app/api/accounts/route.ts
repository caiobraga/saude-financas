import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { data: connections } = await supabase
      .from("bank_connections")
      .select("id")
      .neq("institution", "Extrato PDF");
    const connectionIds = (connections ?? []).map((c) => c.id);
    if (connectionIds.length === 0) {
      return NextResponse.json([]);
    }
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name")
      .in("connection_id", connectionIds)
      .order("name");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Accounts GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar contas" },
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
    const isManual = body?.manual === true;
    let connectionId = body?.connection_id ?? body?.connectionId;
    if (typeof connectionId === "string") connectionId = connectionId.trim();

    const name = body.name != null ? String(body.name).trim().slice(0, 200) : "";
    if (!name) {
      return NextResponse.json({ error: "Nome da conta é obrigatório" }, { status: 400 });
    }

    const type = body.type === "checking" || body.type === "savings" || body.type === "credit"
      ? body.type
      : "checking";

    if (isManual || !connectionId) {
      const { data: manualConn } = await supabase
        .from("bank_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("belvo_link_id", "manual")
        .single();

      if (manualConn?.id) {
        connectionId = manualConn.id;
      } else {
        const { data: newConn, error: createConnError } = await supabase
          .from("bank_connections")
          .insert({
            user_id: user.id,
            belvo_link_id: "manual",
            institution: "Contas manuais",
            status: "active",
          })
          .select("id")
          .single();
        if (createConnError || !newConn?.id) {
          return NextResponse.json(
            { error: createConnError?.message ?? "Erro ao criar conexão" },
            { status: 500 }
          );
        }
        connectionId = newConn.id;
      }
    } else {
      const { data: conn, error: connError } = await supabase
        .from("bank_connections")
        .select("id")
        .eq("id", connectionId)
        .single();
      if (connError || !conn?.id) {
        return NextResponse.json({ error: "Conexão não encontrada ou sem permissão" }, { status: 404 });
      }
    }

    const externalId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        connection_id: connectionId,
        external_id: externalId,
        name,
        type,
        balance: 0,
      })
      .select("id, name, type, balance")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(account);
  } catch (err) {
    console.error("Account POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
