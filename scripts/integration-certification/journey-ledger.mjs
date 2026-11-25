import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Append-only evidence ledger for the disposable Buyer-to-Dispatch journey.
 * Fixed literal path (disposable CI only). Each phase records the authority (role) and the Core RPC that performed it. Nothing here mutates the backend.
 */

const LEDGER_PATH = "/tmp/buyer-to-dispatch-journey-ledger.json";

export function readLedger() {
  if (!existsSync(LEDGER_PATH)) return { journey: "buyer-to-dispatch", orderId: null, phases: [] };
  return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
}

/** One writer for every ledger update: write a sibling temp file, then rename, so a failed write keeps the evidence recorded so far. */
function writeLedger(ledger) {
  const tempPath = `${LEDGER_PATH}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  renameSync(tempPath, LEDGER_PATH);
}

export function recordPhase(name, authority, rpc, detail = {}) {
  const ledger = readLedger();
  const entry = { n: ledger.phases.length + 1, name, authority, rpc, status: "PASS", at: new Date().toISOString(), ...detail };
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
