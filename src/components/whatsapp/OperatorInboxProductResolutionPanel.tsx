import { BrainCircuit, Loader2, Package } from "lucide-react";
import {
  productResolutionBandClassName,
  productResolutionBandLabel,
  summarizeProductResolution,
} from "@/lib/wa-governance/productResolutionDisplay";
import { productResolutionStateMatchesRequestKey } from "@/lib/wa-governance/productResolutionRequestKey";
import type { ProductResolutionAiInterpretation } from "@/lib/wa-governance/productResolutionTypes";
import type { OperatorInboxProductResolutionState } from "./useOperatorInboxProductResolution";

export function OperatorInboxProductResolutionPanel({
  state,
  requestKey = null,
}: {
  state: OperatorInboxProductResolutionState;
  requestKey?: string | null;
}) {
  if (state.status === "idle") return null;
  if (requestKey && state.requestKey !== requestKey) return null;

  return (
    <div
      className="mt-3 rounded-md border border-gray-200 bg-white/90 p-3 shadow-sm"
      role="region"
      aria-label="Product resolution (read-only)"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Product resolution
        <span className="font-normal normal-case text-gray-400">· read-only · not persisted</span>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-green-700" aria-hidden />
          AI is interpreting the B2B evidence packet and resolving likely products…
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-amber-800" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" &&
      (!requestKey || productResolutionStateMatchesRequestKey(state, requestKey)) ? (
        <ProductResolutionReadyBody state={state} />
      ) : null}
    </div>
  );
}

function AiConclusionCard({ interpretation }: { interpretation: ProductResolutionAiInterpretation }) {
  const conclusion = interpretation.conclusion;

  if (!interpretation.usedAi || !conclusion) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
        <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wide">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
          AI B2B conclusion unavailable
        </div>
        <p>
          Deterministic evidence fallback remains active. A human must review the original packet before any business commitment.
        </p>
        {interpretation.error ? <p className="mt-1 font-mono text-[11px]">{interpretation.error}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-gray-800">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-900">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
          AI B2B conclusion
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-900">
          {conclusion.intent.replaceAll("_", " ")}
        </span>
        <span className="text-[11px] text-gray-500">
          AI confidence {Math.round(interpretation.confidence * 100)}%
        </span>
      </div>

      <p className="text-sm leading-5">{conclusion.summary || "No concise conclusion returned."}</p>

      {conclusion.order_lines.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Interpreted order lines</p>
          <ul className="space-y-1 text-xs">
            {conclusion.order_lines.slice(0, 8).map((line, index) => (
              <li key={`${line.product_name}:${line.sku}:${index}`} className="rounded border border-emerald-100 bg-white/80 px-2 py-1.5">
                <span className="font-medium">{line.product_name || line.sku || "Unresolved product"}</span>
                {line.quantity != null ? ` · ${line.quantity}${line.unit ? ` ${line.unit}` : ""}` : " · quantity unresolved"}
                {line.sku ? ` · ${line.sku}` : ""}
                <span className="ml-1 text-gray-500">({line.status})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conclusion.corrections.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Corrections detected</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-gray-700">
            {conclusion.corrections.slice(0, 6).map((correction, index) => (
              <li key={`${correction.provider_message_id}:${index}`}>
                {correction.supersedes ? `${correction.supersedes} → ` : ""}{correction.replacement}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conclusion.ambiguities.length > 0 ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50/80 p-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">Needs clarification</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-900">
            {conclusion.ambiguities.slice(0, 8).map((ambiguity) => <li key={ambiguity}>{ambiguity}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 border-t border-emerald-200 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recommended human action</p>
        <p className="mt-0.5 text-xs">{conclusion.recommended_action || "Review the interpreted packet before deciding."}</p>
        <p className="mt-1 text-[11px] font-medium text-gray-600">
          {conclusion.human_review_required
            ? "Human decision required — AI conclusion is advisory and creates no business commitment."
            : "Human confirmation remains the authority boundary before any commitment-bearing action."}
        </p>
      </div>

      {interpretation.warnings.length > 0 ? (
        <div className="mt-2 text-[11px] text-amber-800">
          {interpretation.warnings.slice(0, 4).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

function ProductResolutionReadyBody({
  state,
}: {
  state: Extract<OperatorInboxProductResolutionState, { status: "ready" }>;
}) {
  const summary = summarizeProductResolution(state.result);
  const { bestMatch, candidateProducts, band, aiInterpretation } = state.result;
  const alternatives = candidateProducts.slice(1, 4);

  return (
    <div className="space-y-3">
      {aiInterpretation ? <AiConclusionCard interpretation={aiInterpretation} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className={productResolutionBandClassName(band)}>
          {productResolutionBandLabel(band)}
        </span>
        {bestMatch ? (
          <span className="text-xs text-gray-500">Catalogue confidence {summary.confidenceLabel}</span>
        ) : null}
      </div>

      <div className="grid gap-2 text-sm text-gray-800 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Catalogue-backed likely product
          </p>
          <p>{summary.likelyProduct}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">SKU</p>
          <p>{summary.skuLabel}</p>
        </div>
      </div>

      {bestMatch?.reasons.length ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Why matched
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-gray-600">
            {bestMatch.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          No confident catalogue match — review the AI conclusion and original evidence, then clarify before any write path is enabled.
        </p>
      )}

      {alternatives.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Alternative catalogue matches
          </p>
          <ul className="space-y-1 text-xs text-gray-600">
            {alternatives.map((candidate) => (
              <li key={candidate.productId}>
                {candidate.productName} · {candidate.confidence}% · {candidate.sku ?? "No SKU"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
