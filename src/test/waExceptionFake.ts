import { CLOSURE_ITEMS } from "@/lib/wa-governance/waExceptionClosure";

/** In-memory stand-in for the Supabase pieces the exception-closure flow touches. Test-only. */
export interface FakeDb {
  userId: string;
  aal: "aal1" | "aal2";
  canClose: boolean;
  failProofReads: boolean;
  failRunRead: boolean;
  failMessageRead: boolean;
  rpcError: string | null;
  /** When set, the resolve RPC records this actor instead of the signed-in user (simulates a mismatch). */
  attributeTo: string | null;
  messages: Record<string, number>;
  exceptions: Record<string, Record<string, unknown>>;
  calls: Array<{ name: string; args: unknown }>;
  writes: string[];
}

export function freshDb(): FakeDb {
  const exceptions: Record<string, Record<string, unknown>> = {};
  const messages: Record<string, number> = {};
  for (const item of CLOSURE_ITEMS) {
    exceptions[item.exceptionId] = {
      id: item.exceptionId,
      exception_type: "PACKET_WITHOUT_CASE",
      business_object_type: "whatsapp_message_packets",
      business_object_id: item.packetId,
      reconciliation_run_id: item.runId,
      resolved_at: null,
      resolved_by: null,
      resolution: null,
    };
    messages[item.packetId] = item.siblingPacketId ? 0 : 2;
    if (item.siblingPacketId) messages[item.siblingPacketId] = 1;
  }
  return {
    userId: "operator-1",
    aal: "aal2",
    canClose: true,
    failProofReads: false,
    failRunRead: false,
    failMessageRead: false,
    rpcError: null,
    attributeTo: null,
    messages,
    exceptions,
    calls: [],
    writes: [],
  };
}

const jwt = (aal: string) => `h.${btoa(JSON.stringify({ aal })).replace(/=+$/, "")}.s`;

export function makeClient(db: FakeDb) {
  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    db.calls.push({ name, args });
    if (name === "has_step_up_auth") return db.failProofReads ? { data: null, error: { message: "net" } } : { data: db.aal === "aal2", error: null };
    if (name === "has_whatsapp_permission") return db.failProofReads ? { data: null, error: { message: "net" } } : { data: db.aal === "aal2" && db.canClose, error: null };
    if (name === "whatsapp_get_reconciliation_run") {
      if (db.failRunRead) return { data: null, error: { message: "run unreadable" } };
      const runId = args.p_run_id;
      const rows = Object.values(db.exceptions).filter((e) => e.reconciliation_run_id === runId);
      return { data: { run: { id: runId }, exceptions: rows }, error: null };
    }
    if (name === "whatsapp_resolve_reconciliation_exception") {
      if (db.rpcError) return { data: null, error: { message: db.rpcError } };
      const row = db.exceptions[String(args.p_exception_id)];
      if (!row) return { data: null, error: { message: "reconciliation exception not found" } };
      if (!row.resolved_at) {
        row.resolved_at = "2026-10-24T08:00:00Z";
        row.resolved_by = db.attributeTo ?? db.userId;
        row.resolution = args.p_resolution;
      }
      return { data: { ...row }, error: null };
    }
    throw new Error(`unexpected rpc ${name}`);
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: jwt(db.aal), user: { id: db.userId } } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () =>
          db.failProofReads
            ? { data: null, error: { message: "net" } }
            : { data: { currentLevel: db.aal, nextLevel: "aal2" }, error: null },
      },
    },
    rpc,
    from: (table: string) => ({
      select: () => ({
        eq: async (_col: string, value: string) => {
          if (table !== "whatsapp_messages") throw new Error(`unexpected read of ${table}`);
          if (db.failMessageRead) return { count: null, error: { message: "unreadable" } };
          return { count: db.messages[value] ?? 0, error: null };
        },
      }),
      insert: () => {
        db.writes.push(`${table}.insert`);
        throw new Error("direct writes are not allowed");
      },
      update: () => {
        db.writes.push(`${table}.update`);
        throw new Error("direct writes are not allowed");
      },
      delete: () => {
        db.writes.push(`${table}.delete`);
        throw new Error("direct writes are not allowed");
      },
      upsert: () => {
        db.writes.push(`${table}.upsert`);
        throw new Error("direct writes are not allowed");
      },
    }),
  };
}
