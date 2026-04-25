/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { fetchAuthRoleRecord } from "@/lib/auth-routing";

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
    setRole(cached.role ?? null);
    setPriceTier(cached.priceTier ?? null);
    return true;
  }, [getCachedForUser]);

  const persistCache = useCallback((data: AuthCache) => {
    cachedProfileRef.current = data;
    writeCache(data);
  }, []);

  const fetchProfile = useCallback(async (activeUser: User) => {
    try {
      const profile = await fetchAuthRoleRecord(activeUser.id);
      let cid = profile.company_id;
      let r = profile.role?.trim().toUpperCase() ?? null;

      // Phone-based fallback lookup — captures role when ID lookup misses
      const phone = activeUser.phone ?? (activeUser.user_metadata as any)?.phone ?? null;
      if (!r && phone) {
        try {
          const normalized = `+${String(phone).replace(/\D/g, "")}`;
          const { data: byPhone } = await supabase
            .from("users")
            .select("role, company_id")
            .or(`phone.eq.${normalized},phone.eq.${String(phone).replace(/\D/g, "")}`)
            .maybeSingle();
          if (byPhone?.role) r = String(byPhone.role).toUpperCase();
          if (!cid && byPhone?.company_id) cid = byPhone.company_id;
        } catch (e) {
          console.warn("[useAuth] phone-based role lookup failed", e);
        }
      }

      // Hardcoded admin bypass for owner phone
      const ownerPhone = phone ? `+${String(phone).replace(/\D/g, "")}` : null;
      if (ownerPhone === "+919891162212" && (!r || r === "PENDING")) {
        r = "ADMIN";
      }

      console.log(`[useAuth] Auth User ID: ${activeUser.id}, Phone: ${phone ?? "(none)"}, Public Profile Role: ${r ?? "(none)"}`);

      setCompanyId(cid);
      setRole(r);

      const { data: isInternalStaff } = await supabase.rpc("is_internal_staff", {
        _user_id: activeUser.id,
      });

      if (isInternalStaff) {
        void supabase
          .from("profiles")
          .update({ is_approved: true, status: "approved" })
          .eq("id", activeUser.id);
      }

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
        const profile = await fetchAuthRoleRecord(user.id);

        resolvedCompanyId = profile.company_id;
        setCompanyId(resolvedCompanyId);
        setRole(profile.role ?? null);
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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
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

      setProfileReady(false);
      if (!applyCachedCommerceState(nextUser.id)) {
        setRole(null);
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
          setProfileReady(false);

          if (!applyCachedCommerceState(nextUser.id)) {
            setRole(null);
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

    // 3s fallback: if RPC stalls, unblock UI using cached/metadata role
    const fallbackTimer = setTimeout(() => {
      const cached = getCachedForUser(user.id);
      if (cached?.role) {
        setRole(cached.role.toUpperCase());
        setCompanyId(cached.companyId);
        setPriceTier(cached.priceTier ?? null);
      } else {
        const metaRole = (user.user_metadata as any)?.role
          ?? (user.app_metadata as any)?.role
          ?? null;
        if (metaRole) setRole(String(metaRole).toUpperCase());
      }
      setProfileReady(true);
    }, 3000);

    fetchProfile(user).finally(() => {
      clearTimeout(fallbackTimer);
      setProfileReady(true);
    });
  }, [fetchProfile, getCachedForUser, loading, user]);

  // Removed: pending-role auto-refresh was causing infinite redirect storms

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
