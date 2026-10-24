import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkQueueSnapshot } from "./workQueueData";
import type { WorkQueueTaskRow } from "./workQueueModel";

const ME = "11111111-1111-1111-1111-111111111111";
const COLLEAGUE = "22222222-2222-2222-2222-222222222222";
const HOUR = 3_600_000;

let permissions = new Set<string>(["wa.intake.read", "wa.intake.triage"]);
let snapshot: WorkQueueSnapshot;
const fetchSnapshot = vi.fn(async () => snapshot);
const claim = vi.fn(async () => ({ status: "IN_PROGRESS" }));
const assign = vi.fn(async () => ({ status: "OPEN" }));
const release = vi.fn(async () => ({ status: "OPEN" }));
const complete = vi.fn(async () => ({ status: "COMPLETED" }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: ME } }) }));
vi.mock("@/hooks/useWhatsAppPermissions", () => ({
  useWhatsAppPermissions: () => ({ loading: false, has: (key: string) => permissions.has(key) }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./workQueueData", () => ({ fetchWorkQueueSnapshot: () => fetchSnapshot() }));
vi.mock("@/lib/wa-governance/caseDecisionDesk", () => ({
  claimWhatsAppCaseTask: (...args: unknown[]) => claim(...(args as [])),
  assignWhatsAppCaseTask: (...args: unknown[]) => assign(...(args as [])),
  releaseWhatsAppCaseTask: (...args: unknown[]) => release(...(args as [])),
  completeWhatsAppCaseTask: (...args: unknown[]) => complete(...(args as [])),
  newCaseActionIdempotencyKey: (scope: string, id: string) => `${scope}:${id}:key`,
}));

import { WhatsAppWorkQueue } from "./WhatsAppWorkQueue";

function row(id: string, over: Partial<WorkQueueTaskRow> = {}, caseOver: Record<string, unknown> = {}): WorkQueueTaskRow {
  return {
    id,
    case_id: `case-${id}`,
    department: "CUSTOMER_SERVICE",
    assigned_user_id: null,
    task_type: "ACCOUNTABLE_RESPONSE_OWNER",
    instructions: `Summary for ${id}`,
    status: "OPEN",
    due_at: new Date(Date.now() + 8 * HOUR).toISOString(),
    created_at: new Date(Date.now() - HOUR).toISOString(),
    completed_at: null,
    whatsapp_communication_cases: {
      id: `case-${id}`,
      packet_id: `packet-${id}`,
      company_id: null,
      case_type: "ENQUIRY",
      status: "OPEN",
      accountable_team: "CUSTOMER_SERVICE",
      next_action: null,
      next_action_due_at: null,
      ...caseOver,
    },
    ...over,
  };
}

function setSnapshot() {
  snapshot = {
    truncated: false,
    staff: [
      { userId: ME, displayName: "Me Myself", department: null },
      { userId: COLLEAGUE, displayName: "Ravi Kumar", department: "Customer Service" },
    ],
    contacts: [
      { packetId: "packet-open1", customerName: "Asha Traders", phoneNumber: "919830000001" },
      { packetId: "packet-open2", customerName: "Bharat Stores", phoneNumber: "919830000002" },
      { packetId: "packet-mine", customerName: "Mine Co", phoneNumber: "919830000003" },
      { packetId: "packet-wait", customerName: "Waiting Co", phoneNumber: "919830000004" },
      { packetId: "packet-done", customerName: "Done Co", phoneNumber: "919830000005" },
    ],
    tasks: [
      row("open1", { due_at: new Date(Date.now() - HOUR).toISOString() }),
      row("open2", { assigned_user_id: COLLEAGUE, status: "IN_PROGRESS" }, { company_id: "company-1" }),
      row("mine", { assigned_user_id: ME, status: "IN_PROGRESS" }),
      row("wait", { status: "BLOCKED" }),
      row("done", { status: "COMPLETED", completed_at: new Date().toISOString() }),
    ],
  };
}

function renderQueue(props: Partial<React.ComponentProps<typeof WhatsAppWorkQueue>> = {}) {
  const onOpenConversation = vi.fn();
  const onOpenAllConversations = vi.fn();
  render(
    <WhatsAppWorkQueue
      canViewAllConversations={false}
      onOpenConversation={onOpenConversation}
      onOpenAllConversations={onOpenAllConversations}
      {...props}
    />,
  );
  return { onOpenConversation, onOpenAllConversations };
}

beforeEach(() => {
  permissions = new Set(["wa.intake.read", "wa.intake.triage"]);
  setSnapshot();
  fetchSnapshot.mockClear();
  claim.mockReset().mockResolvedValue({ status: "IN_PROGRESS" });
  assign.mockClear();
  release.mockClear();
  complete.mockClear();
});
afterEach(() => cleanup());

describe("WhatsAppWorkQueue", () => {
  it("opens on Needs Action with plain-language cards and no raw identifiers", async () => {
    renderQueue();
    expect(await screen.findByText("Asha Traders")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Needs Action/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bharat Stores")).toBeInTheDocument();
    expect(screen.queryByText("Mine Co")).not.toBeInTheDocument(); // My Tasks
    expect(screen.queryByText("Waiting Co")).not.toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Customer verified")).toBeInTheDocument();
    expect(screen.getByText("Customer not verified")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getAllByText("AI suggestion").length).toBeGreaterThan(0);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain(ME);
    expect(text).not.toContain(COLLEAGUE);
    expect(text).not.toContain("case-open1");
  });

  it("shows tab counts and switches views", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    expect(screen.getByRole("button", { name: /My Tasks/ })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: /My Tasks/ }));
    expect(screen.getByText("Mine Co")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Waiting/ }));
    expect(screen.getByText("Waiting Co")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Completed/ }));
    expect(screen.getByText("Done Co")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });

  it("claims an unassigned task once, with a stable key, and refreshes", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    const card = screen.getByText("Asha Traders").closest("li") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Claim" }));
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    expect(claim.mock.calls[0]).toEqual([{}, { taskId: "open1", idempotencyKey: "queue-claim:open1:key" }]);
    expect(await screen.findByText("Task claimed. It is now in My Tasks.")).toBeInTheDocument();
    await waitFor(() => expect(fetchSnapshot).toHaveBeenCalledTimes(2));
  });

  it("explains a lost claim race in plain language and refreshes", async () => {
    claim.mockRejectedValueOnce(new Error("CASE_TASK_ALREADY_CLAIMED"));
    renderQueue();
    await screen.findByText("Asha Traders");
    const card = screen.getByText("Asha Traders").closest("li") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Claim" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A colleague claimed this task first");
    await waitFor(() => expect(fetchSnapshot).toHaveBeenCalledTimes(2));
  });

  it("offers no ownership actions to read-only staff", async () => {
    permissions = new Set(["wa.intake.read"]);
    renderQueue();
    await screen.findByText("Asha Traders");
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assign|Reassign/ })).not.toBeInTheDocument();
  });

  it("offers Assign and Reassign to managers, not to frontline staff", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    expect(screen.queryByRole("button", { name: /Assign|Reassign/ })).not.toBeInTheDocument();
    cleanup();
    permissions = new Set(["wa.intake.read", "wa.intake.triage", "wa.intake.assign"]);
    renderQueue();
    await screen.findByText("Asha Traders");
    expect(screen.getAllByRole("button", { name: "Assign" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Reassign" }).length).toBeGreaterThan(0);
  });

  it("shows All Conversations only to authorised users", async () => {
    const hidden = renderQueue({ canViewAllConversations: false });
    await screen.findByText("Asha Traders");
    expect(screen.queryByRole("button", { name: "All Conversations" })).not.toBeInTheDocument();
    cleanup();
    const shown = renderQueue({ canViewAllConversations: true });
    await screen.findByText("Asha Traders");
    fireEvent.click(screen.getByRole("button", { name: "All Conversations" }));
    expect(shown.onOpenAllConversations).toHaveBeenCalledTimes(1);
    expect(hidden.onOpenAllConversations).not.toHaveBeenCalled();
  });

  it("requires an outcome before completing an owned task", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    fireEvent.click(screen.getByRole("button", { name: /My Tasks/ }));
    const card = screen.getByText("Mine Co").closest("li") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Complete" }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Complete" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Task outcome"), { target: { value: "Quoted 75 boxes and confirmed delivery" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(complete.mock.calls[0]).toEqual([
      {},
      {
        taskId: "mine",
        responsePayload: { outcome: "Quoted 75 boxes and confirmed delivery", completed_via: "work_queue" },
        idempotencyKey: "queue-complete:mine:key",
      },
    ]);
  });

  it("returns an owned task to the shared queue", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    fireEvent.click(screen.getByRole("button", { name: /My Tasks/ }));
    const card = screen.getByText("Mine Co").closest("li") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /Return to queue/ }));
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
  });

  it("searches across customer, phone and owner", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    fireEvent.change(screen.getByLabelText("Search work queue"), { target: { value: "ravi" } });
    expect(screen.queryByText("Asha Traders")).not.toBeInTheDocument();
    expect(screen.getByText("Bharat Stores")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search work queue"), { target: { value: "nothing like this" } });
    expect(screen.getByText("Nothing needs action right now.")).toBeInTheDocument();
  });

  it("opens the existing conversation console for reply, verification and help", async () => {
    const { onOpenConversation } = renderQueue();
    await screen.findByText("Asha Traders");
    const card = screen.getByText("Asha Traders").closest("li") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /Verify customer \/ Reply/ }));
    expect(onOpenConversation).toHaveBeenCalledWith("packet-open1");
    fireEvent.click(within(card).getByRole("button", { name: "Ask for help" }));
    expect(onOpenConversation).toHaveBeenCalledTimes(2);
  });

  it("lets phone users reveal the secondary filters", async () => {
    renderQueue();
    await screen.findByText("Asha Traders");
    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("reports a load failure without hiding the screen", async () => {
    fetchSnapshot.mockRejectedValueOnce(new Error("WORK_QUEUE_TASKS_FAILED"));
    renderQueue();
    expect(await screen.findByRole("alert")).toHaveTextContent("WORK_QUEUE_TASKS_FAILED");
    expect(screen.getByRole("button", { name: "Refresh work queue" })).toBeEnabled();
  });
});
