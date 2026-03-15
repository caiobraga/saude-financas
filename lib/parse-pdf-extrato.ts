/**
 * Pipeline único de extração e parse de extrato PDF.
 * Usado por Importar extrato (PDF) e Debug: PDF em tabela — mesma lógica de identificação.
 */
import { extractText } from "unpdf";
import {
  parseExtratoTextoComFallback,
  transacoesParaCSV,
  type TransacaoExtrato,
} from "./extrato-pdf";

export type { TransacaoExtrato };

export interface ResultadoParseExtrato {
  texto: string;
  transacoes: TransacaoExtrato[];
  csv: string;
}

/**
 * Extrai texto do PDF e parseia com a mesma lógica do Debug (juntar linhas, expandir blob, C/D, etc.).
 * Retorna transações com data válida (yyyy-mm-dd) e CSV.
 */
export async function parsePdfExtrato(
  buffer: Uint8Array
): Promise<ResultadoParseExtrato> {
  const { text } = await extractText(buffer, { mergePages: true });
  const texto = text ?? "";
  const transacoes = parseExtratoTextoComFallback(texto).filter(
    (t) => t.date.length === 10
  );
  const csv = transacoesParaCSV(transacoes);
  return { texto, transacoes, csv };
}
