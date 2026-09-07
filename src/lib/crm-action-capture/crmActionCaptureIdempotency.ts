/** Client-side idempotency key for governed capture surfaces. */
export function newCrmActionIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
