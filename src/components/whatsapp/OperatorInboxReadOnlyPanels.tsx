import { memo, useId } from "react";
import { formatDistanceToNow } from "date-fns";
import { Info, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Message } from "./operatorInboxTypes";
import type { OperatorInboxObservabilitySnapshot } from "./useOperatorInboxObservability";
import {
  extractDraftOrderHints,
  inferLocalIntentFromText,
  inferPacketHealth,
  localOnlyAiSuggestionPreview,
  medianResponseLagSeconds,
  operatorInboxIntentRowBorderClass,
  selectFailedMessagesForReadOnlyPanel,
  summarizeCustomerActivity,
  uniqueMessageStatuses,
  uniqueProviders,
  type LocalIntentTone,
  type PacketHealth,
} from "./operatorInboxUtils";

const GOVERNANCE_HINT =
  "Governed under Sprint C2/C2B: migration history, RLS, and write-path approvals are required before this action is enabled. See docs/SPRINT_C2B_EXECUTION_CHECKLIST.md.";

function DisabledGovernanceAction({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-disabled="true"
          className={cn(
            "inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-dashed border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1",
          )}
          onClick={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.preventDefault();
          }}
        >
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-snug" side="bottom">
        {GOVERNANCE_HINT}
      </TooltipContent>
    </Tooltip>
  );
}

export function OperatorInboxGovernanceBar() {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/95 px-3 py-2 backdrop-blur-sm"
      role="region"
      aria-label="Governance notice: read-only actions"
    >
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-900">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Read-only controls
      </span>
      <div className="ml-auto flex flex-wrap justify-end gap-2">
        <DisabledGovernanceAction label="Reassign" />
        <DisabledGovernanceAction label="Approve Draft" />
        <DisabledGovernanceAction label="Send Automation" />
      </div>
    </div>
  );
}

export function OperatorInboxPacketBadges({
  packetStatus,
  fragmentCount,
  messages,
}: {
  packetStatus: string;
  fragmentCount: number;
  messages: Message[];
}) {
  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const outbound = messages.filter((m) => m.direction === "outbound").length;
  const statuses = uniqueMessageStatuses(messages);
  const providers = uniqueProviders(messages);

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="font-normal">
        Packet: {packetStatus}
      </Badge>
      <Badge variant="outline" className="font-normal">
        {fragmentCount} frags
      </Badge>
      <Badge variant="outline" className="border-blue-200 bg-blue-50 font-normal text-blue-900">
        In {inbound} / Out {outbound}
      </Badge>
      {statuses.map((st) => (
        <Badge key={st} variant="outline" className="font-normal">
          msg:{st}
        </Badge>
      ))}
      {providers.map((p) => (
        <Badge key={p} variant="outline" className="border-purple-200 bg-purple-50 font-normal text-purple-900">
          {p}
        </Badge>
      ))}
    </div>
  );
}

export function OperatorInboxFailedMessagesReadOnlyPanel({ messages }: { messages: Message[] }) {
  const reactId = useId();
  const headingId = `${reactId}-failed-msgs`;
  const failed = selectFailedMessagesForReadOnlyPanel(messages);
  return (
    <section
      className="rounded-lg border border-red-200 bg-red-50/60 p-3"
      aria-labelledby={headingId}
    >
      <h4 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-red-900">
        Failed delivery (read-only)
      </h4>
      <p className="mt-1 text-[11px] text-red-800/90">
        Outbound <span className="font-mono">operator_reply</span> rows with status <span className="font-medium">failed</span> or{" "}
        <span className="font-medium">error</span> only (same rule as packet health “Send fail”). No resend from this view.
      </p>
      {failed.length === 0 ? (
        <p className="mt-2 text-xs text-red-800/80">No matching failed operator sends in this thread snapshot.</p>
      ) : (
        <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-red-950">
          {failed.map((m) => (
            <li key={String(m.id)} className="rounded border border-red-100 bg-white/80 p-2">
              <p className="font-medium">
                {m.direction} · {m.status ?? "unknown"}
                {m.provider ? ` · ${m.provider}` : ""}
              </p>
              <p className="mt-0.5 line-clamp-2 text-red-900/90">{m.content ?? "(no body)"}</p>
              <p className="mt-1 text-[10px] text-red-700/80">
                {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DisabledGovernanceAction label="Retry blocked" />
      </div>
    </section>
  );
}

export function OperatorInboxLocalDraftPreview({ messages }: { messages: Message[] }) {
  const reactId = useId();
  const headingId = `${reactId}-draft-preview-heading`;
  const hints = extractDraftOrderHints(messages);
  return (
    <section className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3" aria-labelledby={headingId}>
      <h4 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        Draft order hints (local parse)
      </h4>
      <p className="mt-1 text-[11px] text-gray-500">In-browser only. Does not create or update orders.</p>
      <ul className="mt-2 space-y-1 text-xs text-gray-800">
        {hints.map((h, i) => (
          <li key={`${i}-${h}`} className="flex gap-1">
            <span className="text-gray-400" aria-hidden>
              •
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OperatorInboxLocalAiPreviewPanel({ messages }: { messages: Message[] }) {
  const reactId = useId();
  const headingId = `${reactId}-local-ai-heading`;
  const { headline, bullets } = localOnlyAiSuggestionPreview(messages);
  return (
    <section className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3" aria-labelledby={headingId}>
      <h4 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
        AI-style preview (local keywords)
      </h4>
      <p className="mt-1 text-sm font-medium text-indigo-950">{headline}</p>
      <ul className="mt-2 space-y-1 text-xs text-indigo-900/90">
        {bullets.map((b, i) => (
          <li key={`${i}-${b}`} className="flex gap-1">
            <span className="text-indigo-400" aria-hidden>
              •
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OperatorInboxRefreshingBanner({
  isRefreshing,
  refreshError,
}: {
  isRefreshing: boolean;
  refreshError: string | null;
}) {
  if (!isRefreshing && !refreshError) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-3 py-1.5 text-xs",
        refreshError ? "border-red-200 bg-red-50 text-red-800" : "border-green-100 bg-green-50/90 text-green-900",
      )}
      role="status"
      aria-live="polite"
    >
      {refreshError ? (
        <>Realtime refresh failed: {refreshError}</>
      ) : (
        <>Updating conversations…</>
      )}
    </div>
  );
}

const INTENT_TONE_DOT: Record<LocalIntentTone, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
};

export function OperatorInboxIntentDot({
  tone,
  label,
}: {
  tone: LocalIntentTone;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", INTENT_TONE_DOT[tone])} aria-hidden />
      <span className="max-w-[5.5rem] truncate text-[10px] font-medium text-gray-600">{label}</span>
    </span>
  );
}

const HEALTH_BADGE: Record<PacketHealth, { label: string; className: string }> = {
  healthy: { label: "OK", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  needs_reply: { label: "Reply", className: "border-amber-200 bg-amber-50 text-amber-900" },
  stale_open: { label: "Stale", className: "border-orange-300 bg-orange-50 text-orange-950" },
  operator_issue: { label: "Send fail", className: "border-red-200 bg-red-50 text-red-900" },
};

export function OperatorInboxPacketHealthBadge({
  health,
  className,
}: {
  health: PacketHealth;
  className?: string;
}) {
  const cfg = HEALTH_BADGE[health];
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] font-normal", cfg.className, className)}>
      {cfg.label}
    </Badge>
  );
}

export const OperatorInboxObservabilityPanel = memo(function OperatorInboxObservabilityPanel({
  snapshot,
  loading,
  medianLagSecondsFromThreads,
}: {
  snapshot: OperatorInboxObservabilitySnapshot;
  loading: boolean;
  medianLagSecondsFromThreads: number | null;
}) {
  const reactId = useId();
  const headingId = `${reactId}-obs-heading`;
  const detailsId = `${reactId}-obs-partial-details`;
  const fmtLag = (sec: number | null) => {
    if (sec == null) return "—";
    if (sec < 120) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.round(sec / 60)}m`;
    return `${(sec / 3600).toFixed(1)}h`;
  };

  return (
    <section
      className="border-b border-slate-200 bg-slate-50/90 px-3 py-2"
      aria-labelledby={headingId}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          Observability (read-only)
        </h3>
        {loading ? (
          <span className="text-[10px] text-slate-500" role="status" aria-live="polite">
            First load…
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-800 sm:grid-cols-4">
        <div>
          <span className="text-slate-500">Msgs today</span>
          <span className="ml-1 font-semibold tabular-nums">{snapshot.messagesVolumeToday ?? "—"}</span>
        </div>
        <div>
          <span className="text-slate-500">Open packets</span>
          <span className="ml-1 font-semibold tabular-nums">{snapshot.openPacketsPending ?? "—"}</span>
        </div>
        <div>
          <span className="text-slate-500">Classified (sample)</span>
          <span className="ml-1 font-semibold tabular-nums">
            {snapshot.classifiedPacketsSample != null && snapshot.unclassifiedPacketsSample != null
              ? `${snapshot.classifiedPacketsSample}/${snapshot.unclassifiedPacketsSample + snapshot.classifiedPacketsSample}`
              : "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Failed replies</span>
          <span className="ml-1 font-semibold tabular-nums text-red-800">
            {snapshot.failedOperatorReplies ?? "—"}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <span className="text-slate-500">Est. response lag (open threads)</span>
          <span className="ml-1 font-semibold tabular-nums">{fmtLag(medianLagSecondsFromThreads)}</span>
        </div>
      </div>
      {snapshot.providerDistributionToday.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="w-full text-[10px] font-medium text-slate-500">Providers today (sample)</span>
          {snapshot.providerDistributionToday.slice(0, 6).map((p) => (
            <Badge key={p.provider} variant="outline" className="px-1 py-0 text-[10px] font-normal">
              {p.provider}: {p.count}
            </Badge>
          ))}
        </div>
      ) : null}
      {snapshot.partialErrors.length > 0 ? (
        <div className="mt-1.5 rounded border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-[10px] text-amber-950">
          <p className="font-medium text-amber-900" role="status" aria-live="polite">
            Some analytics queries failed ({snapshot.partialErrors.length}). The inbox list still loads; counts below
            may be incomplete.
          </p>
          <details id={detailsId} className="mt-1">
            <summary className="cursor-pointer select-none font-medium text-amber-900 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-1">
              Show error details
            </summary>
            <ul className="mt-1 max-h-28 list-inside list-disc space-y-0.5 overflow-y-auto overscroll-y-contain text-amber-900/90">
              {snapshot.partialErrors.map((err, i) => (
                <li key={`${i}-${err.slice(0, 48)}`} className="break-words">
                  {err}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
});

export function OperatorInboxCustomerActivitySummary({ messages }: { messages: Message[] }) {
  const reactId = useId();
  const headingId = `${reactId}-cust-act`;
  const s = summarizeCustomerActivity(messages);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" aria-labelledby={headingId}>
      <h4 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Customer activity (thread)
      </h4>
      <dl className="mt-2 space-y-1 text-[11px] text-slate-800">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">First → last</dt>
          <dd className="text-right font-medium">
            {s.firstAt ? formatDistanceToNow(new Date(s.firstAt), { addSuffix: true }) : "—"} →{" "}
            {s.lastAt ? formatDistanceToNow(new Date(s.lastAt), { addSuffix: true }) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Span</dt>
          <dd className="tabular-nums">
            {s.spanMinutes != null ? `${Math.round(s.spanMinutes)} min` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">In / out</dt>
          <dd className="tabular-nums">
            {s.inbound} / {s.outbound}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function OperatorInboxLocalExplanationCards({
  messages,
  lastMessageAtIso,
}: {
  messages: Message[];
  lastMessageAtIso: string;
}) {
  const reactId = useId();
  const headingId = `${reactId}-explain-cards`;
  const health = inferPacketHealth(lastMessageAtIso, messages);
  const lagSec = medianResponseLagSeconds(messages);
  const inboundText = messages
    .filter((m) => m.direction === "inbound")
    .map((m) => m.content ?? "")
    .join(" ");
  const intent = inferLocalIntentFromText(inboundText);

  const cards: { title: string; body: string; border: string }[] = [
    {
      title: "Packet health",
      body:
        health === "healthy"
          ? "Last activity looks answered or quiet; no failed operator sends in view."
          : health === "needs_reply"
            ? "Last customer message has no later outbound in this packet — consider replying."
            : health === "stale_open"
              ? "Unanswered for a long idle window — high attention."
              : "At least one operator_reply row shows failed status in this thread.",
      border: "border-l-4 border-l-slate-400",
    },
    {
      title: "Local intent (keywords)",
      body: `Bucket “${intent.label}” from inbound text only — not persisted.`,
      border: operatorInboxIntentRowBorderClass(intent.tone),
    },
  ];

  if (lagSec != null) {
    cards.push({
      title: "Latency pattern",
      body: `Median gap inbound→next outbound in this thread ≈ ${lagSec < 120 ? `${Math.round(lagSec)}s` : `${Math.round(lagSec / 60)}m`}.`,
      border: "border-l-4 border-l-cyan-500",
    });
  }

  return (
    <section aria-labelledby={headingId}>
      <h4 id={headingId} className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Local explanation cards
      </h4>
      <div className="space-y-2">
        {cards.map((c) => (
          <div
            key={c.title}
            className={cn("rounded-md border border-slate-200 bg-white/90 p-2 text-[11px] text-slate-800", c.border)}
          >
            <p className="font-semibold text-slate-900">{c.title}</p>
            <p className="mt-1 leading-snug text-slate-700">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
