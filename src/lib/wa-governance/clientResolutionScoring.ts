import type {
  ClientResolutionConfidenceBand,
  ClientResolutionResult,
  ClientResolutionScoreReason,
  ClientResolutionTextSignals,
  CompanyResolutionRow,
  OwnerProfileRow,
} from "./clientResolutionTypes";
import { companyNameMatchesTerm } from "./clientResolutionSignals";

export const CLIENT_RESOLUTION_SIGNAL_WEIGHTS = {
  exactCompanyNameInText: 0.78,
  partialCompanyNameInText: 0.42,
  whatsappContactCompanyAlias: 0.38,
  whatsappContactCustomerAlias: 0.32,
  gstExactMatch: 0.52,
  phoneOnCompany: 0.4,
  senderPhoneMatch: 0.4,
  b2bApplicationName: 0.22,
  shadowClientExtractedName: 0.18,
  orderReference: 0.35,
  deliveryLocation: 0.18,
  numericCodeWeak: 0.12,
  employeeSenderRelayBoost: 0.18,
} as const;

const MAX_SCORE = 0.98;

function clampScore(score: number): number {
  return Math.min(MAX_SCORE, Math.max(0, score));
}

function addReason(
  bucket: Map<string, ClientResolutionScoreReason[]>,
  companyId: string,
  weight: number,
  reason: string,
): void {
  const list = bucket.get(companyId) ?? [];
  list.push({ companyId, weight, reason });
  bucket.set(companyId, list);
}

export function confidenceBandFromPercent(confidence: number): ClientResolutionConfidenceBand {
  if (confidence >= 95) return "auto_highlight";
  if (confidence >= 70) return "suggested";
  return "needs_clarification";
}

export function formatConfidencePercent(score: number): number {
  return Math.round(clampScore(score) * 100);
}

export interface ScoreClientResolutionInput {
  signals: ClientResolutionTextSignals;
  companies: CompanyResolutionRow[];
  ownerProfiles: Map<string, OwnerProfileRow>;
  waCustomerName?: string | null;
  waCompanyName?: string | null;
  senderPhoneLast10?: string | null;
  senderIsEmployee?: boolean;
  additionalReasons?: Map<string, ClientResolutionScoreReason[]>;
}

export function scoreClientResolutionCandidates(
  input: ScoreClientResolutionInput,
): ClientResolutionResult {
  const reasonsByCompany = new Map<string, ClientResolutionScoreReason[]>();
  const companyById = new Map(input.companies.map((row) => [row.id, row]));

  for (const company of input.companies) {
    for (const term of input.signals.nameCandidates) {
      const match = companyNameMatchesTerm(company.business_name, term);
      if (match === "exact") {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.exactCompanyNameInText,
          `Company name "${term}" appears in message`,
        );
      } else if (match === "partial") {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.partialCompanyNameInText,
          `Partial company name match for "${term}"`,
        );
      }
    }

    if (input.waCompanyName) {
      const aliasMatch = companyNameMatchesTerm(company.business_name, input.waCompanyName);
      if (aliasMatch !== "none") {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.whatsappContactCompanyAlias,
          `WhatsApp contact company alias "${input.waCompanyName}"`,
        );
      }
    }

    if (input.waCustomerName) {
      const aliasMatch = companyNameMatchesTerm(company.business_name, input.waCustomerName);
      if (aliasMatch !== "none") {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.whatsappContactCustomerAlias,
          `WhatsApp contact name "${input.waCustomerName}"`,
        );
      }
    }

    for (const gst of input.signals.gstNumbers) {
      if ((company.gst_number ?? "").toUpperCase() === gst) {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.gstExactMatch,
          `GST number ${gst} matches company record`,
        );
      }
    }

    for (const last10 of input.signals.phoneLast10) {
      const phone = (company.phone ?? "").replace(/\D/g, "");
      const gstPhone = (company.gst_number ?? "").replace(/\D/g, "");
      if (phone.endsWith(last10) || gstPhone.endsWith(last10)) {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.phoneOnCompany,
          `Phone ending ${last10} matches company record`,
        );
      }
    }

    if (input.senderPhoneLast10) {
      const phone = (company.phone ?? "").replace(/\D/g, "");
      const gstPhone = (company.gst_number ?? "").replace(/\D/g, "");
      if (phone.endsWith(input.senderPhoneLast10) || gstPhone.endsWith(input.senderPhoneLast10)) {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.senderPhoneMatch,
          `Sender phone ending ${input.senderPhoneLast10} matches company record`,
        );
      }
    }

    for (const code of input.signals.numericCodes) {
      if (company.id.toLowerCase().startsWith(code.toLowerCase())) {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.numericCodeWeak,
          `Numeric code ${code} weakly matches company id prefix`,
        );
      }
    }

    for (const location of input.signals.locationTokens) {
      const address = `${company.registered_address ?? ""} ${company.business_name}`.toLowerCase();
      if (address.includes(location)) {
        addReason(
          reasonsByCompany,
          company.id,
          CLIENT_RESOLUTION_SIGNAL_WEIGHTS.deliveryLocation,
          `Location token "${location}" matches company address/name`,
        );
      }
    }
  }

  if (input.senderIsEmployee && input.signals.nameCandidates.length > 0) {
    for (const companyId of reasonsByCompany.keys()) {
      addReason(
        reasonsByCompany,
        companyId,
        CLIENT_RESOLUTION_SIGNAL_WEIGHTS.employeeSenderRelayBoost,
        "Employee sender relay — client inferred from message body",
      );
    }
  }

  for (const [companyId, extraReasons] of input.additionalReasons ?? []) {
    for (const reason of extraReasons) {
      addReason(reasonsByCompany, companyId, reason.weight, reason.reason);
    }
  }

  const candidateClients = [...reasonsByCompany.entries()]
    .map(([companyId, reasons]) => {
      const company = companyById.get(companyId);
      if (!company) return null;
      const score = clampScore(reasons.reduce((sum, item) => sum + item.weight, 0));
      const owner = company.account_manager_id
        ? input.ownerProfiles.get(company.account_manager_id)
        : undefined;
      const ownerName = owner?.full_name || owner?.name || null;
      return {
        companyId,
        companyName: company.business_name,
        ownerId: company.account_manager_id,
        ownerName,
        confidence: formatConfidencePercent(score),
        reasons: reasons.map((item) => item.reason),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.confidence - a.confidence || a.companyName.localeCompare(b.companyName));

  const bestMatch = candidateClients[0] ?? null;
  const band = bestMatch
    ? confidenceBandFromPercent(bestMatch.confidence)
    : "needs_clarification";

  return {
    candidateClients,
    bestMatch,
    band,
  };
}
