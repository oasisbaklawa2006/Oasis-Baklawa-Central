/**
 * Factory Operations Certification Helpers
 *
 * Reusable logic for:
 * - Route destination validation
 * - Role assignment verification
 * - Full ID / short ID resolution
 * - Failure detection and reporting
 * - Cross-screen truth reconciliation
 */

/**
 * Normalize harmless URL-path syntax without changing route hierarchy.
 *
 * Important: `/admin/ready-goods` and `/ready-goods` are different routes
 * and MUST remain different. This helper only normalizes duplicate/trailing
 * slashes and ensures a leading slash.
 */
export const normalizeRoute = (path: string): string => {
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

/**
 * Validate that the actual URL matches the expected destination exactly.
 * Query strings and hashes are ignored because URL.pathname is compared,
 * but the route hierarchy itself is never rewritten.
 */
export const compareExactDestination = (
  expectedRoute: string,
  actualUrl: string,
): { passed: boolean; expected: string; actual: string; reason?: string } => {
  let actualPath: string;
  try {
    const url = new URL(actualUrl, "http://localhost");
    actualPath = url.pathname;
  } catch {
    return {
      passed: false,
      expected: expectedRoute,
      actual: actualUrl,
      reason: "Invalid URL format",
    };
  }

  const normalizedExpected = normalizeRoute(expectedRoute);
  const normalizedActual = normalizeRoute(actualPath);

  if (normalizedExpected === normalizedActual) {
    return {
      passed: true,
      expected: expectedRoute,
      actual: actualPath,
    };
  }

  return {
    passed: false,
    expected: expectedRoute,
    actual: actualPath,
    reason: `Route mismatch: expected "${normalizedExpected}" but got "${normalizedActual}"`,
  };
};

/**
 * Resolve a job short ID (E3ED28B0) to a full UUID
 * Validates the relationship
 */
export const resolveJobShortId = (
  shortId: string,
  fullId: string,
): { valid: boolean; shortId: string; fullId: string; reason?: string } => {
  if (shortId.length !== 8) {
    return {
      valid: false,
      shortId,
      fullId,
      reason: `Short ID must be 8 characters, got ${shortId.length}`,
    };
  }

  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(fullId)) {
    return {
      valid: false,
      shortId,
      fullId,
      reason: `Full ID is not a valid UUID: ${fullId}`,
    };
  }

  const extractedPrefix = fullId.slice(0, 8).toUpperCase();
  if (shortId !== extractedPrefix) {
    return {
      valid: false,
      shortId,
      fullId,
      reason: `Short ID "${shortId}" doesn't match full ID prefix "${extractedPrefix}"`,
    };
  }

  if (shortId === fullId) {
    return {
      valid: false,
      shortId,
      fullId,
      reason: "Short ID and full ID are identical; should be different",
    };
  }

  return {
    valid: true,
    shortId,
    fullId,
  };
};

/**
 * Validate that a role has the expected permission on a route
 */
export const validateRoleAssignment = (
  role: string,
  route: string,
  allowedRoles: string[],
): { valid: boolean; role: string; route: string; reason?: string } => {
  if (!allowedRoles.includes(role)) {
    return {
      valid: false,
      role,
      route,
      reason: `Role "${role}" not in allowed list: ${allowedRoles.join(", ")}`,
    };
  }

  return {
    valid: true,
    role,
    route,
  };
};

/**
 * Validate an HTTP-level denial only when authentication/authorization was
 * actually rejected. Server errors, not-found responses, rate limits and
 * network failures must never be counted as successful role isolation.
 *
 * Redirect-based denial is validated separately with compareExactDestination
 * against the application's explicit denied destination.
 */
export const validateAccessDenial = (
  statusCode: number | undefined,
  errorMessage: string | undefined,
): { denied: boolean; reason?: string } => {
  if (statusCode === 401 || statusCode === 403) {
    return { denied: true };
  }

  if (statusCode === undefined || statusCode === 0) {
    return {
      denied: false,
      reason: "Network error or no response (not proof of access denial)",
    };
  }

  if (statusCode >= 500) {
    return {
      denied: false,
      reason: `Server failure HTTP ${statusCode} is not proof of authorization denial${errorMessage ? `: ${errorMessage}` : ""}`,
    };
  }

  if (statusCode === 404 || statusCode === 408 || statusCode === 409 || statusCode === 429) {
    return {
      denied: false,
      reason: `HTTP ${statusCode} is not an authentication/authorization denial`,
    };
  }

  if (statusCode >= 200 && statusCode < 400) {
    return {
      denied: false,
      reason: `Access should be denied but got HTTP ${statusCode}`,
    };
  }

  return {
    denied: false,
    reason: `Unexpected HTTP ${statusCode}; only 401/403 count as HTTP-level access denial`,
  };
};

/**
 * Validate that a console error did NOT occur
 * (absence of error is presence of correctness)
 */
export const validateNoConsoleError = (
  consoleErrors: string[],
): { passed: boolean; errors: string[] } => {
  const factoryErrors = consoleErrors.filter(
    e =>
      e.toLowerCase().includes("factory") ||
      e.toLowerCase().includes("production") ||
      e.toLowerCase().includes("ready-goods") ||
      e.toLowerCase().includes("assembly") ||
      e.toLowerCase().includes("dispatch") ||
      e.toLowerCase().includes("inventory") ||
      e.includes("RLS") ||
      e.includes("PostgREST") ||
      e.includes("Could not find") ||
      e.includes("schema cache"),
  );

  return {
    passed: factoryErrors.length === 0,
    errors: factoryErrors,
  };
};

/**
 * Validate that a fixture was found (golden job, sample data, etc.)
 * For: "if fixture doesn't exist, test should fail"
 */
export const validateFixtureFound = (
  fixtureId: string,
  foundItems: string[] | null | undefined,
): { found: boolean; fixtureId: string; count: number; reason?: string } => {
  const count = foundItems?.length ?? 0;

  if (count === 0) {
    return {
      found: false,
      fixtureId,
      count,
      reason: `Fixture "${fixtureId}" not found; test must fail`,
    };
  }

  return {
    found: true,
    fixtureId,
    count,
  };
};

/**
 * Validate that data containment is correct
 * For: "Arabic job should only appear on Arabic TV, not on Chocolate TV"
 */
export const validateDataContainment = (
  department: string,
  expectedDepartments: string[],
): { contained: boolean; department: string; reason?: string } => {
  if (!expectedDepartments.includes(department)) {
    return {
      contained: false,
      department,
      reason: `Department "${department}" should only be in: ${expectedDepartments.join(", ")}`,
    };
  }

  return {
    contained: true,
    department,
  };
};

/**
 * Validate that error was properly displayed, not silently converted to empty state
 * For: "network error should show error message, not just an empty table"
 */
export const validateErrorDisplay = (
  hasError: boolean,
  errorMessage: string | undefined,
  dataIsEmpty: boolean,
): { displayed: boolean; reason?: string } => {
  if (!hasError) {
    return {
      displayed: false,
      reason: "No error detected when failure was expected",
    };
  }

  if (!errorMessage) {
    return {
      displayed: false,
      reason: "Error occurred but no message shown to user",
    };
  }

  if (dataIsEmpty && !errorMessage) {
    return {
      displayed: false,
      reason: "Empty data without error message (silent failure)",
    };
  }

  return {
    displayed: true,
  };
};

/**
 * Validate response structure (not using invalid PostgREST embedded relationship)
 * For: "inventory_reservations.product should not use 'product:products(...)' join"
 */
export const validateNoPostgRESTEmbeddingError = (
  statusCode: number | undefined,
  errorMessage: string | undefined,
): { valid: boolean; reason?: string } => {
  const postgrestErrors = [
    "Could not find a relationship",
    "schema cache",
    "relationship between",
    "PostgREST",
  ];

  if (
    errorMessage &&
    postgrestErrors.some(err => errorMessage.toLowerCase().includes(err.toLowerCase()))
  ) {
    return {
      valid: false,
      reason: `PostgREST embedding error detected: ${errorMessage}`,
    };
  }

  return { valid: true };
};

/**
 * Validate that cross-screen truth starts from backend authority
 * For: "backend row → UI1 display → UI2 display (should all match)"
 */
export const validateCrossScreenTruth = (
  backendData: Record<string, unknown>,
  ui1Display: Record<string, unknown>,
  ui2Display: Record<string, unknown>,
  keyFields: string[],
): { truthful: boolean; mismatches: string[] } => {
  const mismatches: string[] = [];

  for (const key of keyFields) {
    const backendValue = backendData[key];
    const ui1Value = ui1Display[key];
    const ui2Value = ui2Display[key];

    if (backendValue !== ui1Value) {
      mismatches.push(
        `${key}: backend="${backendValue}" but UI1="${ui1Value}"`,
      );
    }

    if (backendValue !== ui2Value) {
      mismatches.push(
        `${key}: backend="${backendValue}" but UI2="${ui2Value}"`,
      );
    }
  }

  return {
    truthful: mismatches.length === 0,
    mismatches,
  };
};
