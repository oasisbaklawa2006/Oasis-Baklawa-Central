/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const CACHE_KEY = "oasis_auth_cache";

interface AuthCache {
  userId: string;
  companyId: string | null;
  role: string | null;
  priceTier: string | null;
}

function isPendingRole(role?: string | null) {
  const normalizedRole = role?.trim().toUpperCase() ?? null;
  return !normalizedRole || normalizedRole === "PENDING";
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
  const [priceTier, setPriceTier] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const cachedProfileRef = useRef<AuthCache | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const profileFetchedForRef = useRef<string | null>(null);
  const forcedPendingRefreshForRef = useRef<string | null>(null);

  useEffect(() => {
    cachedProfileRef.current = readCache();
  }, []);

  const getCachedForUser = useCallback((userId?: string | null) => {
    const cached = cachedProfileRef.current;
    if (!userId || !cached || cached.userId !== userId) return null;
    return cached;
  }, []);

  const applyCachedCommerceState = useCallback((userId?: string | null) => {
    const cached = getCachedForUser(userId);
    if (!cached) return false;

    setCompanyId(cached.companyId);
    setPriceTier(cached.priceTier ?? null);
    return true;
  }, [getCachedForUser]);

  const persistCache = useCallback((data: AuthCache) => {
    cachedProfileRef.current = data;
    writeCache(data);
  }, []);

  const fetchProfile = useCallback(async (activeUser: User) => {
    try {
      const { data } = await supabase
        .from("users")
        .select("company_id, role")
        .eq("id", activeUser.id)
        .maybeSingle();

      const cid = data?.company_id ?? null;
      const r = data?.role ?? null;
      setCompanyId(cid);
      setRole(r);

      let pt: string | null = null;
      if (cid) {
        const { data: compData } = await supabase
          .from("companies")
          .select("price_tier")
          .eq("id", cid)
          .maybeSingle();
        pt = compData?.price_tier ?? null;
      }

      setPriceTier(pt);
      persistCache({ userId: activeUser.id, companyId: cid, role: r, priceTier: pt });
    } catch {
      const cached = getCachedForUser(activeUser.id);
      if (cached) {
        setCompanyId(cached.companyId);
        setRole(cached.role);
        setPriceTier(cached.priceTier ?? null);
      }
    }
  }, [getCachedForUser, persistCache]);

  const refreshPriceTier = useCallback(async () => {
    if (!user) return null;

    try {
      let resolvedCompanyId = companyId;

      if (!resolvedCompanyId) {
        const { data } = await supabase
          .from("users")
          .select("company_id, role")
          .eq("id", user.id)
          .maybeSingle();

        resolvedCompanyId = data?.company_id ?? null;
        setCompanyId(resolvedCompanyId);

        if (data?.role) {
          setRole(data.role);
        }
      }

      if (!resolvedCompanyId) {
        setPriceTier(null);
        const cached = getCachedForUser(user.id);
        persistCache({
          userId: user.id,
          companyId: null,
          role: role ?? cached?.role ?? null,
          priceTier: null,
        });
        return null;
      }

      const { data: companyData } = await supabase
        .from("companies")
        .select("price_tier")
        .eq("id", resolvedCompanyId)
        .maybeSingle();

      const nextPriceTier = companyData?.price_tier ?? null;
      setPriceTier(nextPriceTier);

      const cached = getCachedForUser(user.id);
      persistCache({
        userId: user.id,
        companyId: resolvedCompanyId,
        role: role ?? cached?.role ?? null,
        priceTier: nextPriceTier,
      });

      return nextPriceTier;
    } catch {
      return getCachedForUser(user.id)?.priceTier ?? null;
    }
  }, [companyId, getCachedForUser, persistCache, role, user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;

    profileFetchedForRef.current = user.id;
    setProfileReady(false);

    try {
      await fetchProfile(user);
      return true;
    } finally {
      setProfileReady(true);
    }
  }, [fetchProfile, user]);

  // Auth listener — silent, no remounts
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      const nextUser = session?.user ?? null;
      currentUserIdRef.current = nextUser?.id ?? null;
      setUser(nextUser);
      setLoading(false);

      if (!nextUser) {
        clearCache();
        cachedProfileRef.current = null;
        setCompanyId(null);
        setRole(null);
        setPriceTier(null);
        setProfileReady(true);
          forcedPendingRefreshForRef.current = null;
        return;
      }

      setRole(null);
      setProfileReady(false);
      if (!applyCachedCommerceState(nextUser.id)) {
        setCompanyId(null);
        setPriceTier(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;
        const userChanged = currentUserIdRef.current !== nextUserId;

        currentUserIdRef.current = nextUserId;
        setUser(nextUser);
        setLoading(false);

        if (!nextUser) {
          clearCache();
          cachedProfileRef.current = null;
          setCompanyId(null);
          setRole(null);
          setPriceTier(null);
          setProfileReady(true);
          profileFetchedForRef.current = null;
          forcedPendingRefreshForRef.current = null;
          return;
        }

        if (userChanged) {
          profileFetchedForRef.current = null;
          forcedPendingRefreshForRef.current = null;
          setRole(null);
          setProfileReady(false);

          if (!applyCachedCommerceState(nextUser.id)) {
            setCompanyId(null);
            setPriceTier(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyCachedCommerceState]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setProfileReady(true);
      return;
    }
    if (profileFetchedForRef.current === user.id) return;
    profileFetchedForRef.current = user.id;
    setProfileReady(false);

    fetchProfile(user).finally(() => {
      setProfileReady(true);
    });
  }, [fetchProfile, loading, user]);

  useEffect(() => {
    if (loading || !user || !profileReady) return;

    if (!isPendingRole(role)) {
      forcedPendingRefreshForRef.current = null;
      return;
    }

    if (forcedPendingRefreshForRef.current === user.id) return;
    forcedPendingRefreshForRef.current = user.id;

    void refreshProfile();
  }, [loading, profileReady, refreshProfile, role, user]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    companyId,
    role,
    priceTier,
    profileReady,
    refreshProfile,
    refreshPriceTier,
  };
}
