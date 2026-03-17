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

    const accountId = formData.get("account_id") ?? formData.get("accountId");
    if (!accountId || typeof accountId !== "string" || !accountId.trim()) {
      return NextResponse.json(
        { error: "Selecione a conta de destino para importar as transações." },
        { status: 400 }
      );
    }

    const { data: account, error: accError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", accountId.trim())
      .single();

    if (accError || !account?.id) {
      return NextResponse.json(
        { error: "Conta não encontrada ou sem permissão. Crie uma conta em Contas e selecione-a." },
        { status: 400 }
      );
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
