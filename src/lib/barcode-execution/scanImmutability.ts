/** Guards against accidental scan record mutation in application code. */

export function assertScanAppendOnlyMutation(op: "insert" | "update" | "delete"): void {
  if (op !== "insert") {
    throw new Error(`operational_scan_records are append-only; ${op} is forbidden`);
  }
}
