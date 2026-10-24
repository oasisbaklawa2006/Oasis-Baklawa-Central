import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchWhatsAppOwnershipSupervisor, fetchWhatsAppStaffDirectory } from "@/lib/wa-governance/caseDecisionDesk";
import type { WorkQueueContact, WorkQueueStaff, WorkQueueTaskRow } from "./workQueueModel";

/**
 * Read side of the work queue. Everything here is a plain SELECT through RLS
 * (wa.intake.read) plus the read-only staff directory RPC; writes live in caseDecisionDesk.ts.
 */

const ACTIVE_LIMIT = 500;
const COMPLETED_LIMIT = 100;
const ID_CHUNK = 100;

const TASK_COLUMNS =
  "id,case_id,department,assigned_user_id,task_type,instructions,status,due_at,created_at,completed_at," +
  "whatsapp_communication_cases!inner(id,packet_id,company_id,case_type,status,accountable_team,next_action,next_action_due_at)";

type Row = Record<string, unknown>;
type QueryResult = PromiseLike<{ data: unknown; error: { message?: string } | null }>;
type UntypedClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: readonly string[]) => QueryResult & {
        order: (column: string, options?: { ascending?: boolean }) => { limit: (count: number) => QueryResult };
      };
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending?: boolean }) => { limit: (count: number) => QueryResult };
      };
    };
  };
};

function untyped(client: SupabaseClient): UntypedClient {
  // Generated database types lag the case-programme tables; the shapes are validated below.
  return client as unknown as UntypedClient;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseTask(row: Row): WorkQueueTaskRow | null {
  const id = str(row.id);
  const caseId = str(row.case_id);
  const rawCase = row.whatsapp_communication_cases;
  const caseObject = (Array.isArray(rawCase) ? rawCase[0] : rawCase) as Row | null | undefined;
  if (!id || !caseId || !caseObject || typeof caseObject !== "object") return null;
  const packetId = str(caseObject.packet_id);
  const caseRowId = str(caseObject.id);
  if (!packetId || !caseRowId) return null;
  return {
    id,
    case_id: caseId,
    department: str(row.department) ?? "",
    assigned_user_id: str(row.assigned_user_id),
    task_type: str(row.task_type) ?? "",
    instructions: str(row.instructions) ?? "",
    status: str(row.status) ?? "",
    due_at: str(row.due_at),
    created_at: str(row.created_at),
    completed_at: str(row.completed_at),
    whatsapp_communication_cases: {
      id: caseRowId,
      packet_id: packetId,
      company_id: str(caseObject.company_id),
      case_type: str(caseObject.case_type) ?? "UNCLASSIFIED",
      status: str(caseObject.status) ?? "OPEN",
      accountable_team: str(caseObject.accountable_team),
      next_action: str(caseObject.next_action),
      next_action_due_at: str(caseObject.next_action_due_at),
    },
  };
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size));
  return out;
}

async function fetchContacts(client: SupabaseClient, packetIds: readonly string[]): Promise<WorkQueueContact[]> {
  const db = untyped(client);
  const packetToContact = new Map<string, string>();
  for (const ids of chunk(packetIds, ID_CHUNK)) {
    const { data, error } = await (db
      .from("whatsapp_message_packets")
      .select("id,contact_id")
      .in("id", ids) as unknown as QueryResult);
    if (error) throw new Error(error.message || "WORK_QUEUE_PACKETS_FAILED");
    for (const row of (data as Row[] | null) ?? []) {
      const id = str(row.id);
      const contactId = str(row.contact_id);
      if (id && contactId) packetToContact.set(id, contactId);
    }
  }
  const contactById = new Map<string, { name: string | null; phone: string | null }>();
  for (const ids of chunk([...new Set(packetToContact.values())], ID_CHUNK)) {
    const { data, error } = await (db
      .from("whatsapp_contacts")
      .select("id,customer_name,phone_number")
      .in("id", ids) as unknown as QueryResult);
    if (error) throw new Error(error.message || "WORK_QUEUE_CONTACTS_FAILED");
    for (const row of (data as Row[] | null) ?? []) {
      const id = str(row.id);
      if (id) contactById.set(id, { name: str(row.customer_name), phone: str(row.phone_number) });
    }
  }
  return [...packetToContact.entries()].map(([packetId, contactId]) => ({
    packetId,
    customerName: contactById.get(contactId)?.name ?? null,
    phoneNumber: contactById.get(contactId)?.phone ?? null,
  }));
}

export type WorkQueueSnapshot = {
  tasks: WorkQueueTaskRow[];
  contacts: WorkQueueContact[];
  staff: WorkQueueStaff[];
  /** Ownership supervisor (assign / reassign / take over). False when the backend is not released yet. */
  isSupervisor: boolean;
  truncated: boolean;
};

export async function fetchWorkQueueSnapshot(client: SupabaseClient): Promise<WorkQueueSnapshot> {
  const db = untyped(client);
  const [active, completed, staff, isSupervisor] = await Promise.all([
    db
      .from("whatsapp_case_department_tasks")
      .select(TASK_COLUMNS)
      .in("status", ["OPEN", "IN_PROGRESS", "BLOCKED"])
      .order("due_at", { ascending: true })
      .limit(ACTIVE_LIMIT) as unknown as QueryResult,
    db
      .from("whatsapp_case_department_tasks")
      .select(TASK_COLUMNS)
      .eq("status", "COMPLETED")
      .order("completed_at", { ascending: false })
      .limit(COMPLETED_LIMIT) as unknown as QueryResult,
    // The directory only names owners and feeds the assign picker; the queue still works without it.
    fetchWhatsAppStaffDirectory(client).catch((): WorkQueueStaff[] => []),
    fetchWhatsAppOwnershipSupervisor(client).catch(() => false),
  ]);
  if (active.error) throw new Error(active.error.message || "WORK_QUEUE_TASKS_FAILED");
  if (completed.error) throw new Error(completed.error.message || "WORK_QUEUE_COMPLETED_FAILED");

  const activeRows = (active.data as Row[] | null) ?? [];
  const tasks = [...activeRows, ...(((completed.data as Row[] | null) ?? []))]
    .map(parseTask)
    .filter((task): task is WorkQueueTaskRow => task !== null);
  const packetIds = [...new Set(tasks.map((task) => task.whatsapp_communication_cases?.packet_id).filter((id): id is string => Boolean(id)))];
  const contacts = await fetchContacts(client, packetIds);
  return { tasks, contacts, staff, isSupervisor, truncated: activeRows.length >= ACTIVE_LIMIT };
}
