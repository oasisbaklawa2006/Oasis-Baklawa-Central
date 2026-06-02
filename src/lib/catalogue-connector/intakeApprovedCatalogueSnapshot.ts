import { createCatalogueConnectorSync } from "./syncApprovedCatalogueProduct";
import type { CatalogueConnectorStore } from "./catalogueConnectorStore";
import type { ApprovedCatalogueProductSnapshot, CatalogueSyncResult } from "./catalogueConnectorTypes";
import {
  validateApprovedCatalogueSnapshot,
  type CatalogueSnapshotValidationError,
} from "./validateApprovedCatalogueSnapshot";

export type CatalogueIntakeResult =
  | { ok: false; validation: { ok: false; errors: CatalogueSnapshotValidationError[] } }
  | { ok: true; snapshot: ApprovedCatalogueProductSnapshot; sync: CatalogueSyncResult };

export async function intakeApprovedCatalogueSnapshot(
  store: CatalogueConnectorStore,
  raw: unknown,
): Promise<CatalogueIntakeResult> {
  const validation = validateApprovedCatalogueSnapshot(raw);
  if (validation.ok === false) {
    return { ok: false as const, validation };
  }

  const sync = createCatalogueConnectorSync(store);
  const syncResult = await sync(validation.snapshot);
  return {
    ok: true as const,
    snapshot: validation.snapshot,
    sync: syncResult,
  };
}
