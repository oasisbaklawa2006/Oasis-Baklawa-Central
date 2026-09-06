import type { RealtimeDomain, RealtimeScope, RealtimeScopeGuardResult, RealtimeScopeType } from "./types";

const CHANNEL_PREFIX = "central";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Domains that may never use silent global_staff without explicit staff route context. */
const TENANT_SENSITIVE_DOMAINS = new Set<RealtimeDomain>([
  "notifications",
  "notification_outbox",
]);

export const REALTIME_DOMAIN_ALLOWED_SCOPES: Record<RealtimeDomain, RealtimeScopeType[]> = {
  orders: ["global_staff", "company", "order"],
  companies: ["global_staff"],
  order_items: ["global_staff", "company", "order"],
  b2b_applications: ["global_staff"],
  notifications: ["user"],
  notification_outbox: ["user"],
  whatsapp_packets: ["global_staff"],
  products: ["global_staff"],
  suggested_orders: ["global_staff"],
  audit_logs: ["global_staff"],
  factory_inventory: ["global_staff"],
  debug_webhooks: ["global_staff"],
  postgres_table: ["global_staff"],
};

export function isSupportedRealtimeDomain(domain: string): domain is RealtimeDomain {
  return Object.prototype.hasOwnProperty.call(REALTIME_DOMAIN_ALLOWED_SCOPES, domain);
}

function isResolvableId(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && UUID_RE.test(value.trim());
}

export function assertRealtimeScope(scope: RealtimeScope): void {
  const result = validateRealtimeScope(scope);
  if (result.allowed !== true) {
    throw new Error(result.reason);
  }
}

export function validateRealtimeScope(scope: RealtimeScope): RealtimeScopeGuardResult {
  switch (scope.type) {
    case "global_staff":
      if (scope.tableName != null && scope.tableName.trim().length === 0) {
        return {
          allowed: false,
          reason: "Realtime postgres_table scope requires a non-empty tableName — fail closed.",
        };
      }
      return {
        allowed: true,
        channelName: scope.tableName?.trim() ? `staff:${scope.tableName.trim()}` : "staff",
      };
    case "company":
      if (!isResolvableId(scope.companyId)) {
        return {
          allowed: false,
          reason: "Realtime scope company requires a valid company_id — fail closed.",
        };
      }
      return { allowed: true, channelName: scope.companyId!.trim() };
    case "user":
      if (!isResolvableId(scope.userId)) {
        return {
          allowed: false,
          reason: "Realtime scope user requires a valid user_id — fail closed.",
        };
      }
      return { allowed: true, channelName: scope.userId!.trim() };
    case "order":
      if (!isResolvableId(scope.orderId)) {
        return {
          allowed: false,
          reason: "Realtime scope order requires a valid order_id — fail closed.",
        };
      }
      return { allowed: true, channelName: scope.orderId!.trim() };
    default:
      return { allowed: false, reason: `Unsupported realtime scope type: ${String(scope.type)}` };
  }
}

export function assertAuthorizedRealtimeChannel(
  domain: RealtimeDomain,
  scope: RealtimeScope,
): RealtimeScopeGuardResult {
  if (!isSupportedRealtimeDomain(domain)) {
    return { allowed: false, reason: `Unsupported realtime domain: ${domain}` };
  }

  if (domain === "postgres_table" && !scope.tableName?.trim()) {
    return {
      allowed: false,
      reason: "postgres_table domain requires scope.tableName — fail closed.",
    };
  }

  const scopeResult = validateRealtimeScope(scope);
  if (scopeResult.allowed !== true) {
    return scopeResult;
  }

  const allowedScopes = REALTIME_DOMAIN_ALLOWED_SCOPES[domain];
  if (!allowedScopes.includes(scope.type)) {
    return {
      allowed: false,
      reason: `Domain ${domain} does not permit scope type ${scope.type} — fail closed.`,
    };
  }

  if (TENANT_SENSITIVE_DOMAINS.has(domain) && scope.type === "global_staff") {
    return {
      allowed: false,
      reason: `Domain ${domain} forbids unscoped global_staff subscription — fail closed.`,
    };
  }

  return {
    allowed: true,
    channelName: `${CHANNEL_PREFIX}:${domain}:${scope.type}:${scopeResult.channelName}`,
  };
}
