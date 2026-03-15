import { NextResponse } from "next/server";
import { parsePdfExtrato } from "@/lib/parse-pdf-extrato";
import { parseExtratoTextoDebug } from "@/lib/extrato-pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST: envia um PDF e recebe o texto extraído + cada etapa do pipeline + tabela de transações.
 * Usa o mesmo parsePdfExtrato que Importar extrato (PDF) — mesma lógica de identificação.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Envie um arquivo PDF." },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { texto, transacoes: transacoesFallback, csv } = await parsePdfExtrato(buffer);

    if (!texto.trim()) {
      return NextResponse.json(
        {
          error: "Não foi possível extrair texto do PDF. Pode estar em imagem ou protegido.",
          rawText: "",
          rawLines: [],
          afterMerge: [],
          afterExpand: [],
          transacoes: [],
          transacoesFallback: [],
          csv: "",
        },
        { status: 200 }
      );
    }

    const debug = parseExtratoTextoDebug(texto);

    return NextResponse.json({
      rawText: texto,
      rawLines: debug.rawLines,
      afterMerge: debug.afterMerge,
      afterExpand: debug.afterExpand,
      transacoes: debug.transacoes,
      transacoesFallback,
      count: transacoesFallback.length,
      csv,
    });
  } catch (err) {
    console.error("Debug extrato error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar PDF" },
      { status: 500 }
    );
  }
}
