import { Info, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Message } from "./operatorInboxTypes";
import {
  extractDraftOrderHints,
  localOnlyAiSuggestionPreview,
  uniqueMessageStatuses,
  uniqueProviders,
} from "./operatorInboxUtils";

const GOVERNANCE_HINT =
  "Governed under Sprint C2/C2B: migration history, RLS, and write-path approvals are required before this action is enabled. See docs/SPRINT_C2B_EXECUTION_CHECKLIST.md.";

function DisabledGovernanceAction({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            disabled
            className={cn(
              "inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-dashed border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-400",
            )}
          >
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            {label}
          </button>
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
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/80 px-3 py-2">
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

export function OperatorInboxLocalDraftPreview({ messages }: { messages: Message[] }) {
  const hints = extractDraftOrderHints(messages);
  return (
    <section className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3" aria-labelledby="draft-preview-heading">
      <h4 id="draft-preview-heading" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        Draft order hints (local parse)
      </h4>
      <p className="mt-1 text-[11px] text-gray-500">In-browser only. Does not create or update orders.</p>
      <ul className="mt-2 space-y-1 text-xs text-gray-800">
        {hints.map((h) => (
          <li key={h} className="flex gap-1">
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
  const { headline, bullets } = localOnlyAiSuggestionPreview(messages);
  return (
    <section className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3" aria-labelledby="local-ai-heading">
      <h4 id="local-ai-heading" className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
        AI-style preview (local keywords)
      </h4>
      <p className="mt-1 text-sm font-medium text-indigo-950">{headline}</p>
      <ul className="mt-2 space-y-1 text-xs text-indigo-900/90">
        {bullets.map((b) => (
          <li key={b} className="flex gap-1">
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
