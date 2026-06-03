import { Hash, Loader2 } from "lucide-react";
import {
  formatQuantityUnitLabel,
  quantityResolutionAlternatives,
  quantityResolutionBandClassName,
  quantityResolutionBandLabel,
  summarizeQuantityResolution,
} from "@/lib/wa-governance/quantityResolutionDisplay";
import { quantityResolutionStateMatchesRequestKey } from "@/lib/wa-governance/quantityResolutionRequestKey";
import type { OperatorInboxQuantityResolutionState } from "./useOperatorInboxQuantityResolution";

export function OperatorInboxQuantityResolutionPanel({
  state,
  requestKey = null,
}: {
  state: OperatorInboxQuantityResolutionState;
  requestKey?: string | null;
}) {
  if (state.status === "idle") return null;
  if (requestKey && state.requestKey !== requestKey) return null;

  return (
    <div
      className="mt-3 rounded-md border border-gray-200 bg-white/90 p-3 shadow-sm"
      role="region"
      aria-label="Quantity resolution (read-only)"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Quantity resolution
        <span className="font-normal normal-case text-gray-400">· read-only · not persisted</span>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-green-700" aria-hidden />
          Extracting quantities from message content…
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-amber-800" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" &&
      (!requestKey || quantityResolutionStateMatchesRequestKey(state, requestKey)) ? (
        <QuantityResolutionReadyBody state={state} />
      ) : null}
    </div>
  );
}

function QuantityResolutionReadyBody({
  state,
}: {
  state: Extract<OperatorInboxQuantityResolutionState, { status: "ready" }>;
}) {
  const summary = summarizeQuantityResolution(state.result);
  const top = state.result.quantities[0];
  const alternatives = quantityResolutionAlternatives(state.result);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={quantityResolutionBandClassName(state.result.band)}>
          {quantityResolutionBandLabel(state.result.band)}
        </span>
        {top ? (
          <span className="text-xs text-gray-500">Confidence {summary.confidenceLabel}</span>
        ) : null}
      </div>

      {top ? (
        <div className="grid gap-2 text-sm text-gray-800 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Quantity</p>
            <p>{top.value}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Unit</p>
            <p>{formatQuantityUnitLabel(top.unit)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Product hint
            </p>
            <p>{top.productHint ?? "—"}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No quantities detected in this packet.</p>
      )}

      {top?.reasons.length ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Why detected
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-gray-600">
            {top.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {alternatives.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Alternative quantities
          </p>
          <ul className="space-y-1 text-xs text-gray-600">
            {alternatives.map((entry, index) => (
              <li key={`${entry.value}-${entry.unit ?? "none"}-${entry.productHint ?? index}`}>
                {entry.value} {formatQuantityUnitLabel(entry.unit)}
                {entry.productHint ? ` · ${entry.productHint}` : ""} · {entry.confidence}%
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
