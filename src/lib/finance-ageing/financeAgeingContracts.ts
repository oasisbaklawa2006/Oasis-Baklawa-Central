/**
 * Point 81 — ageing / exposure / credit notes / disputes canonical closure.
 * Central read/adaptor contracts only. Canonical finance authority lives in Core.
 */

export const STANDARD_AR_AGEING_BUCKETS = ["current", "1_30", "31_60", "61_90", "over_90"] as const;
export type ArAgeingBucket = (typeof STANDARD_AR_AGEING_BUCKETS)[number];

export type AgeingFactsAvailability = "core_facts" | "upstream_unavailable";

export type ArAgeingBucketAmount = {
  bucket: ArAgeingBucket;
  amount: number;
};

export type CompanyArAgeingFacts = {
  company_id: string;
  as_of_date: string;
  ageing_facts_only: true;
  buckets: ArAgeingBucketAmount[];
  total_outstanding: number;
};

export type CompanyExposureRow = {
  companyId: string;
  businessName: string;
  totalOutstanding: number;
  creditLimit: number | null;
  isFrozen: boolean;
  walletBalance: number | null;
};

export type PortfolioExposureFacts = {
  exposure_facts_only: true;
  as_of_date: string;
  company_count: number;
  total_outstanding: number;
  frozen_company_count: number;
  companies: CompanyExposureRow[];
};

export type LedgerDisputeResolutionInput = {
  disputeId: string;
  ledgerId: string;
  companyId: string;
  resolutionNotes: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
};

export type GovernedWriteAvailability =
  | { available: true }
  | { available: false; prerequisiteRpc: string; reason: string };

/**
 * Precise Core prerequisite contract for Point 81 gaps.
 * Central must not shadow these with local tables or direct DML.
 */
export const POINT81_CORE_PREREQUISITES = {
  arAgeing: {
    rpc: "get_company_ar_ageing_facts_v1",
    args: ["p_company_id", "p_as_of_date?"],
    returns: {
      ageing_facts_only: true,
      company_id: "uuid",
      as_of_date: "date",
      buckets: "ArAgeingBucketAmount[]",
      total_outstanding: "numeric",
    },
    audit: "immutable ageing snapshot reference per company/as_of",
    blocker: "No AR ageing buckets may be computed in Central",
  },
  portfolioExposure: {
    rpc: "get_portfolio_exposure_facts_v1",
    args: ["p_company_ids?"],
    returns: {
      exposure_facts_only: true,
      companies: "CompanyExposureRow[]",
      total_outstanding: "numeric",
    },
    audit: "read-only facts; no client order-sum substitution",
    blocker: "CMD/Sales dashboards must not sum orders.payment_status client-side",
  },
  ledgerDisputeResolve: {
    rpc: "resolve_ledger_dispute_v1",
    args: [
      "p_dispute_id",
      "p_resolution_notes",
      "p_correlation_id",
      "p_idempotency_key",
      "p_actor_id",
    ],
    returns: { dispute_id: "uuid", status: "resolved", audit_event_id: "uuid" },
    audit: "immutable dispute resolution event with ledger binding",
    blocker: "ledger_disputes / bi_monthly_ledgers direct UPDATE forbidden",
  },
  ledgerDisputeRaise: {
    rpc: "raise_ledger_dispute_v1",
    args: ["p_ledger_id", "p_description", "p_raised_via", "p_correlation_id", "p_idempotency_key"],
    returns: { dispute_id: "uuid", status: "open" },
    audit: "WhatsApp / admin ingress must bind to ledger_id + company_id",
    blocker: "Dispute ingress without canonical document authority",
  },
  creditNoteIssue: {
    rpc: "issue_credit_note_v1",
    args: ["p_company_id", "p_amount", "p_reference_document_id", "p_reason", "p_correlation_id", "p_idempotency_key", "p_actor_id"],
    returns: { credit_note_id: "uuid", document_number: "text" },
    audit: "immutable credit note document with statement binding",
    blocker: "Payment mode label 'Credit Note' is not document authority",
  },
  debitNoteIssue: {
    rpc: "issue_debit_note_v1",
    args: ["p_company_id", "p_amount", "p_reference_document_id", "p_reason", "p_correlation_id", "p_idempotency_key", "p_actor_id"],
    returns: { debit_note_id: "uuid", document_number: "text" },
    audit: "immutable debit note document with statement binding",
    blocker: "DPL variance debit labels are not debit-note authority",
  },
  refundIssue: {
    rpc: "issue_refund_authority_v1",
    args: ["p_company_id", "p_amount", "p_source_reference", "p_reason", "p_correlation_id", "p_idempotency_key", "p_actor_id"],
    returns: { refund_id: "uuid", wallet_entry_id: "uuid?" },
    audit: "refund document binds to wallet/statement entries",
    blocker: "Return wallet credit without refund document authority",
  },
} as const;
