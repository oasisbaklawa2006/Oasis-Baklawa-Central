import type { SupabaseClient } from "@supabase/supabase-js";
import { PACKET_AI_DEPARTMENTS, type PacketAiDepartment } from "@/lib/wa-governance/packetContentInterpretation";

export type WhatsAppCaseSnapshot = {
  id: string;
  packet_id: string;
  case_type: string;
  status: string;
  accountable_team: string | null;
  accountable_owner_id: string | null;
  accountability_status: string;
  next_action: string | null;
  next_action_due_at: string | null;
  rule_version: string;
};

export type WhatsAppCaseDecisionSnapshot = {
  packetId: string;
  communicationCase: WhatsAppCaseSnapshot | null;
  latestAi: Record<string, unknown> | null;
  identities: Record<string, unknown>[];
  departmentTasks: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

export type AcceptAiRoutingInput = {
  caseId: string;
  accountableTeam: string;
  nextAction: string;
  dueAt: string;
  contributorDepartments: string[];
  idempotencyKey: string;
};

const PACKET_AI_DEPARTMENT_SET = new Set<PacketAiDepartment>(PACKET_AI_DEPARTMENTS);

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function string(value: unknown, max = 1000): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function parseCase(value: unknown): WhatsAppCaseSnapshot | null {
  const item = record(value);
  if (!item) return null;
  const id = string(item.id, 80);
  const packetId = string(item.packet_id, 80);
  const caseType = string(item.case_type, 80);
  const status = string(item.status, 80);
  const accountabilityStatus = string(item.accountability_status, 80);
  const ruleVersion = string(item.rule_version, 160);
  if (!id || !packetId || !caseType || !status || !accountabilityStatus || !ruleVersion) return null;
  return {
    id,
    packet_id: packetId,
    case_type: caseType,
    status,
    accountable_team: string(item.accountable_team, 80),
    accountable_owner_id: string(item.accountable_owner_id, 80),
    accountability_status: accountabilityStatus,
    next_action: string(item.next_action, 1000),
    next_action_due_at: string(item.next_action_due_at, 120),
    rule_version: ruleVersion,
  };
}

type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcInvoker = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

function rpcInvoker(supabase: SupabaseClient): RpcInvoker {
  // Generated database types intentionally lag the forward-only companion Core PR.
  return supabase.rpc.bind(supabase) as unknown as RpcInvoker;
}

export async function fetchWhatsAppCaseDecisionSnapshot(
  supabase: SupabaseClient,
  packetId: string,
): Promise<WhatsAppCaseDecisionSnapshot> {
  const { data, error } = await rpcInvoker(supabase)("whatsapp_get_case_decision_snapshot", {
    p_packet_id: packetId,
  });
  if (error) throw new Error(error.message || "CASE_SNAPSHOT_FAILED");
  const root = record(data) ?? record(Array.isArray(data) ? data[0] : null);
  if (!root) throw new Error("CASE_SNAPSHOT_SHAPE_UNEXPECTED");
  return {
    packetId,
    communicationCase: parseCase(root.case),
    latestAi: record(root.latest_ai),
    identities: records(root.identities),
    departmentTasks: records(root.department_tasks),
    events: records(root.events),
  };
}

export async function acceptWhatsAppAiRouting(
  supabase: SupabaseClient,
  input: AcceptAiRoutingInput,
): Promise<Record<string, unknown>> {
  const team = input.accountableTeam.trim().toUpperCase();
  const nextAction = input.nextAction.trim();
  const dueAt = input.dueAt.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!input.caseId || !team || !nextAction || !dueAt || !idempotencyKey) {
    throw new Error("CASE_ROUTING_FIELDS_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(dueAt))) throw new Error("CASE_ROUTING_DUE_AT_INVALID");
  if (!PACKET_AI_DEPARTMENT_SET.has(team as PacketAiDepartment)) throw new Error("CASE_ROUTING_TEAM_INVALID");

  const contributors = [...new Set(
    input.contributorDepartments
      .map((department) => department.trim().toUpperCase())
      .filter((department): department is PacketAiDepartment =>
        PACKET_AI_DEPARTMENT_SET.has(department as PacketAiDepartment) && department !== team
      ),
  )].slice(0, 12);

  const { data, error } = await rpcInvoker(supabase)("whatsapp_accept_ai_case_routing", {
    p_case_id: input.caseId,
    p_accountable_team: team,
    p_next_action: nextAction,
    p_due_at: dueAt,
    p_contributor_departments: contributors,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message || "CASE_ROUTING_ACCEPT_FAILED");
  const result = record(data) ?? record(Array.isArray(data) ? data[0] : null);
  if (!result) throw new Error("CASE_ROUTING_ACCEPT_SHAPE_UNEXPECTED");
  return result;
}

export function newCaseRoutingIdempotencyKey(caseId: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `operator-ai-routing:${caseId}:${random}`.slice(0, 160);
}
