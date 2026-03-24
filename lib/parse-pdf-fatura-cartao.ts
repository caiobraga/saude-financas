import { extractText } from "unpdf";
import {
  parseFaturaCartaoTexto,
  transacoesFaturaParaCSV,
  type TransacaoFaturaCartao,
} from "./fatura-cartao-pdf";

export type { TransacaoFaturaCartao };

export interface ResultadoParseFaturaCartao {
  texto: string;
  transacoes: TransacaoFaturaCartao[];
  csv: string;
}

export async function parsePdfFaturaCartao(
  buffer: Uint8Array
): Promise<ResultadoParseFaturaCartao> {
  const { text } = await extractText(buffer, { mergePages: true });
  const texto = text ?? "";
  const transacoes = parseFaturaCartaoTexto(texto);
  const csv = transacoesFaturaParaCSV(transacoes);
  return { texto, transacoes, csv };
}
