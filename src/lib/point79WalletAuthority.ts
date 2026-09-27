import type { PaymentFact, PaymentFacts } from "@/lib/order-authority/paymentAuthorityClient";
import { parsePaymentFacts } from "@/lib/order-authority/paymentAuthorityClient";

export type PaymentType = "advance" | "balance" | "adjustment";

export type PaymentRow = {
  paymentId: string;
  status: string;
  paymentType: PaymentType;
  submittedAmount: number;
  verifiedAmount: number | null;
  currency: string | null;
  paymentMode: string | null;
  externalReference: string | null;
  sourceChannel: string | null;
  sourceReference: string | null;
  proofReceivedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
};

export class Point79WalletAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Point79WalletAuthorityError";
  }
}

const PAYMENT_TYPES = new Set<PaymentType>(["advance", "balance", "adjustment"]);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Point79WalletAuthorityError(`Invalid ${field} from Core payment projection`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) {
    throw new Point79WalletAuthorityError(`Invalid ${field} from Core payment projection`);
  }
  return number;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Core projections may surface scalar or single-element array payment_type values. */
export function normalizePaymentType(value: unknown): PaymentType {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Point79WalletAuthorityError(`Ambiguous payment_type projection array: ${String(value)}`);
    }
  }
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
  if (PAYMENT_TYPES.has(normalized as PaymentType)) {
    return normalized as PaymentType;
  }
  throw new Point79WalletAuthorityError(`Unsupported payment_type projection: ${String(candidate)}`);
}

export function projectPaymentRow(raw: Record<string, unknown>): PaymentRow {
  return {
    paymentId: requiredString(raw.payment_id, "payment_id"),
    status: requiredString(raw.status, "payment status"),
    paymentType: normalizePaymentType(raw.payment_type),
    submittedAmount: requiredNumber(raw.submitted_amount, "submitted_amount"),
    verifiedAmount: raw.verified_amount == null ? null : requiredNumber(raw.verified_amount, "verified_amount"),
    currency: optionalString(raw.currency),
    paymentMode: optionalString(raw.payment_mode),
    externalReference: optionalString(raw.external_reference),
    sourceChannel: optionalString(raw.source_channel),
    sourceReference: optionalString(raw.source_reference),
    proofReceivedAt: optionalString(raw.proof_received_at),
    verifiedAt: optionalString(raw.verified_at),
    rejectedAt: optionalString(raw.rejected_at),
  };
}

export function projectPaymentFactsWithCanonicalRows(value: unknown): PaymentFacts & { payments: PaymentRow[] } {
  const facts = parsePaymentFacts(value);
  const rawPayments = value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).payments)
    ? (value as Record<string, unknown>).payments as unknown[]
    : facts.payments.map((payment) => ({
        payment_id: payment.paymentId,
        status: payment.status,
        payment_type: payment.paymentType,
        submitted_amount: payment.submittedAmount,
        verified_amount: payment.verifiedAmount,
        currency: payment.currency,
        payment_mode: payment.paymentMode,
        external_reference: payment.externalReference,
        source_channel: payment.sourceChannel,
        source_reference: payment.sourceReference,
        proof_received_at: payment.proofReceivedAt,
        verified_at: payment.verifiedAt,
        rejected_at: payment.rejectedAt,
      }));

  const payments = rawPayments.map((item) =>
    projectPaymentRow(item && typeof item === "object" ? item as Record<string, unknown> : {}),
  );

  return {
    ...facts,
    payments,
  };
}

export function toCanonicalPaymentFact(row: PaymentRow): PaymentFact {
  return {
    paymentId: row.paymentId,
    status: row.status,
    paymentType: row.paymentType,
    submittedAmount: row.submittedAmount,
    verifiedAmount: row.verifiedAmount,
    currency: row.currency,
    paymentMode: row.paymentMode,
    externalReference: row.externalReference,
    sourceChannel: row.sourceChannel,
    sourceReference: row.sourceReference,
    proofReceivedAt: row.proofReceivedAt,
    verifiedAt: row.verifiedAt,
    rejectedAt: row.rejectedAt,
  };
}
