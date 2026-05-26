import { textContainsSuppressedTerm } from "@/lib/customer-timeline/customerTimelineSuppression";
import type {
  SearchAuthorityContext,
  SearchIndexEntry,
  SearchIndexSensitivity,
  SearchIndexVisibility,
} from "./searchIndexTypes";

const FINANCE_ESCALATION_TERMS = [
  "finance hold",
  "payment issue",
  "credit issue",
  "escalation",
  "blocker",
  "stock issue",
  "dispatch failure",
  "mismatch",
  "duplicate",
  "rejected",
  "override",
  "governance",
];

function blobContainsUnsafeTerms(parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(" ").toLowerCase();
  if (FINANCE_ESCALATION_TERMS.some((t) => blob.includes(t))) return true;
  return textContainsSuppressedTerm(blob);
}

export function isIndexEntryCustomerSafe(entry: Pick<SearchIndexEntry, "searchTitle" | "searchSubtitle" | "searchBody" | "visibility" | "sensitivity">): boolean {
  if (entry.visibility !== "customer_safe_candidate") return false;
  if (entry.sensitivity !== "normal") return false;
  return !blobContainsUnsafeTerms([entry.searchTitle, entry.searchSubtitle, entry.searchBody]);
}

export function canRoleViewSensitivity(ctx: SearchAuthorityContext, sensitivity: SearchIndexSensitivity): boolean {
  if (sensitivity === "normal") return true;
  if (sensitivity === "restricted") return ctx.canViewRestricted;
  if (sensitivity === "confidential") return ctx.canViewConfidential;
  return false;
}

export function canRoleViewStaffScoped(
  ctx: SearchAuthorityContext,
  entry: Pick<SearchIndexEntry, "department" | "visibility">,
): boolean {
  if (entry.visibility === "internal" || entry.visibility === "customer_safe_candidate") return true;
  if (entry.visibility !== "staff_scoped") return false;
  if (!entry.department) return ctx.canViewRestricted;
  const dept = entry.department.toLowerCase();
  return ctx.departments.some((d) => d.toLowerCase() === dept) || ctx.canViewConfidential;
}

export function filterIndexEntryForAuthority(
  entry: SearchIndexEntry,
  ctx: SearchAuthorityContext,
): { allowed: boolean; reason: string } {
  if (entry.visibility === "customer_safe_candidate" && !isIndexEntryCustomerSafe(entry)) {
    return { allowed: false, reason: "customer_safe_candidate failed suppression" };
  }
  if (!canRoleViewSensitivity(ctx, entry.sensitivity)) {
    return { allowed: false, reason: `sensitivity ${entry.sensitivity} denied for role` };
  }
  if (!canRoleViewStaffScoped(ctx, entry)) {
    return { allowed: false, reason: "staff_scoped department mismatch" };
  }
  return { allowed: true, reason: "ok" };
}

export function sanitizeResultCardText(
  title: string,
  subtitle: string | null,
  visibility: SearchIndexVisibility,
): { title: string; subtitle: string | null } {
  if (visibility === "internal" || visibility === "staff_scoped") {
    return { title, subtitle };
  }
  const safeTitle = blobContainsUnsafeTerms([title]) ? "Order reference" : title;
  const safeSubtitle =
    subtitle && blobContainsUnsafeTerms([subtitle]) ? null : subtitle;
  return { title: safeTitle, subtitle: safeSubtitle };
}
