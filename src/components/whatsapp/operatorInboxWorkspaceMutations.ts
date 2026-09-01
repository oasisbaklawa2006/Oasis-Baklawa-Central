export const OPERATOR_WORKSPACE_MUTATION_EVENT = "oasis:wa-operator-workspace-mutation";
export const OPERATOR_WORKSPACE_SYNC_ERROR_EVENT = "oasis:wa-operator-workspace-sync-error";
const QUEUE_KEY = "oasis_wa_operator_workspace_pending_mutations_v1";
const MAX_PENDING = 256;

export type OperatorWorkspaceMutation =
  | { id: string; kind: "UPSERT_NOTE"; packetId: string; text: string; createdAt: string }
  | { id: string; kind: "DELETE_NOTE"; packetId: string; createdAt: string }
  | { id: string; kind: "SAVE_VIEW"; viewId: string; name: string; snapshot: Record<string, unknown>; createdAt: string }
  | { id: string; kind: "DELETE_VIEW"; viewId: string; createdAt: string }
  | { id: string; kind: "RECORD_CORRECTION"; packetId: string; field: string; value: unknown; priorValue?: unknown; reason?: string; createdAt: string };

type NewMutation = OperatorWorkspaceMutation extends infer T
  ? T extends OperatorWorkspaceMutation
    ? Omit<T, "id" | "createdAt"> & { id?: string; createdAt?: string }
    : never
  : never;

function newMutationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `waop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isMutation(value: unknown): value is OperatorWorkspaceMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.kind === "string" && typeof row.createdAt === "string";
}

function supersessionKey(mutation: OperatorWorkspaceMutation): string | null {
  if (mutation.kind === "UPSERT_NOTE" || mutation.kind === "DELETE_NOTE") return `note:${mutation.packetId}`;
  if (mutation.kind === "SAVE_VIEW" || mutation.kind === "DELETE_VIEW") return `view:${mutation.viewId}`;
  return null;
}

function compactSupersededMutations(queue: OperatorWorkspaceMutation[]): OperatorWorkspaceMutation[] {
  const lastIndexByKey = new Map<string, number>();
  queue.forEach((mutation, index) => {
    const key = supersessionKey(mutation);
    if (key) lastIndexByKey.set(key, index);
  });
  return queue.filter((mutation, index) => {
    const key = supersessionKey(mutation);
    return !key || lastIndexByKey.get(key) === index;
  });
}

function dispatchQueueError(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPERATOR_WORKSPACE_SYNC_ERROR_EVENT, { detail: { message } }));
}

export function loadPendingOperatorWorkspaceMutations(): OperatorWorkspaceMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMutation) : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: OperatorWorkspaceMutation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "WA_OPERATOR_WORKSPACE_QUEUE_STORAGE_FAILED";
    dispatchQueueError(message);
    throw caught;
  }
}

export function enqueueOperatorWorkspaceMutation(input: NewMutation): OperatorWorkspaceMutation {
  const mutation = {
    ...input,
    id: input.id ?? newMutationId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  } as OperatorWorkspaceMutation;
  if (typeof window === "undefined") return mutation;

  const queue = compactSupersededMutations([...loadPendingOperatorWorkspaceMutations(), mutation]);
  if (queue.length > MAX_PENDING) {
    const message = "WA_OPERATOR_WORKSPACE_QUEUE_FULL: synchronize queued changes before creating more operator workspace mutations.";
    dispatchQueueError(message);
    throw new Error(message);
  }

  persistQueue(queue);
  window.dispatchEvent(new CustomEvent(OPERATOR_WORKSPACE_MUTATION_EVENT, { detail: mutation }));
  return mutation;
}

export function removePendingOperatorWorkspaceMutation(id: string): void {
  if (typeof window === "undefined") return;
  persistQueue(loadPendingOperatorWorkspaceMutations().filter((mutation) => mutation.id !== id));
}

export function operatorWorkspaceMutationIdempotencyKey(mutation: OperatorWorkspaceMutation): string {
  return `waop-ui:${mutation.kind.toLowerCase()}:${mutation.id}`.slice(0, 160);
}
