import { describe, it, expect } from "vitest";
import { resolveDashboardPeriod, transactionInPeriod } from "../lib/dashboard-period";

describe("dashboard-period", () => {
  it("default ano atual sem params", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const p = resolveDashboardPeriod({}, now);
    expect(p.dateFrom).toBe("2026-01-01");
    expect(p.dateTo).toBe("2026-12-31");
    expect(p.label).toBe("2026");
    expect(p.fromCustomRange).toBe(false);
  });

  it("ano na query", () => {
    const p = resolveDashboardPeriod({ ano: "2024" }, new Date("2026-01-01"));
    expect(p.dateFrom).toBe("2024-01-01");
    expect(p.dateTo).toBe("2024-12-31");
    expect(p.fromCustomRange).toBe(false);
  });

  it("intervalo de e até", () => {
    const p = resolveDashboardPeriod(
      { de: "2025-03-01", ate: "2025-09-30" },
      new Date("2026-01-01")
    );
    expect(p.dateFrom).toBe("2025-03-01");
    expect(p.dateTo).toBe("2025-09-30");
    expect(p.label).toContain("01/03/2025");
    expect(p.fromCustomRange).toBe(true);
  });

  it("transactionInPeriod", () => {
    expect(transactionInPeriod("2025-06-01", "2025-01-01", "2025-12-31")).toBe(true);
    expect(transactionInPeriod("2024-12-31", "2025-01-01", "2025-12-31")).toBe(false);
  });
});
