import { memo, useCallback, useEffect, useId, useState } from "react";
import { FileText, Loader2, Pencil, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  draftOrderDimensionLabel,
  draftOrderReadinessBandClass,
  draftOrderReadinessBandLabel,
  summarizeDraftOrder,
} from "@/lib/wa-governance/draftOrderDisplay";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import {
  clearDraftOrderLocalEdits,
  getDraftOrderLocalEdits,
  setDraftOrderLocalDecision,
} from "./operatorInboxDraftOrderLocalState";
import type { OperatorInboxDraftOrderExtractionState } from "./useOperatorInboxDraftOrderExtraction";

const LOCAL_WORKFLOW_HINT =
  "Local workflow only — Approve/Reject/Edit does not create Sales Orders, deduct inventory, or post finance entries.";

export const OperatorInboxDraftOrderPanel = memo(function OperatorInboxDraftOrderPanel({
  state,
  requestKey = null,
  packetId,
  lineQuantities,
  onLineQuantityChange,
  onLineQuantitiesReset,
  quantityEditsLocked = false,
}: {
  state: OperatorInboxDraftOrderExtractionState;
  requestKey?: string | null;
  packetId: string;
  lineQuantities: Record<number, number>;
  onLineQuantityChange: (lineIndex: number, quantity: number) => void;
  onLineQuantitiesReset: () => void;
  quantityEditsLocked?: boolean;
}) {
  const reactId = useId();
  const headingId = `${reactId}-draft-order-heading`;
  const [editMode, setEditMode] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);

  useEffect(() => {
    setEditMode(false);
  }, [packetId]);

  useEffect(() => {
    if (quantityEditsLocked) {
      setEditMode(false);
    }
  }, [quantityEditsLocked]);

  const refreshLocal = useCallback(() => setLocalRevision((n) => n + 1), []);

  if (state.status === "idle") return null;
  if (requestKey && state.requestKey !== requestKey) return null;

  const localEdits = getDraftOrderLocalEdits(packetId);
  const mergedLineQuantities = { ...localEdits.lineQuantities, ...lineQuantities };
  void localRevision;

  const draft = state.draft;
  const summary = summarizeDraftOrder(draft);

  return (
    <section
      className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 shadow-sm"
      role="region"
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 id={headingId} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-950">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Draft order extraction
        </h4>
        <span className="text-[11px] font-normal normal-case text-teal-800/80">
          · read-only · not persisted to orders
        </span>
      </div>

      <p className="text-[11px] leading-snug text-teal-900/90">{LOCAL_WORKFLOW_HINT}</p>

      {state.status === "loading" ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-teal-900">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Waiting for WA-04A / WA-05A / WA-06A resolution…
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-2 text-sm text-amber-900" role="alert">
          Upstream resolution error: {state.message}
        </p>
      ) : null}

      {(state.status === "ready" || state.status === "error") && (
        <DraftOrderBody
          draft={draft}
          summary={summary}
          editMode={editMode && !quantityEditsLocked}
          localEdits={localEdits}
          lineQuantities={mergedLineQuantities}
          onQuantityChange={(lineIndex, qty) => {
            if (quantityEditsLocked) return;
            onLineQuantityChange(lineIndex, qty);
            refreshLocal();
          }}
        />
      )}

      {state.status !== "loading" ? (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-teal-200/80 pt-3">
        <Button
          type="button"
          size="sm"
          variant={editMode ? "secondary" : "outline"}
          className="h-8 text-xs"
          disabled={quantityEditsLocked}
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
        >
          <Pencil className="mr-1 h-3 w-3" aria-hidden />
          {editMode ? "Done editing" : "Edit (local)"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={localEdits.decision === "approved" ? "default" : "outline"}
          className="h-8 text-xs border-emerald-300 text-emerald-900 hover:bg-emerald-50"
          onClick={() => {
            setDraftOrderLocalDecision(packetId, "approved");
            refreshLocal();
          }}
        >
          <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
          Approve (local)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={localEdits.decision === "rejected" ? "destructive" : "outline"}
          className="h-8 text-xs"
          onClick={() => {
            setDraftOrderLocalDecision(packetId, "rejected");
            refreshLocal();
          }}
        >
          <XCircle className="mr-1 h-3 w-3" aria-hidden />
          Reject (local)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-teal-800"
          onClick={() => {
            clearDraftOrderLocalEdits(packetId);
            onLineQuantitiesReset();
            setEditMode(false);
            refreshLocal();
          }}
        >
          Reset local
        </Button>
        {localEdits.decision !== "pending" ? (
          <Badge variant="outline" className="font-normal capitalize">
            Local decision: {localEdits.decision}
          </Badge>
        ) : null}
        {quantityEditsLocked ? (
          <p className="w-full text-[11px] text-teal-900/80">
            Quantity edits are locked while the sales order draft is under review or terminal.
          </p>
        ) : null}
      </div>
      ) : null}
    </section>
  );
});

function DraftOrderBody({
  draft,
  summary,
  editMode,
  localEdits,
  lineQuantities,
  onQuantityChange,
}: {
  draft: ExtractedDraftOrder;
  summary: ReturnType<typeof summarizeDraftOrder>;
  editMode: boolean;
  localEdits: ReturnType<typeof getDraftOrderLocalEdits>;
  lineQuantities: Record<number, number>;
  onQuantityChange: (lineIndex: number, qty: number) => void;
}) {
  return (
    <div className="mt-3 space-y-3 text-sm text-teal-950">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{summary.headline}</span>
        <span
          className={cn(
            "inline-flex rounded border px-2 py-0.5 text-xs font-medium",
            draftOrderReadinessBandClass(draft.readiness.overallScore),
          )}
        >
          Readiness {summary.readinessLabel}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800/80">Client (WA-04A)</p>
          <p>{summary.clientLabel}</p>
          {draft.client.ownerName ? (
            <p className="text-xs text-teal-800/70">Owner: {draft.client.ownerName}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800/80">Governance slots</p>
          <p className="text-xs">
            Creator: {draft.governance.orderCreatorName ?? "—"} · Handler:{" "}
            {draft.governance.orderHandlerName ?? "—"}
          </p>
        </div>
      </div>

      {draft.readiness.dimensions.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-800/80">
            Order readiness scoring
          </p>
          <ul className="space-y-1.5">
            {draft.readiness.dimensions.map((dimension) => (
              <li key={dimension.dimension} className="rounded border border-teal-100 bg-white/70 px-2 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium">{draftOrderDimensionLabel(dimension.dimension)}</span>
                  <span className="text-xs text-teal-800/80">
                    {dimension.score}% · {draftOrderReadinessBandLabel(dimension.score)} · {dimension.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-teal-900/80">{dimension.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft.lineItems.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-800/80">Product lines</p>
          <ul className="space-y-2">
            {draft.lineItems.map((line) => {
              const displayQty =
                lineQuantities[line.lineIndex] ??
                localEdits.lineQuantities[line.lineIndex] ??
                line.normalizedQuantity ??
                line.rawQuantity;
              return (
                <li key={line.lineIndex} className="rounded border border-teal-100 bg-white/80 p-2 text-xs">
                  <p className="font-medium">
                    {line.productName}
                    {line.sku ? ` · ${line.sku}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {editMode ? (
                      <label className="flex items-center gap-1">
                        <span className="text-teal-800/70">Qty</span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-7 w-20 text-xs"
                          value={displayQty}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              onQuantityChange(line.lineIndex, parsed);
                            }
                          }}
                          aria-label={`Local edit quantity for line ${line.lineIndex + 1}`}
                        />
                        <span>{line.normalizedUnit ?? line.rawUnit ?? "unit"}</span>
                      </label>
                    ) : (
                      <span>
                        Qty {displayQty} {line.normalizedUnit ?? line.rawUnit ?? "unit"}
                      </span>
                    )}
                    <span className="text-teal-800/70">
                      conf {line.productConfidence ?? "—"}% / {line.quantityConfidence}%
                    </span>
                  </div>
                  {line.originalTextSpan ? (
                    <p className="mt-1 text-[11px] text-teal-900/70">
                      Original: “{line.originalTextSpan.slice(0, 120)}”
                    </p>
                  ) : null}
                  {line.conversionExplanation ? (
                    <p className="mt-1 text-[11px] text-teal-900/80">{line.conversionExplanation}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-teal-900/80">No product lines extracted yet.</p>
      )}

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-800/80">Original text (excerpt)</p>
        <p className="max-h-24 overflow-y-auto rounded border border-teal-100 bg-white/60 p-2 text-[11px] whitespace-pre-wrap">
          {draft.sourceText.slice(0, 600) || "(empty)"}
          {draft.sourceText.length > 600 ? "…" : ""}
        </p>
      </div>

      {draft.conversionSummary.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-800/80">Conversion explanation</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-teal-900/85">
            {draft.conversionSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft.governance.preservationNotes.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-800/80">Governance preservation</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-teal-900/85">
            {draft.governance.preservationNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
