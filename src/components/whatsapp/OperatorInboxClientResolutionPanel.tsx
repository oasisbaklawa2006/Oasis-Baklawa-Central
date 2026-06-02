import { Building2, Loader2 } from "lucide-react";
import {
  clientResolutionBandClassName,
  clientResolutionBandLabel,
  summarizeClientResolution,
} from "@/lib/wa-governance/clientResolutionDisplay";
import type { OperatorInboxClientResolutionState } from "./useOperatorInboxClientResolution";

export function OperatorInboxClientResolutionPanel({
  state,
}: {
  state: OperatorInboxClientResolutionState;
}) {
  if (state.status === "idle") return null;

  return (
    <div
      className="mt-3 rounded-md border border-gray-200 bg-white/90 p-3 shadow-sm"
      role="region"
      aria-label="Client resolution (read-only)"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Client resolution
        <span className="font-normal normal-case text-gray-400">· read-only · not persisted</span>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-green-700" aria-hidden />
          Resolving likely client from message content…
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-amber-800" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? <ClientResolutionReadyBody state={state} /> : null}
    </div>
  );
}

function ClientResolutionReadyBody({
  state,
}: {
  state: Extract<OperatorInboxClientResolutionState, { status: "ready" }>;
}) {
  const summary = summarizeClientResolution(state.result);
  const { bestMatch, candidateClients, band } = state.result;
  const alternatives = candidateClients.slice(1, 4);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={clientResolutionBandClassName(band)}>{clientResolutionBandLabel(band)}</span>
        {bestMatch ? (
          <span className="text-xs text-gray-500">Confidence {summary.confidenceLabel}</span>
        ) : null}
      </div>

      <div className="grid gap-2 text-sm text-gray-800 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Likely client</p>
          <p>{summary.likelyClient}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Likely owner</p>
          <p>{summary.likelyOwner}</p>
        </div>
      </div>

      {bestMatch?.reasons.length ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Why matched</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-gray-600">
            {bestMatch.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          No confident client match — review message and clarify before any write path is enabled.
        </p>
      )}

      {alternatives.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Alternative matches
          </p>
          <ul className="space-y-1 text-xs text-gray-600">
            {alternatives.map((candidate) => (
              <li key={candidate.companyId}>
                {candidate.companyName} · {candidate.confidence}% ·{" "}
                {candidate.ownerName ?? "No owner"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
