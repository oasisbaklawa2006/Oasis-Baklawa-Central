const DEFAULT_TIMEOUT_MS = 2000;

export class QueryTimeoutError extends Error {
  constructor(message = `Query timed out after ${DEFAULT_TIMEOUT_MS}ms`) {
    super(message);
    this.name = "QueryTimeoutError";
  }
}

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new QueryTimeoutError(`Query timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function isQueryTimeoutError(error: unknown) {
  return error instanceof QueryTimeoutError || (error instanceof Error && error.name === "QueryTimeoutError");
}