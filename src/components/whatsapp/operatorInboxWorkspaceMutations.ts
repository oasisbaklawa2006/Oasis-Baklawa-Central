export const OPERATOR_WORKSPACE_MUTATION_EVENT = "oasis:wa-operator-workspace-mutation";
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

export function loadPendingOperatorWorkspaceMutations(): OperatorWorkspaceMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMutation).slice(-MAX_PENDING) : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: OperatorWorkspaceMutation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_PENDING)));
}

export function enqueueOperatorWorkspaceMutation(input: NewMutation): OperatorWorkspaceMutation {
  const mutation = {
    ...input,
    id: input.id ?? newMutationId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  } as OperatorWorkspaceMutation;
  if (typeof window === "undefined") return mutation;
  const queue = loadPendingOperatorWorkspaceMutations();
  queue.push(mutation);
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
