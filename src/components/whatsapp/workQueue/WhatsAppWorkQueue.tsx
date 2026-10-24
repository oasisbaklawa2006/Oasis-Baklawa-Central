import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  UserCheck,
  UserPlus,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";
import {
  assignWhatsAppCaseTask,
  claimWhatsAppCaseTask,
  completeWhatsAppCaseTask,
  newCaseActionIdempotencyKey,
  releaseWhatsAppCaseTask,
} from "@/lib/wa-governance/caseDecisionDesk";
import { cn } from "@/lib/utils";
import { fetchWorkQueueSnapshot, type WorkQueueSnapshot } from "./workQueueData";
import {
  DEFAULT_WORK_QUEUE_FILTERS,
  WORK_QUEUE_VIEWS,
  WORK_QUEUE_VIEW_LABELS,
  applyWorkQueueFilters,
  availableActions,
  buildQueueItems,
  countByView,
  departmentsIn,
  humanize,
  needsOverrideReason,
  ownershipErrorMessage,
  type WorkQueueFilters,
  type WorkQueueItem,
  type WorkQueueUrgency,
  type WorkQueueView,
} from "./workQueueModel";

type Props = {
  /** Opens the full conversation console for a packet (reply, verify customer, follow up, ask for help). */
  onOpenConversation: (packetId: string) => void;
  /** Opens the full conversation list. Shown only to authorised users. */
  onOpenAllConversations: () => void;
  canViewAllConversations: boolean;
};

const PRIMARY_ACTION = "bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-700";

const URGENCY_STYLES: Record<WorkQueueUrgency, string> = {
  overdue: "border-red-300 bg-red-50 text-red-800",
  due_soon: "border-amber-300 bg-amber-50 text-amber-900",
  normal: "border-gray-200 bg-gray-50 text-gray-700",
};
const URGENCY_LABELS: Record<WorkQueueUrgency, string> = { overdue: "Overdue", due_soon: "Due soon", normal: "On track" };

function formatDue(dueAt: string | null): string {
  if (!dueAt) return "No due time";
  const parsed = Date.parse(dueAt);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due time";
}

export function WhatsAppWorkQueue({ onOpenConversation, onOpenAllConversations, canViewAllConversations }: Props) {
  const { user } = useAuth();
  const wa = useWhatsAppPermissions();
  const meUserId = user?.id ?? null;
  const can = useMemo(
    () => ({ triage: wa.has("wa.intake.triage"), assign: wa.has("wa.intake.assign") }),
    [wa],
  );

  const [snapshot, setSnapshot] = useState<WorkQueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkQueueFilters>(DEFAULT_WORK_QUEUE_FILTERS);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [assignFor, setAssignFor] = useState<WorkQueueItem | null>(null);
  const [completeFor, setCompleteFor] = useState<WorkQueueItem | null>(null);
  const [releaseFor, setReleaseFor] = useState<WorkQueueItem | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSnapshot(await fetchWorkQueueSnapshot(supabase));
      setNow(Date.now());
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "The work queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = useMemo(
    () =>
      snapshot
        ? buildQueueItems({ tasks: snapshot.tasks, contacts: snapshot.contacts, staff: snapshot.staff, meUserId, now })
        : [],
    [snapshot, meUserId, now],
  );
  const counts = useMemo(() => countByView(items), [items]);
  const visible = useMemo(() => applyWorkQueueFilters(items, filters), [items, filters]);
  const departments = useMemo(() => departmentsIn(items), [items]);

  const run = useCallback(
    async (item: WorkQueueItem, action: () => Promise<unknown>, success: string) => {
      setBusyTaskId(item.taskId);
      setNotice(null);
      try {
        await action();
        setNotice({ tone: "success", message: success });
      } catch (caught) {
        setNotice({ tone: "error", message: ownershipErrorMessage(caught instanceof Error ? caught.message : String(caught)) });
      } finally {
        setBusyTaskId(null);
        await refresh();
      }
    },
    [refresh],
  );

  const onClaim = (item: WorkQueueItem) =>
    run(
      item,
      () => claimWhatsAppCaseTask(supabase, { taskId: item.taskId, idempotencyKey: newCaseActionIdempotencyKey("queue-claim", item.taskId) }),
      "Task claimed. It is now in My Tasks.",
    );
  const releaseNow = (item: WorkQueueItem, why?: string) =>
    run(
      item,
      () =>
        releaseWhatsAppCaseTask(supabase, {
          taskId: item.taskId,
          idempotencyKey: newCaseActionIdempotencyKey("queue-release", item.taskId),
          reason: why,
        }),
      "Task returned to the shared queue.",
    );
  const onRelease = (item: WorkQueueItem) => {
    if (needsOverrideReason(item, meUserId)) {
      setReason("");
      setReleaseFor(item);
      return;
    }
    void releaseNow(item);
  };

  const submitRelease = async () => {
    if (!releaseFor || !reason.trim()) return;
    const target = releaseFor;
    const why = reason;
    setReleaseFor(null);
    await releaseNow(target, why);
    setReason("");
  };

  const submitAssign = async () => {
    if (!assignFor || !assigneeId) return;
    const target = assignFor;
    setAssignFor(null);
    await run(
      target,
      () =>
        assignWhatsAppCaseTask(supabase, {
          taskId: target.taskId,
          assigneeUserId: assigneeId,
          idempotencyKey: newCaseActionIdempotencyKey("queue-assign", target.taskId),
          reason,
        }),
      "Task assigned.",
    );
    setAssigneeId("");
    setReason("");
  };

  const submitComplete = async () => {
    if (!completeFor || !outcome.trim()) return;
    const target = completeFor;
    setCompleteFor(null);
    await run(
      target,
      () =>
        completeWhatsAppCaseTask(supabase, {
          taskId: target.taskId,
          responsePayload: { outcome: outcome.trim(), completed_via: "work_queue" },
          idempotencyKey: newCaseActionIdempotencyKey("queue-complete", target.taskId),
        }),
      "Task completed.",
    );
    setOutcome("");
  };

  if (wa.loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-gray-600" role="status">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Checking your WhatsApp access…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50" data-whatsapp-work-queue>
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900">WhatsApp work queue</h1>
            <p className="text-xs text-gray-600">Claim a task, work it in the conversation, then complete it.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} aria-label="Refresh work queue">
              {loading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1" aria-hidden /> : <RefreshCw className="h-4 w-4 sm:mr-1" aria-hidden />}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1" aria-label="Work queue views">
          {WORK_QUEUE_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, view }))}
              aria-pressed={filters.view === view}
              data-work-queue-view={view}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2",
                filters.view === view ? "border-green-600 bg-green-600 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
              )}
            >
              {WORK_QUEUE_VIEW_LABELS[view]}
              <span className={cn("ml-1.5 rounded-full px-1.5 text-xs", filters.view === view ? "bg-white/25" : "bg-gray-100 text-gray-700")}>
                {counts[view]}
              </span>
            </button>
          ))}
          {canViewAllConversations ? (
            <button
              type="button"
              onClick={onOpenAllConversations}
              data-work-queue-view="all"
              className="shrink-0 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              All Conversations
            </button>
          ) : null}
        </nav>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative flex gap-2 sm:contents">
            <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search customer, phone, summary or owner"
              aria-label="Search work queue"
              className="pl-8"
            />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 sm:hidden"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filters
            </Button>
          </div>
          <div className={cn("gap-2", filtersOpen ? "grid" : "hidden", "sm:contents")}>
          <Select value={filters.department} onValueChange={(department) => setFilters((current) => ({ ...current, department }))}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by department">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {humanize(department)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.urgency}
            onValueChange={(urgency) => setFilters((current) => ({ ...current, urgency: urgency as WorkQueueFilters["urgency"] }))}
          >
            <SelectTrigger className="sm:w-36" aria-label="Filter by urgency">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any urgency</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
              <SelectItem value="normal">On track</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox
              checked={filters.unverifiedOnly}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, unverifiedOnly: checked === true }))}
              aria-label="Show only unverified customers"
            />
            Unverified only
          </label>
          </div>
        </div>
      </header>

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mx-4 mt-3 rounded-md border px-3 py-2 text-sm",
            notice.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          {notice.message}
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {loadError}
        </p>
      ) : null}
      {snapshot?.truncated ? (
        <p className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          Showing the 500 most urgent open tasks. Use search or filters to narrow the list.
        </p>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
        {loading && !snapshot ? (
          <p className="flex items-center text-sm text-gray-600" role="status">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Loading tasks…
          </p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600" role="status">
            <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden />
            {filters.view === "needs_action" ? "Nothing needs action right now." : `No tasks in ${WORK_QUEUE_VIEW_LABELS[filters.view]}.`}
          </div>
        ) : (
          <ul className="mx-auto grid max-w-5xl gap-3">
            {visible.map((item) => (
              <QueueCard
                key={item.taskId}
                item={item}
                busy={busyTaskId === item.taskId}
                actions={availableActions(item, meUserId, can)}
                onOpen={() => onOpenConversation(item.packetId)}
                onClaim={() => void onClaim(item)}
                onRelease={() => onRelease(item)}
                onAssign={() => {
                  setAssigneeId("");
                  setReason("");
                  setAssignFor(item);
                }}
                onComplete={() => {
                  setOutcome("");
                  setCompleteFor(item);
                }}
              />
            ))}
          </ul>
        )}
      </main>

      <Dialog open={assignFor !== null} onOpenChange={(open) => (open ? undefined : setAssignFor(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign task</DialogTitle>
            <DialogDescription>
              {assignFor ? `${assignFor.customerLabel} · ${humanize(assignFor.department)}` : null}
            </DialogDescription>
          </DialogHeader>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger aria-label="Assign to">
              <SelectValue placeholder="Choose a colleague" />
            </SelectTrigger>
            <SelectContent>
              {(snapshot?.staff ?? []).map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.displayName}
                  {member.department ? ` · ${member.department}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {snapshot && snapshot.staff.length === 0 ? (
            <p className="text-xs text-amber-800">No eligible colleagues were returned, so assignment is unavailable.</p>
          ) : null}
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              assignFor !== null && needsOverrideReason(assignFor, meUserId)
                ? "Reason (required: this task belongs to someone else)"
                : "Reason (optional, recorded in the audit trail)"
            }
            maxLength={500}
            aria-label="Assignment reason"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignFor(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitAssign()}
              disabled={!assigneeId || (assignFor !== null && needsOverrideReason(assignFor, meUserId) && !reason.trim())}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={releaseFor !== null} onOpenChange={(open) => (open ? undefined : setReleaseFor(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return task to the shared queue</DialogTitle>
            <DialogDescription>
              {releaseFor ? `${releaseFor.customerLabel} is currently with ${releaseFor.ownerLabel}. A reason is required and is recorded in the audit trail.` : null}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required)" maxLength={500} aria-label="Release reason" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReleaseFor(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitRelease()} disabled={!reason.trim()}>
              Return to queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeFor !== null} onOpenChange={(open) => (open ? undefined : setCompleteFor(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete task</DialogTitle>
            <DialogDescription>
              Say what was done. This is recorded in the audit trail and cannot be edited.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Outcome" maxLength={1000} aria-label="Task outcome" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompleteFor(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitComplete()} disabled={!outcome.trim()}>
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QueueCard({
  item,
  busy,
  actions,
  onOpen,
  onClaim,
  onRelease,
  onAssign,
  onComplete,
}: {
  item: WorkQueueItem;
  busy: boolean;
  actions: ReturnType<typeof availableActions>;
  onOpen: () => void;
  onClaim: () => void;
  onRelease: () => void;
  onAssign: () => void;
  onComplete: () => void;
}) {
  const has = (key: ReturnType<typeof availableActions>[number]) => actions.includes(key);
  const completedView = item.view === "completed";
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm" data-work-queue-task={item.taskId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">{item.customerLabel}</p>
          {item.phoneNumber && item.customerLabel !== `+${item.phoneNumber.replace(/^\+/, "")}` ? (
            <p className="text-xs text-gray-500">+{item.phoneNumber.replace(/^\+/, "")}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("gap-1", item.identity === "verified" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-950")}
          >
            {item.identity === "verified" ? <ShieldCheck className="h-3 w-3" aria-hidden /> : <ShieldQuestion className="h-3 w-3" aria-hidden />}
            {item.identity === "verified" ? "Customer verified" : "Customer not verified"}
          </Badge>
          {!completedView ? (
            <Badge variant="outline" className={cn("gap-1", URGENCY_STYLES[item.urgency])}>
              {item.urgency === "overdue" ? <AlertTriangle className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
              {URGENCY_LABELS[item.urgency]}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Completed
            </Badge>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-800">
        <span
          className="mr-1.5 inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 align-middle text-[11px] font-medium text-violet-900"
          title="Summary and next action are AI suggestions from the case routing. They are not approved until someone acts on them."
        >
          <Sparkles className="h-3 w-3" aria-hidden /> AI suggestion
        </span>
        {item.summary || "No summary available."}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
        <div>
          <dt className="font-medium text-gray-500">Department</dt>
          <dd>{humanize(item.department) || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Owner</dt>
          <dd className={cn(item.ownerUserId ? "text-gray-800" : "font-medium text-amber-800")}>{item.ownerLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Next action</dt>
          <dd>{item.nextAction || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">{completedView ? "Completed" : "Due"}</dt>
          <dd>{formatDue(completedView ? item.completedAt : item.dueAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {has("claim") ? (
          <Button type="button" size="sm" className={PRIMARY_ACTION} onClick={onClaim} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <UserCheck className="mr-1 h-4 w-4" aria-hidden />}
            Claim
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant={has("claim") ? "outline" : "default"}
          className={has("claim") ? undefined : PRIMARY_ACTION}
          onClick={onOpen}
          disabled={busy}
        >
          {completedView ? "Review" : item.identity === "unverified" ? "Verify customer / Reply" : "Reply / Follow up"}
        </Button>
        {has("complete") ? (
          <Button type="button" size="sm" variant="outline" onClick={onComplete} disabled={busy}>
            <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden /> Complete
          </Button>
        ) : null}
        {has("assign") ? (
          <Button type="button" size="sm" variant="outline" onClick={onAssign} disabled={busy}>
            <UserPlus className="mr-1 h-4 w-4" aria-hidden /> {item.ownerUserId ? "Reassign" : "Assign"}
          </Button>
        ) : null}
        {has("release") ? (
          <Button type="button" size="sm" variant="ghost" onClick={onRelease} disabled={busy}>
            <Undo2 className="mr-1 h-4 w-4" aria-hidden /> Return to queue
          </Button>
        ) : null}
        {!completedView ? (
          <Button type="button" size="sm" variant="ghost" onClick={onOpen} disabled={busy} title="Opens the conversation, where escalation and clarification controls live.">
            Ask for help
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export default WhatsAppWorkQueue;
export type { WorkQueueView };
