import { Loader2, UserSearch } from "lucide-react";
import {
  buildSenderIdentityDisplayLabels,
  formatSenderConfidence,
} from "@/lib/wa-governance/senderIdentityDisplay";
import type { OperatorInboxSenderIdentityState } from "./useOperatorInboxSenderIdentity";

export function OperatorInboxSenderIdentityPanel({
  state,
}: {
  state: OperatorInboxSenderIdentityState;
}) {
  if (state.status === "idle") return null;

  return (
    <div
      className="mt-3 rounded-md border border-gray-200 bg-white/90 p-3 shadow-sm"
      role="region"
      aria-label="Sender identity (read-only)"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <UserSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Sender identity
        <span className="font-normal normal-case text-gray-400">· read-only · not persisted</span>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-green-700" aria-hidden />
          Resolving sender via TOOL 2…
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-amber-800" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <SenderIdentityReadyBody identity={state.identity} />
      ) : null}
    </div>
  );
}

function SenderIdentityReadyBody({
  identity,
}: {
  identity: import("@/lib/wa-governance/senderIdentityTypes").SenderIdentityViewModel;
}) {
  const labels = buildSenderIdentityDisplayLabels(identity);
  const confidenceLabel = formatSenderConfidence(identity.confidence);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={labels.badgeClassName}>{labels.title}</span>
        {confidenceLabel ? (
          <span className="text-xs text-gray-500">Confidence {confidenceLabel}</span>
        ) : null}
      </div>
      <p className="text-sm text-gray-800">{labels.subtitle}</p>
      {identity.normalizedPhone ? (
        <p className="text-xs text-gray-500">Normalized phone: {identity.normalizedPhone}</p>
      ) : null}
      {identity.matchedVia ? (
        <p className="text-xs text-gray-500">Matched via: {identity.matchedVia}</p>
      ) : null}
      {identity.reason && identity.kind === "unknown" ? (
        <p className="text-xs text-gray-500">Reason: {identity.reason.replace(/_/g, " ")}</p>
      ) : null}
      {identity.contactId ? (
        <p className="text-xs text-gray-500">Contact id: {identity.contactId.slice(0, 8)}…</p>
      ) : null}
      {identity.employeeProfile?.id ? (
        <p className="text-xs text-gray-500">User id: {identity.employeeProfile.id.slice(0, 8)}…</p>
      ) : null}
    </div>
  );
}
