import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { FORBIDDEN_STOCK_UI_PATTERNS } from "../stockFinalizationTypes";
import { suppressStockEventFromCustomer } from "../stockFinalizationEvents";
import { LEDGER_IMMUTABLE } from "../stockMovementFinalization";

const root = join(process.cwd(), "src");

function readSrc(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("stock finalization hardening", () => {
  it("ledger is append-only flag", () => {
    expect(LEDGER_IMMUTABLE).toBe(true);
  });

  it("stock events never customer-facing", () => {
    expect(suppressStockEventFromCustomer("x", "stock_consumption_finalized")).toBe(true);
    expect(suppressStockEventFromCustomer("Dispatched", "dispatch_finalized")).toBe(false);
  });

  it("supabase store is sole balance updater in stock-finalization", () => {
    const store = readSrc("lib/stock-finalization/supabaseStockFinalizationStore.ts");
    expect(store).toContain(".update(");
    const service = readSrc("lib/stock-finalization/stockFinalizationService.ts");
    expect(service).not.toContain(".from(");
  });

  it("dashboard forbids silent patterns", () => {
    const board = readSrc("pages/admin/StockFinalizationBoard.tsx");
    for (const p of FORBIDDEN_STOCK_UI_PATTERNS) {
      expect(board).not.toContain(p);
    }
    expect(board).toContain("Finalize consumption");
  });

  it("migration prevents lineage delete", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260526160000_execution_os_phase4g_stock_finalization.sql"),
      "utf8",
    );
    expect(sql).toContain("prevent_stock_consumption_lineage_mutation");
    expect(sql).toContain("inventory_stock_balances");
  });
});
