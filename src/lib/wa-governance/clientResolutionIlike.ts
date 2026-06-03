/**
 * Escape user/message-derived terms for PostgREST ILIKE patterns.
 * PostgreSQL treats % and _ as wildcards; backslash is the default escape character.
 */
export function escapePostgrestIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Build a bounded contains ILIKE pattern with escaped inner term. */
export function postgrestIlikeContainsPattern(term: string): string {
  return `%${escapePostgrestIlikePattern(term)}%`;
}

/** Escape a term embedded in a PostgREST `.or()` ilike filter fragment. */
export function postgrestOrIlikeContains(column: string, term: string): string {
  return `${column}.ilike.${postgrestIlikeContainsPattern(term)}`;
}
