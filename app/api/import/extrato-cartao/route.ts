import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfFaturaCartao, type TransacaoFaturaCartao } from "@/lib/parse-pdf-fatura-cartao";
import { getSubcategoria } from "@/lib/categorias";

export const maxDuration = 60;
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const preview = formData.get("preview") === "1" || formData.get("preview") === "true";

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Envie um arquivo PDF da fatura do cartão." },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { texto, transacoes, csv } = await parsePdfFaturaCartao(buffer);

    if (!texto.trim()) {
      return NextResponse.json(
        { error: "Não foi possível extrair texto do PDF. O arquivo pode estar em imagem ou protegido." },
        { status: 400 }
      );
    }

    if (transacoes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma linha reconhecida na fatura. O formato pode não ser suportado." },
        { status: 400 }
      );
    }

    if (preview) {
      return NextResponse.json({
        preview: true,
        count: transacoes.length,
        transacoes: transacoes.map((t) => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category ?? null,
          card_line_kind: t.cardLineKind,
          parcela_numero: t.parcela_numero ?? null,
          parcela_total: t.parcela_total ?? null,
        })),
        csv,
      });
    }

    const accountId = formData.get("account_id") ?? formData.get("accountId");
    if (!accountId || typeof accountId !== "string" || !accountId.trim()) {
      return NextResponse.json(
        { error: "Selecione o cartão (conta tipo crédito) de destino." },
        { status: 400 }
      );
    }

    const { data: account, error: accError } = await supabase
      .from("accounts")
      .select("id, type")
      .eq("id", accountId.trim())
      .single();

    if (accError || !account?.id) {
      return NextResponse.json(
        { error: "Conta não encontrada ou sem permissão." },
        { status: 400 }
      );
    }

    if (account.type !== "credit") {
      return NextResponse.json(
        { error: "A importação de fatura só pode ser feita em uma conta do tipo Cartão de crédito. Crie ou selecione uma conta \"Crédito\" em Contas." },
        { status: 400 }
      );
    }

    const importBatchId = `pdf-cartao-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const rows = transacoes.map((t: TransacaoFaturaCartao, idx: number) => ({
      account_id: account.id,
      external_id: `pdf-cartao-${t.date}-${t.description.slice(0, 24)}-${t.amount}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      date: t.date,
      description: t.description,
      raw_description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category ?? null,
      subcategoria: getSubcategoria(t.category ?? null),
      parcela_numero: t.parcela_numero ?? null,
      parcela_total: t.parcela_total ?? null,
      import_source: "pdf_cartao",
      import_batch_id: importBatchId,
      import_order: idx + 1,
      card_line_kind: t.cardLineKind,
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
      accountId: account.id,
      count: transacoes.length,
      importBatchId,
    });
  } catch (err) {
    console.error("Import fatura cartão error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Erro ao importar fatura",
      },
      { status: 500 }
    );
  }
}
