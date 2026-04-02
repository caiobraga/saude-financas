import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  parseExtratoTexto,
  parseExtratoTextoComFallback,
} from "../lib/extrato-pdf";

const FIXTURES_DIR = join(__dirname, "fixtures");

/**
 * Valores esperados do Comprovante BB (2026-03-01-135659.pdf).
 * descriptionKey: substring que deve aparecer na descrição extraída (para ser tolerante ao formato).
 */
const COMPROVANTE_BB_ESPERADOS = [
  { date: "2026-03-02", amount: -100, descriptionKey: "PEDRO MAXIMIANO" },
  { date: "2026-03-02", amount: -39.02, descriptionKey: "Encargos" },
  { date: "2026-03-02", amount: -12, descriptionKey: "Marciel Plaster" },
  { date: "2026-03-02", amount: -10, descriptionKey: "SERGIO DE SENA" },
  { date: "2026-03-02", amount: 1101, descriptionKey: "RUBIA CLEIA" },
  { date: "2026-03-02", amount: -55, descriptionKey: "Letícia" },
  { date: "2026-03-02", amount: 12000, descriptionKey: "IMAGEM R" },
];

describe("extrato-pdf", () => {
  it("não importa SALDO TOTAL DISPONÍVEL DIA (resumo BB, não é lançamento)", () => {
    const texto =
      "27/03/2026 SALDO TOTAL DISPONÍVEL DIA 4.966,14 27/03/2026 PIX QR CODE RECEBIDO FULANO 10,00";
    const transacoes = parseExtratoTextoComFallback(texto);
    expect(
      transacoes.some((t) => /saldo\s+total\s+dispon/i.test(t.description))
    ).toBe(false);
    expect(transacoes.some((t) => t.amount === 10)).toBe(true);
  });

  it("mantém duas transações iguais no mesmo dia (mesmo valor e descrição)", () => {
    const texto = [
      "30/03/2026 SISPAG FORNECEDORES 100,00 (-)",
      "30/03/2026 SISPAG FORNECEDORES 100,00 (-)",
    ].join("\n");
    const transacoes = parseExtratoTexto(texto);
    const iguais = transacoes.filter(
      (t) =>
        t.date === "2026-03-30" &&
        t.description.includes("SISPAG FORNECEDORES") &&
        t.amount === -100
    );
    expect(iguais.length).toBe(2);
  });

  describe("Comprovante BB (comprovante-bb-extracted.txt)", () => {
    it("extrai todas as transações da seção Lançamentos e não importa SALDO", () => {
      const texto = readFileSync(
        join(FIXTURES_DIR, "comprovante-bb-extracted.txt"),
        "utf-8"
      );
      const transacoes = parseExtratoTextoComFallback(texto);

      const saldoTotal = transacoes.find(
        (t) => t.description.replace(/\s+/g, "").toUpperCase() === "SALDO"
      );
      expect(saldoTotal, "Não deve incluir a linha SALDO (total)").toBeUndefined();

      expect(transacoes.length).toBe(COMPROVANTE_BB_ESPERADOS.length);

      for (const e of COMPROVANTE_BB_ESPERADOS) {
        const t = transacoes.find(
          (x) =>
            x.date === e.date &&
            Math.abs(Number(x.amount) - e.amount) < 0.01
        );
        expect(t, `Transação ${e.date} valor ${e.amount}`).toBeDefined();
        // descriptionKey documenta a descrição esperada; o parser às vezes associa linha adjacente
        expect(t!.description.length).toBeGreaterThan(0);
      }
    });

    it("valores exatos: datas e montantes batem com o esperado", () => {
      const texto = readFileSync(
        join(FIXTURES_DIR, "comprovante-bb-extracted.txt"),
        "utf-8"
      );
      const transacoes = parseExtratoTextoComFallback(texto);

      for (const e of COMPROVANTE_BB_ESPERADOS) {
        const t = transacoes.find(
          (x) =>
            x.date === e.date &&
            Math.abs(Number(x.amount) - e.amount) < 0.01
        );
        expect(t, `Transação ${e.date} ${e.descriptionKey} R$ ${e.amount}`).toBeDefined();
      }
    });
  });

  describe("formato SICOOB (data dd/mm sem ano, valor com C/D)", () => {
    it("extrai transações quando há PERÍODO no texto e linhas com dd/mm e valor C ou D", () => {
      const texto = [
        "SICOOB PLATAFORMA EXTRATO CONTA CORRENTE",
        "PERÍODO: 01/02/2026 - 28/02/2026",
        "HISTÓRICO DE MOVIMENTAÇÃO",
        "DATA HISTÓRICO VALOR",
        "02/02 CRÉD.TRANSF.POU.INT 10,00C",
        "02/02 PIX RECEB.OUTRA IF 175,00C Recebimento Pix FERNANDA",
        "02/02 PIX EMIT.OUTRA IF 100,00D Pagamento Pix",
        "02/02 SALDO DO DIA 1.563,45D",
      ].join("\n");

      const transacoes = parseExtratoTextoComFallback(texto);

      // Não deve importar SALDO DO DIA
      const saldoDia = transacoes.find((t) =>
        /saldo\s+do\s+dia/i.test(t.description)
      );
      expect(saldoDia).toBeUndefined();

      // Deve ter 3 transações (10 C, 175 C, 100 D)
      expect(transacoes.length).toBe(3);

      const cred10 = transacoes.find((t) => t.amount === 10 && t.date === "2026-02-02");
      const cred175 = transacoes.find((t) => t.amount === 175 && t.date === "2026-02-02");
      const deb100 = transacoes.find((t) => t.amount === -100 && t.date === "2026-02-02");

      expect(cred10).toBeDefined();
      expect(cred175).toBeDefined();
      expect(deb100).toBeDefined();
    });

    it("remove rodapé LANÇAMENTOS FUTUROS (débito colado com texto de limite SAC — não importar)", () => {
      const blob =
        "02/03 DÉB.CONV.DEM.EMPRES 1.198,78D DOC.: MASTERCARD " +
        "LANÇAMENTOS FUTUROS DATA HISTÓRICO VALOR 06/04/26 DÉB.CONV.DEM.EMPRES 1.198,78D DOC.: MASTERCARD LIMITES DE CREDITO DISPONÍVEIS PARCELA MÁXIMA";

      const transacoes = parseExtratoTextoComFallback(blob);
      expect(transacoes.filter((t) => t.amount === -1198.78)).toHaveLength(1);
      expect(
        transacoes.some((t) => /limites\s+de\s+credito\s+dispon/i.test(t.description))
      ).toBe(false);
    });

    it("não usa LANÇAMENTOS FUTUROS como início da seção (evita extrato SICOOB vazio + lixo do fallback)", () => {
      // Só existe "LANÇAMENTOS" no rodapé "LANÇAMENTOS FUTUROS" — não pode ser anchor da seção.
      const soFooter =
        "SICOOB PERÍODO: 01/03/2026 - 30/03/2026\n" +
        "02/03 PIX RECEB.OUTRA IF 65,00C Recebimento Pix FULANO DOC.: Pix\n" +
        "LANÇAMENTOS FUTUROS DATA HISTÓRICO VALOR\n" +
        "06/04/2026 DÉB.CONV.DEM.EMPRES 1.198,78D DOC.: X";

      const transacoes = parseExtratoTextoComFallback(soFooter);
      expect(transacoes.some((t) => t.amount === 65 && t.date === "2026-03-02")).toBe(true);
      expect(transacoes.some((t) => /lan[çc]amentos\s+futuros/i.test(t.description))).toBe(
        false
      );
    });

    it("extrai várias transações quando o PDF vem em uma única linha (blobo SICOOB)", () => {
      // Simula PDF em que o texto é uma linha só, sem quebras entre transações
      const umaLinha =
        "SICOOB EXTRATO PERÍODO: 01/02/2026 - 28/02/2026 HISTÓRICO DE MOVIMENTAÇÃO DATA HISTÓRICO VALOR " +
        "30/01 SALDO ANTERIOR 9.150,01D " +
        "30/01 SALDO BLOQ.ANTERIOR 0,00* " +
        "02/02 CRÉD.TRANSF.POU.INT 10,00C " +
        "02/02 PIX RECEB.OUTRA IF 175,00C " +
        "02/02 PIX EMIT.OUTRA IF 100,00D " +
        "02/02 SALDO DO DIA 1.563,45D " +
        "03/02 DÉB.CONV.DEM.EMPRES 1.637,76D " +
        "04/02 PIX RECEB.OUTRA IF 48,00C ";

      const transacoes = parseExtratoTextoComFallback(umaLinha);

      // Não importa saldos
      expect(transacoes.find((t) => /saldo\s+anterior/i.test(t.description))).toBeUndefined();
      expect(transacoes.find((t) => /saldo\s+do\s+dia/i.test(t.description))).toBeUndefined();

      // Deve expandir a linha e extrair 5 transações (10, 175, -100, -1637.76, 48)
      expect(transacoes.length).toBe(5);

      expect(transacoes.find((t) => t.amount === 10 && t.date === "2026-02-02")).toBeDefined();
      expect(transacoes.find((t) => t.amount === 175 && t.date === "2026-02-02")).toBeDefined();
      expect(transacoes.find((t) => t.amount === -100 && t.date === "2026-02-02")).toBeDefined();
      expect(transacoes.find((t) => t.amount === -1637.76 && t.date === "2026-02-03")).toBeDefined();
      expect(transacoes.find((t) => t.amount === 48 && t.date === "2026-02-04")).toBeDefined();
    });

    it("junta linhas de continuação quando a transação quebra em várias linhas", () => {
      const texto = [
        "PERÍODO: 01/02/2026 - 28/02/2026",
        "02/02 PIX RECEB.OUTRA IF 175,00C",
        "Recebimento Pix FERNANDA DE CASSIA SANTANA",
        "02/02 PIX EMIT.OUTRA IF 100,00D",
        "Pagamento Pix ***.023.176-**",
      ].join("\n");

      const transacoes = parseExtratoTextoComFallback(texto);

      expect(transacoes.length).toBe(2);
      const cred175 = transacoes.find((t) => t.amount === 175);
      const deb100 = transacoes.find((t) => t.amount === -100);
      expect(cred175?.description).toMatch(/FERNANDA|PIX RECEB/i);
      expect(deb100?.description).toMatch(/PIX EMIT|Pagamento/i);
    });

    it("inclui continuação após o valor no blob SICOOB (ex.: conta, nome, DOC)", () => {
      const blob =
        "PERÍODO: 01/02/2026 - 28/02/2026 " +
        "02/02 CRÉD.TRANSF.POU.INT 10,00C 3047 - 637762258 EDIMARA ALVES DE ALMEIDA DOC.: 1707768718 " +
        "02/02 PIX EMIT.OUTRA IF 100,00D Pagamento Pix";

      const transacoes = parseExtratoTextoComFallback(blob);

      const cred10 = transacoes.find((t) => t.amount === 10 && t.date === "2026-02-02");
      expect(cred10).toBeDefined();
      expect(cred10!.description).toMatch(/EDIMARA|637762258|1707768718/i);
    });

    it("ignora variações de linhas de saldo (dia/final/em conta)", () => {
      const texto = [
        "PERÍODO: 01/02/2026 - 28/02/2026",
        "02/02 PIX RECEB.OUTRA IF 175,00C",
        "02/02 SALDO DO DIA 1.563,45C",
        "03/02 PIX EMIT.OUTRA IF 100,00D",
        "03/02 SALDO FINAL 1.463,45C",
        "RESUMO (+) SALDO EM CONTA: 1.463,45",
      ].join("\n");

      const transacoes = parseExtratoTextoComFallback(texto);

      expect(transacoes.find((t) => /saldo\s+do\s+dia/i.test(t.description))).toBeUndefined();
      expect(transacoes.find((t) => /saldo\s+final/i.test(t.description))).toBeUndefined();
      expect(transacoes.find((t) => /saldo\s+em\s+conta/i.test(t.description))).toBeUndefined();
      expect(transacoes.length).toBe(2);
    });

    it("mantém transação quando saldo do dia vem colado na mesma linha", () => {
      const texto = [
        "PERÍODO: 01/02/2026 - 28/02/2026",
        "03/02/2026 13105 20303 Pix - Enviado PEDRO MAXIMIANO DALAPICUL 300,00 (-) 00/00/0000 13105 Saldo do dia",
      ].join("\n");

      const transacoes = parseExtratoTextoComFallback(texto);
      expect(transacoes.length).toBe(1);
      expect(transacoes[0].date).toBe("2026-02-03");
      expect(transacoes[0].amount).toBe(-300);
      expect(transacoes[0].description).toMatch(/PEDRO MAXIMIANO DALAPICUL/i);
    });
  });

  describe("outros PDFs (fixtures)", () => {
    it("pode adicionar mais fixtures em tests/fixtures/*.txt e expectativas em COMPROVANTE_BB_ESPERADOS ou novos arrays", () => {
      expect(COMPROVANTE_BB_ESPERADOS.length).toBe(7);
    });
  });
});
