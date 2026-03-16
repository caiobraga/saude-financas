import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfExtrato, type TransacaoExtrato } from "@/lib/parse-pdf-extrato";
import { getSubcategoria } from "@/lib/categorias";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Mesma lógica de identificação do Debug (PDF em tabela): parsePdfExtrato usa
 * parseExtratoTextoComFallback (juntar linhas, expandir blob, C/D, continuação após valor).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const preview = formData.get("preview") === "1" || formData.get("preview") === "true";

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Envie um arquivo PDF de extrato." },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { texto, transacoes, csv } = await parsePdfExtrato(buffer);

    if (!texto.trim()) {
      return NextResponse.json(
        { error: "Não foi possível extrair texto do PDF. O arquivo pode estar em imagem ou protegido." },
        { status: 400 }
      );
    }

    if (transacoes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma transação encontrada no PDF. O formato do extrato pode não ser suportado." },
        { status: 400 }
      );
    }

    if (preview) {
      return NextResponse.json({
        preview: true,
        count: transacoes.length,
        transacoes,
        csv,
      });
    }

    const PDF_LINK_ID = "pdf-import";
    const PDF_ACCOUNT_EXTERNAL_ID = "extrato";

    let conn = (await supabase
      .from("bank_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("belvo_link_id", PDF_LINK_ID)
      .single()).data;

    if (!conn?.id) {
      const { data: newConn, error: connError } = await supabase
        .from("bank_connections")
        .insert({
          user_id: user.id,
          belvo_link_id: PDF_LINK_ID,
          institution: "Extrato PDF",
          status: "active",
        })
        .select("id")
        .single();
      if (connError || !newConn?.id) {
        return NextResponse.json(
          { error: connError?.message ?? "Erro ao criar conexão" },
          { status: 500 }
        );
      }
      conn = newConn;
    }

    let account = (await supabase
      .from("accounts")
      .select("id")
      .eq("connection_id", conn.id)
      .eq("external_id", PDF_ACCOUNT_EXTERNAL_ID)
      .single()).data;

    if (!account?.id) {
      const { data: newAccount, error: accError } = await supabase
        .from("accounts")
        .insert({
          connection_id: conn.id,
          external_id: PDF_ACCOUNT_EXTERNAL_ID,
          name: "Extrato PDF",
          type: "checking",
          balance: 0,
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (accError || !newAccount?.id) {
        return NextResponse.json(
          { error: accError?.message ?? "Erro ao obter conta" },
          { status: 500 }
        );
      }
      account = newAccount;
    }

    const rows = transacoes.map((t: TransacaoExtrato) => ({
      account_id: account.id,
      external_id: `pdf-${t.date}-${t.description.slice(0, 30)}-${t.amount}-${Math.random().toString(36).slice(2, 9)}`,
      date: t.date,
      description: t.description,
      raw_description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category ?? null,
      subcategoria: getSubcategoria(t.category ?? null),
      parcela_numero: t.parcela_numero ?? null,
      parcela_total: t.parcela_total ?? null,
    }));

    const { error: txError } = await supabase.from("transactions").insert(rows);

    if (txError) {
      return NextResponse.json(
        { error: txError.message ?? "Erro ao salvar transações" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      connectionId: conn.id,
      accountId: account.id,
      count: transacoes.length,
    });
  } catch (err) {
    console.error("Import extrato PDF error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Erro ao importar extrato",
      },
      { status: 500 }
    );
  }
}
