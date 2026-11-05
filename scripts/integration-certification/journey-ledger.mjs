import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Append-only evidence ledger for the disposable Buyer-to-Dispatch journey.
 * Each phase records the authority (role) and the Core RPC that performed it. Nothing here mutates the backend.
 */
export const LEDGER_FILE = process.env.JOURNEY_LEDGER_FILE?.trim() || "/tmp/buyer-to-dispatch-journey-ledger.json";

export function readLedger() {
  if (!existsSync(LEDGER_FILE)) return { journey: "buyer-to-dispatch", orderId: null, phases: [] };
  return JSON.parse(readFileSync(LEDGER_FILE, "utf8"));
}

export function recordPhase(name, authority, rpc, detail = {}) {
  const ledger = readLedger();
  ledger.phases.push({ n: ledger.phases.length + 1, name, authority, rpc, status: "PASS", at: new Date().toISOString(), ...detail });
  writeFileSync(LEDGER_FILE, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  console.log(`JOURNEY PHASE ${ledger.phases.length} PASS: ${name} [${authority}] ${rpc}`);
}

export function setLedgerOrder(orderId, extra = {}) {
  const ledger = readLedger();
  ledger.orderId = orderId;
  Object.assign(ledger, extra);
  writeFileSync(LEDGER_FILE, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}
