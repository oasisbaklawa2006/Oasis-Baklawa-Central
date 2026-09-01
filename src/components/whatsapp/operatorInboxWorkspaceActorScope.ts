const OWNER_KEY = "oasis_wa_operator_workspace_owner_v1";

const ACTOR_SCOPED_KEYS = [
  "oasis_wa_operator_workspace_pending_mutations_v1",
  "oasis_c2b2_operator_inbox_packet_notes_v1",
  "oasis_c2b2_operator_inbox_saved_views_v1",
  "wa_operator_inbox_draft_order_local_v1",
] as const;

function clearActorScopedWorkspaceStorage(): void {
  for (const key of ACTOR_SCOPED_KEYS) window.localStorage.removeItem(key);
}

/**
 * Fail closed on shared-browser operator changes. Local workspace state is only
 * a cache; Core remains authority. Any unowned legacy cache is discarded
 * rather than being attributed to the first user who signs in after upgrade.
 */
export function bindOperatorWorkspaceStorageToActor(actorId: string): void {
  if (typeof window === "undefined") return;
  const normalizedActorId = actorId.trim();
  if (!normalizedActorId) throw new Error("WA_OPERATOR_WORKSPACE_ACTOR_REQUIRED");

  const existingOwner = window.localStorage.getItem(OWNER_KEY);
  const hasLegacyWorkspaceState = ACTOR_SCOPED_KEYS.some((key) => window.localStorage.getItem(key) !== null);
  if (existingOwner !== normalizedActorId && (existingOwner !== null || hasLegacyWorkspaceState)) {
    clearActorScopedWorkspaceStorage();
  }
  window.localStorage.setItem(OWNER_KEY, normalizedActorId);
}
