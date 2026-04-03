import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const CACHE_KEY = "oasis_auth_cache";

interface AuthCache {
  userId: string;
  companyId: string | null;
  role: string | null;
  priceTier: string | null;
}

function readCache(): AuthCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data: AuthCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const profileFetchedForRef = useRef<string | null>(null);

  // Instant rehydration from cache
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setCompanyId(cached.companyId);
      setRole(cached.role);
    }
  }, []);

  // Auth listener — silent, no remounts
  useEffect(() => {
    // Restore session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        clearCache();
        setCompanyId(null);
        setRole(null);
        setProfileReady(true);
      }
    });

    // Listen for changes (token refresh, sign-in, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Silent update — just swap user ref, no layout remount
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          clearCache();
          setCompanyId(null);
          setRole(null);
          setProfileReady(true);
          profileFetchedForRef.current = null;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile (company_id, role) once per unique user — fire-and-forget
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setProfileReady(true);
      return;
    }
    if (profileFetchedForRef.current === user.id) return;
    profileFetchedForRef.current = user.id;

    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("company_id, role")
          .eq("id", user.id)
          .maybeSingle();

        const cid = data?.company_id ?? null;
        const r = data?.role ?? null;
        setCompanyId(cid);
        setRole(r);
        writeCache({ userId: user.id, companyId: cid, role: r });
      } catch {
        // Use cached values if fetch fails
      } finally {
        setProfileReady(true);
      }
    };

    fetchProfile();
  }, [user, loading]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    companyId,
    role,
    profileReady,
  };
}
