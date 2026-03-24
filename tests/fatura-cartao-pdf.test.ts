import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  classifyCardLineKind,
  isLinhaResumoFaturaCartaoIgnorada,
  normalizeBbOurocardLancamentosText,
  parseBbOurocardFaturaTexto,
  parseFaturaCartaoTexto,
} from "../lib/fatura-cartao-pdf";

const FIXTURES_DIR = join(__dirname, "fixtures", "fatura-cartao");

describe("fatura-cartao-pdf", () => {
  it("classifica resumo e compra", () => {
    expect(classifyCardLineKind("TOTAL DA FATURA R$ 1.200,00")).toBe("resumo");
    expect(classifyCardLineKind("SUPERMERCADO XYZ")).toBe("compra");
    expect(classifyCardLineKind("IOF sobre compras")).toBe("encargo");
    expect(classifyCardLineKind("PAGAMENTO RECEBIDO")).toBe("pagamento");
  });

  const bbStub = `
Resumo da fatura OUROCARD
Fatura fechada em 22/01/2026
Lançamentos nesta fatura
Data Descrição País Valor
22/01 PGTO DEBITO CONTA 0112 000001089 200 BR R$ -2.152,57
03/02 JEL COLATINA COLATINA BR R$ 67,90
15/12 MERCADO EXEMPLO BR R$ 100,00
SALDO FATURA ANTERIOR BR R$ 1.500,00
Subtotal R$ 1.712,41
Total da Fatura R$ 3.000,00
`;

  it("parseBbOurocard: PGTO com milhares negativos; não inclui saldo/subtotal/total", () => {
    const rows = parseBbOurocardFaturaTexto(bbStub);
    const pgto = rows.find((r) => r.description.includes("PGTO DEBITO"));
    expect(pgto).toBeDefined();
    expect(pgto!.type).toBe("credit");
    expect(pgto!.amount).toBeCloseTo(2152.57, 2);
    expect(pgto!.cardLineKind).toBe("pagamento");

    expect(rows.some((r) => r.description.includes("SALDO FATURA ANTERIOR"))).toBe(false);
    expect(rows.some((r) => r.description.startsWith("Subtotal"))).toBe(false);
    expect(rows.some((r) => r.description.startsWith("Total da fatura"))).toBe(false);

    const dez = rows.find((r) => r.description.includes("MERCADO EXEMPLO"));
    expect(dez?.date).toBe("2025-12-15");
  });

  it("parseFaturaCartaoTexto usa parser BB e remove linhas de resumo da fatura", () => {
    const rows = parseFaturaCartaoTexto(bbStub);
    expect(rows.length).toBe(3);
    expect(rows.some((r) => r.description.includes("PGTO DEBITO"))).toBe(true);
    expect(rows.every((r) => !isLinhaResumoFaturaCartaoIgnorada(r.description))).toBe(true);
  });

  /** Simula texto do unpdf: bloco de lançamentos quase numa linha só (BB). */
  const bbOneLineBlob = `Lançamentos nesta fatura OUROCARD
Fatura fechada em 08/01/2026
Luciana (Cartão 7287) Data Descrição País Valor SALDO FATURA ANTERIOR BR R$ 1.442,48 Pagamentos/Créditos 22/12 PGTO DEBITO CONTA 0112 BR R$ -1.442,48 Serviços 22/12 OPENAI *CHATGPT SUBSCR OPENAI.COM CA R$ 114,73 *** 20,00 DOLAR AMERICANO Cotação do Dólar de 22/12: R$ 5,7366 22/12 IOF - COMPRA NO EXTERIOR R$ 4,01 Compras parceladas 23/01 FABRICADEMILH PARC 12/12 RIO DE JANEI BR R$ 110,09 Subtotal R$ 2.152,57 Total da Fatura R$ 2.152,57 Fale conosco`;

  it("normaliza bloco colado e extrai OPENAI (114,73), IOF e parcela PARC 12/12", () => {
    const norm = normalizeBbOurocardLancamentosText(bbOneLineBlob);
    expect(norm).toContain("\n22/12 OPENAI");
    expect(norm).toContain("FABRICADEMILH PARC 12/12");
    const rows = parseBbOurocardFaturaTexto(bbOneLineBlob);
    const openai = rows.find((r) => r.description.includes("OPENAI"));
    expect(openai?.amount).toBeCloseTo(-114.73, 2);
    expect(openai?.date).toBe("2025-12-22");
    const iof = rows.find((r) => r.description.includes("IOF"));
    expect(iof?.amount).toBeCloseTo(-4.01, 2);
    const fab = rows.find((r) => r.description.includes("FABRICADEMILH"));
    expect(fab?.parcela_numero).toBe(12);
    expect(fab?.parcela_total).toBe(12);
    expect(fab?.amount).toBeCloseTo(-110.09, 2);
  });

  it("fixture BB: parser dedicado mantém compra, iof e parcela", () => {
    const texto = readFileSync(join(FIXTURES_DIR, "bb-ourocard.txt"), "utf-8");
    const rows = parseFaturaCartaoTexto(texto);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((r) => r.description.includes("OPENAI"))).toBe(true);
    expect(rows.some((r) => r.description.includes("IOF"))).toBe(true);
    const parc = rows.find((r) => r.description.includes("FABRICADEMILH"));
    expect(parc?.parcela_numero).toBe(12);
    expect(parc?.parcela_total).toBe(12);
    expect(rows.every((r) => !isLinhaResumoFaturaCartaoIgnorada(r.description))).toBe(true);
  });

  it("fixture Itaú-like: parser genérico reconhece pagamento e parcela", () => {
    const texto = readFileSync(join(FIXTURES_DIR, "itau-like.txt"), "utf-8");
    const rows = parseFaturaCartaoTexto(texto);
    expect(rows.length).toBe(4);
    const pgto = rows.find((r) => /PAGAMENTO RECEBIDO/i.test(r.description));
    expect(pgto).toBeDefined();
    expect(pgto?.type).toBe("credit");
    expect(pgto?.amount).toBeCloseTo(500, 2);
    expect(pgto?.cardLineKind).toBe("pagamento");
    const parc = rows.find((r) => /BLUEFIT/i.test(r.description));
    expect(parc?.parcela_numero).toBe(3);
    expect(parc?.parcela_total).toBe(10);
  });

  it("fixture Nubank-like: parser genérico suporta valor sem R$ e ignora total", () => {
    const texto = readFileSync(join(FIXTURES_DIR, "nubank-like.txt"), "utf-8");
    const rows = parseFaturaCartaoTexto(texto);
    expect(rows.length).toBe(4);
    expect(rows.some((r) => /NETFLIX/i.test(r.description) && Math.abs(r.amount + 39.9) < 0.01)).toBe(true);
    expect(rows.some((r) => /IFOOD/i.test(r.description) && Math.abs(r.amount + 82.35) < 0.01)).toBe(true);
    const pg = rows.find((r) => /PAGAMENTO/i.test(r.description));
    expect(pg?.type).toBe("credit");
    expect(pg?.amount).toBeCloseTo(1200, 2);
    expect(rows.some((r) => /Valor total/i.test(r.description))).toBe(false);
  });
});
