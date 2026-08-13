import { memo, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  History,
  Loader2,
  Save,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { draftOrderDimensionLabel } from "@/lib/wa-governance/draftOrderDisplay";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import { statusLabel } from "@/lib/wa-sales-order-draft/workflowTransitions";
import type { useOperatorInboxSalesOrderDraft } from "./useOperatorInboxSalesOrderDraft";

const GOVERNANCE_BANNER =
  "Governed handoff — persists to sales_order_drafts only. Does not create live Sales Orders, production allocation, dispatch, finance release, or invoices.";

type DraftHookReturn = ReturnType<typeof useOperatorInboxSalesOrderDraft>;

export const OperatorInboxSalesOrderDraftSection = memo(function OperatorInboxSalesOrderDraftSection({
  extracted,
  draftHook,
  extractionReady,
  canManageDraft,
  canPromoteDraft,
}: {
  extracted: ExtractedDraftOrder | null;
  draftHook: DraftHookReturn;
  extractionReady: boolean;
  canManageDraft: boolean;
  canPromoteDraft: boolean;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const {
    state,
    comparisonView,
    approvalReadiness,
    extractionProjectionStale,
    actionPending,
    actionError,
    draftStatus,
    isTerminal,
    isPersistedDraftLoading,
    canShowCreateDraft,
    approveExtractionReady,
    canApproveDraft,
    createDraft,
    submitForReview,
    approveDraft,
    rejectDraft,
    syncOperatorFinal,
    reload,
  } = draftHook;

  const bundle =
    state.status === "ready"
      ? state.bundle
      : state.status === "error"
        ? (state.bundle ?? null)
        : null;
  const isRejected = bundle?.draft.status === "REJECTED";
  const canCreateDraft = extractionReady && Boolean(extracted);

  return (
    <section
      className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 shadow-sm"
      role="region"
      aria-label="Sales order draft handoff"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-950">
          <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Sales order draft
        </h4>
        {draftStatus ? (
          <Badge variant="outline" className="font-normal">
            {statusLabel(draftStatus)}
          </Badge>
        ) : (
          <span className="text-[11px] font-normal normal-case text-indigo-800/80">
            · not yet persisted
          </span>
        )}
      </div>

      <p className="text-[11px] leading-snug text-indigo-900/90">{GOVERNANCE_BANNER}</p>
      {!canManageDraft ? <p className="mt-2 text-[11px] text-amber-900" role="status">Read-only: Core has not granted <code>wa.draft.manage</code>.</p> : null}

      {isPersistedDraftLoading ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-indigo-900">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading persisted draft…
        </div>
      ) : null}

      {state.status === "error" && !bundle ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-amber-900" role="alert">
            {state.message}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={actionPending}
            onClick={() => void reload()}
          >
            Retry loading draft
          </Button>
        </div>
      ) : state.status === "error" ? (
        <p className="mt-2 text-sm text-amber-900" role="alert">
          {state.message}
        </p>
      ) : null}

      {actionError ? (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {actionError}
        </p>
      ) : null}

      {canShowCreateDraft ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={!canManageDraft || !canCreateDraft || actionPending}
            onClick={() => void createDraft()}
          >
            {actionPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-1 h-3 w-3" aria-hidden />
            )}
            Create Sales Order Draft
          </Button>
          {!extractionReady ? (
            <p className="mt-1 text-[11px] text-indigo-800/80">
              Draft extraction must finish before creating a new sales order draft.
            </p>
          ) : null}
        </div>
      ) : bundle ? (
        <>
          <GovernanceSlots draft={bundle.draft} />

          {comparisonView ? <ComparisonView comparison={comparisonView} /> : null}

          {extractionProjectionStale && !isTerminal ? (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-950">
              <p className="font-medium">This draft was created from an older WhatsApp extraction.</p>
              <p className="mt-1">
                You can review the persisted draft read-only, reject it to unblock recovery, then create a
                new draft from the latest extraction after rejection.
              </p>
            </div>
          ) : null}

          {approvalReadiness && !approvalReadiness.valid && bundle.draft.status === "UNDER_REVIEW" ? (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-950">
              <p className="flex items-center gap-1 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Readiness validation — approval blocked
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {approvalReadiness.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes (optional)…"
              className="min-h-[56px] text-xs"
              aria-label="Sales order draft review notes"
              disabled={!canManageDraft || isTerminal || actionPending}
            />
            {bundle.draft.status === "AI_DRAFT" || bundle.draft.status === "UNDER_REVIEW" ? (
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason (required to reject)…"
                className="h-8 text-xs"
                aria-label="Sales order draft rejection reason"
                disabled={!canManageDraft || actionPending}
              />
            ) : null}
          </div>

          {!isTerminal ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-indigo-200/80 pt-3">
              {bundle.draft.status === "AI_DRAFT" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={!canManageDraft || actionPending || !extracted || extractionProjectionStale}
                    onClick={() => void syncOperatorFinal()}
                  >
                    <ArrowRightLeft className="mr-1 h-3 w-3" aria-hidden />
                    Sync operator edits
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!canManageDraft || actionPending || !extracted || extractionProjectionStale}
                    onClick={() => void submitForReview()}
                  >
                    <Send className="mr-1 h-3 w-3" aria-hidden />
                    Submit for review
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    disabled={!canManageDraft || actionPending || !rejectReason.trim()}
                    onClick={() => void rejectDraft(rejectReason, reviewNotes || undefined)}
                  >
                    <XCircle className="mr-1 h-3 w-3" aria-hidden />
                    Reject draft
                  </Button>
                </>
              ) : null}
              {bundle.draft.status === "UNDER_REVIEW" ? (
                <>
                  {!extractionReady || !extracted ? (
                    <p className="w-full text-[11px] text-amber-950">
                      Waiting for latest WhatsApp extraction.
                    </p>
                  ) : null}
                  {extractionProjectionStale ? (
                    <p className="w-full text-[11px] text-amber-950">
                      Cannot approve: draft was created from an older WhatsApp extraction. Reject and
                      create a new draft first.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs border-emerald-300 text-emerald-900 hover:bg-emerald-50"
                    disabled={!canManageDraft || !canPromoteDraft || actionPending || !canApproveDraft || !extractionReady}
                    onClick={() => void approveDraft(reviewNotes || undefined)}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                    Approve for SO
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    disabled={!canManageDraft || actionPending || !rejectReason.trim()}
                    onClick={() => void rejectDraft(rejectReason, reviewNotes || undefined)}
                  >
                    <XCircle className="mr-1 h-3 w-3" aria-hidden />
                    Reject draft
                  </Button>
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-indigo-800/80">
              {isRejected
                ? "Rejected — terminal for this draft. Create a new draft when extraction is ready."
                : "Terminal status — no further workflow actions. Live Sales Order promotion requires a separate explicit human step (not automated in Sprint 9)."}
            </p>
          )}

          {isRejected ? (
            <div className="mt-3 border-t border-indigo-200/80 pt-3">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={!canManageDraft || !canCreateDraft || actionPending}
                onClick={() => void createDraft()}
              >
                {actionPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Save className="mr-1 h-3 w-3" aria-hidden />
                )}
                Create New Draft
              </Button>
              {!extractionReady ? (
                <p className="mt-1 text-[11px] text-indigo-800/80">
                  Draft extraction must finish before creating a new sales order draft.
                </p>
              ) : null}
            </div>
          ) : null}

          {bundle.auditLog.length > 0 ? <AuditTrail entries={bundle.auditLog} /> : null}
        </>
      ) : null}
    </section>
  );
});

function GovernanceSlots({
  draft,
}: {
  draft: {
    client_owner_name: string | null;
    order_creator_name: string | null;
    order_handler_name: string | null;
    approver_name: string | null;
    readiness_dimensions: { dimension: string; score: number; status: string }[];
  };
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-800/80">Governance</p>
        <p className="text-xs">
          Client owner: {draft.client_owner_name ?? "—"} · Creator:{" "}
          {draft.order_creator_name ?? "—"}
        </p>
        <p className="text-xs">
          Handler: {draft.order_handler_name ?? "—"} · Approver: {draft.approver_name ?? "—"}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-800/80">
          Readiness validation
        </p>
        <ul className="space-y-0.5 text-[11px]">
          {draft.readiness_dimensions.map((dimension) => (
            <li key={dimension.dimension}>
              {draftOrderDimensionLabel(
                dimension.dimension as Parameters<typeof draftOrderDimensionLabel>[0],
              )}
              : {dimension.score}% ({dimension.status})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ComparisonView({
  comparison,
}: {
  comparison: NonNullable<DraftHookReturn["comparisonView"]>;
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-indigo-800/80">
        <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
        Comparison — Original · AI · Operator final
      </p>
      <div className="mb-2 rounded border border-indigo-100 bg-white/70 p-2 text-[11px] whitespace-pre-wrap">
        <span className="font-medium text-indigo-900">Original WhatsApp: </span>
        {comparison.originalWhatsAppExcerpt || "(empty)"}
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        <ComparisonColumn title="AI draft" summary={comparison.aiDraftSummary} />
        <ComparisonColumn title="Operator final" summary={comparison.operatorFinalSummary} />
        <div className="rounded border border-indigo-100 bg-white/80 p-2 text-[11px]">
          <p className="font-medium text-indigo-900">Line deltas</p>
          <ul className="mt-1 space-y-1">
            {comparison.lines.map((line) => (
              <li
                key={line.lineIndex}
                className={cn(line.changed && "rounded bg-amber-50/80 px-1")}
              >
                L{line.lineIndex + 1}: AI {line.aiQuantity ?? "—"} {line.aiUnit ?? ""} → Op{" "}
                {line.operatorQuantity ?? "—"} {line.operatorUnit ?? ""}
                {line.originalTextSpan ? (
                  <span className="block text-indigo-800/70">
                    “{line.originalTextSpan.slice(0, 80)}”
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ComparisonColumn({ title, summary }: { title: string; summary: string }) {
  return (
    <div className="rounded border border-indigo-100 bg-white/80 p-2 text-[11px]">
      <p className="font-medium text-indigo-900">{title}</p>
      <p className="mt-1 text-indigo-800/85">{summary}</p>
    </div>
  );
}

function AuditTrail({
  entries,
}: {
  entries: { id: string; action: string; from_status: string | null; to_status: string | null; actor_name: string | null; created_at: string }[];
}) {
  return (
    <div className="mt-3 border-t border-indigo-200/80 pt-3">
      <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-indigo-800/80">
        <History className="h-3.5 w-3.5" aria-hidden />
        Audit trail
      </p>
      <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px]">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded border border-indigo-100 bg-white/60 px-2 py-1">
            <span className="font-medium">{entry.action}</span>
            {entry.from_status || entry.to_status ? (
              <span>
                {" "}
                {entry.from_status ?? "—"} → {entry.to_status ?? "—"}
              </span>
            ) : null}
            <span className="text-indigo-800/70">
              {" "}
              · {entry.actor_name ?? "system"} · {new Date(entry.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
