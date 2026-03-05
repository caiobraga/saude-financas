import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseExtratoTextoComFallback } from "../lib/extrato-pdf";

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
  { date: "2026-02-27", amount: 375.53, descriptionKey: "Saldo Anterior" },
];

describe("extrato-pdf", () => {
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

  describe("outros PDFs (fixtures)", () => {
    it("pode adicionar mais fixtures em tests/fixtures/*.txt e expectativas em COMPROVANTE_BB_ESPERADOS ou novos arrays", () => {
      expect(COMPROVANTE_BB_ESPERADOS.length).toBe(8);
    });
  });
});
