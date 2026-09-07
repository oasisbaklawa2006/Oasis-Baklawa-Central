/**
 * Point 62 — governed CRM action capture contract.
 * All durable operator writes for calls, notes, promises, and channel intents
 * route through this boundary into Core `client_interactions` authority.
 */

export type CrmActionChannel =
  | "call"
  | "whatsapp"
  | "email"
  | "note"
  | "promise"
  | "visit";

/** Surface that initiated capture — recorded in provenance for audit. */
export type CrmActionSurfaceSource =
  | "central_customer360"
  | "central_sales_dashboard"
  | "central_sales_interactions";

/** How the action entered the capture boundary. */
export type CrmActionSource =
  | "manual"
  | "provider_whatsapp"
  | "intent_only"
  | CrmActionSurfaceSource;

/** Shared actor / scope fields for governed capture inputs. */
export type CrmActionCaptureContext = {
  executiveId: string;
  actorRole?: string | null;
  /** When true, non–sales-executive internal staff may capture for any company. */
  isInternalStaff?: boolean;
  captureSource?: CrmActionSurfaceSource;
  /** Caller-supplied idempotency key; generated when omitted. */
  idempotencyKey?: string;
  /** Companies the actor may write to (sales roster lens). Omit for admin-wide capture. */
  authorizedCompanyIds?: string[];
};

/**
 * Delivery disposition — never claim provider success without canonical result.
 * Manual captures use `not_applicable`; email uses `intent_only` until Core email authority exists.
 */
export type CrmActionDeliveryState =
  | "not_applicable"
  | "intent_only"
  | "pending_provider"
  | "delivered"
  | "failed";

export type CrmActionCaptureFailure =
  | "invalid_company_id"
  | "missing_actor"
  | "missing_notes"
  | "missing_follow_up_date"
  | "unauthorized_company"
  | "provider_unavailable"
  | "insert_failed";

export type CrmManualActionInput = CrmActionCaptureContext & {
  companyId: string;
  channel: CrmActionChannel;
  notes: string;
  outcome?: string | null;
  followUpDate?: string | null;
};

export type CrmWhatsAppManualLogInput = CrmActionCaptureContext & {
  companyId: string;
  notes: string;
  outcome?: string | null;
  followUpDate?: string | null;
};

export type CrmEmailIntentInput = CrmActionCaptureContext & {
  companyId: string;
  subject: string;
  body: string;
  recipientEmail?: string | null;
};

export type CrmWhatsAppProviderInput = CrmActionCaptureContext & {
  to: string;
  message: string;
  companyId: string;
  orderId?: string;
  /** Injected for tests — defaults to production send-whatsapp invoke. */
  sendProvider?: (params: {
    to: string;
    message: string;
    companyId: string;
    orderId?: string;
  }) => Promise<{ success: boolean; error?: string; data?: unknown }>;
};

export type CrmActionCaptureResult =
  | {
      ok: true;
      recordId: string;
      idempotencyKey: string;
      deliveryState: CrmActionDeliveryState;
      deduplicated: boolean;
    }
  | {
      ok: false;
      failure: CrmActionCaptureFailure;
      message: string;
    };

export type CrmActionCaptureRow = {
  company_id: string;
  executive_id: string;
  interaction_type: string;
  notes: string;
  outcome: string | null;
  follow_up_date: string | null;
};
