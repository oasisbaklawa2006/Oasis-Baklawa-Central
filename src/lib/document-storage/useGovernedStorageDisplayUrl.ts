import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePersistedReferenceAccessUrl } from "./documentStorageClient";
import { legacyUrlToCanonicalRef } from "./documentStorageReference";
import { isCanonicalStorageRef } from "./documentStorageValidation";
import type { DocumentVisibilityClass } from "./documentStorageTypes";

export function useGovernedStorageDisplayUrl(
  persistedRef: string | null | undefined,
  visibility: DocumentVisibilityClass = "private",
): { url: string | null; loading: boolean; error: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = typeof persistedRef === "string" ? persistedRef.trim() : "";
    if (!trimmed) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
      const canonical = legacyUrlToCanonicalRef(trimmed);
      if (!canonical) {
        setUrl(trimmed);
        setError(null);
        setLoading(false);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void resolvePersistedReferenceAccessUrl(supabase, trimmed, visibility)
      .then((resolved) => {
        if (!cancelled) {
          setUrl(resolved);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setUrl(isCanonicalStorageRef(trimmed) ? null : trimmed);
          setError(err instanceof Error ? err.message : "Failed to resolve storage reference");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistedRef, visibility]);

  return { url, loading, error };
}
