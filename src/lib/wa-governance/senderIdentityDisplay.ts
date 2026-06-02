import type { SenderIdentityKind, SenderIdentityViewModel } from "./senderIdentityTypes";

export type SenderIdentityDisplayCategory = "internal" | "customer" | "unknown" | "spam";

export interface SenderIdentityDisplayLabels {
  category: SenderIdentityDisplayCategory;
  title: string;
  subtitle: string;
  badgeClassName: string;
}

const BADGE_BASE = "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium";

export function mapSenderKindToDisplayCategory(kind: SenderIdentityKind): SenderIdentityDisplayCategory {
  switch (kind) {
    case "employee":
      return "internal";
    case "customer":
      return "customer";
    case "spam":
      return "spam";
    default:
      return "unknown";
  }
}

export function buildSenderIdentityDisplayLabels(model: SenderIdentityViewModel): SenderIdentityDisplayLabels {
  const category = mapSenderKindToDisplayCategory(model.kind);

  if (category === "internal") {
    const displayName =
      model.employeeProfile?.full_name ||
      model.employeeProfile?.name ||
      "Matched employee";
    const roleBits = [
      model.employeeProfile?.role || model.roleFromEdge,
      model.employeeProfile?.department,
      model.employeeProfile?.designation,
    ].filter(Boolean);
    return {
      category,
      title: "Internal employee",
      subtitle: `${displayName}${roleBits.length ? ` · ${roleBits.join(" · ")}` : ""} · Order Creator candidate`,
      badgeClassName: `${BADGE_BASE} border-blue-200 bg-blue-50 text-blue-900`,
    };
  }

  if (category === "customer") {
    const name = model.customerName || model.companyName || "Matched contact";
    const companySuffix = model.companyName && model.customerName ? ` · ${model.companyName}` : "";
    return {
      category,
      title: "Customer / contact",
      subtitle: `${name}${companySuffix} · Direct customer message`,
      badgeClassName: `${BADGE_BASE} border-green-200 bg-green-50 text-green-900`,
    };
  }

  if (category === "spam") {
    return {
      category,
      title: "Suspicious sender",
      subtitle: "Spam heuristics triggered — review before action",
      badgeClassName: `${BADGE_BASE} border-red-200 bg-red-50 text-red-900`,
    };
  }

  return {
    category,
    title: "Unknown sender",
    subtitle: "Unknown sender — needs clarification",
    badgeClassName: `${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-900`,
  };
}

export function formatSenderConfidence(confidence: number | null): string | null {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  return `${Math.round(confidence * 100)}%`;
}
