import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Append-only evidence ledger for the disposable Buyer-to-Dispatch journey.
 * Fixed literal path (disposable CI only). Each phase records the authority (role) and the Core RPC that performed it. Nothing here mutates the backend.
 */

export function readLedger() {
  if (!existsSync("/tmp/buyer-to-dispatch-journey-ledger.json")) return { journey: "buyer-to-dispatch", orderId: null, phases: [] };
  return JSON.parse(readFileSync("/tmp/buyer-to-dispatch-journey-ledger.json", "utf8"));
}

/**
 * One writer for every ledger update: write a sibling temp file, then rename, so a failed write keeps the evidence recorded so far.
 * Fixed literal paths on purpose (disposable CI, sequential single-writer scripts).
 */
function writeLedger(ledger) {
  writeFileSync("/tmp/buyer-to-dispatch-journey-ledger.json.tmp", `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  renameSync("/tmp/buyer-to-dispatch-journey-ledger.json.tmp", "/tmp/buyer-to-dispatch-journey-ledger.json");
}

export function recordPhase(name, authority, rpc, detail = {}) {
  const ledger = readLedger();
  // Detail first, fixed fields last: a detail key can never overwrite the phase's own number, name, authority, rpc, status or time.
  const entry = { ...detail, n: ledger.phases.length + 1, name, authority, rpc, status: "PASS", at: new Date().toISOString() };
  ledger.phases.push(entry);
  writeLedger(ledger);
  console.log(`JOURNEY PHASE ${entry.n} ${entry.status}: ${name} [${authority}] ${rpc}`);
}

export function setLedgerOrder(orderId, extra = {}) {
  const ledger = readLedger();
  ledger.orderId = orderId;
  Object.assign(ledger, extra);
  writeLedger(ledger);
}
