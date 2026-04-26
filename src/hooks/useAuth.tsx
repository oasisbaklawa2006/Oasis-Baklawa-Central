/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchAuthRoleRecord, isInternalStaffUser, normalizeRole } from "@/lib/auth-routing";
import { normalizePhone } from "@/lib/auth-identity";
import { clearAuthCache, readAuthCache, writeAuthCache, type AuthCache } from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";
import { AuthContext, type AuthContextValue, type RefreshProfileOptions } from "./auth-context";

function getSupabaseStorageKeys() {
  return Object.keys(localStorage).filter((key) => key.startsWith("sb-") && key.includes("auth-token"));
}

function applyCachedState(
  cached: AuthCache | null,
  setters: {
    setCompanyId: (value: string | null) => void;
    setRole: (value: string | null) => void;
    setPriceTier: (value: string | null) => void;
  },
) {
  if (!cached) return false;
  setters.setCompanyId(cached.companyId);
  setters.setRole(cached.role ?? null);
  setters.setPriceTier(cached.priceTier ?? null);
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [priceTier, setPriceTier] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const bootstrapTokenRef = useRef(0);
  const cachedProfileRef = useRef<AuthCache | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    cachedProfileRef.current = readAuthCache();
  }, []);

  const resetState = useCallback((clearCache = false) => {
    sessionUserIdRef.current = null;
    setUser(null);
    setCompanyId(null);
    setRole(null);
    setPriceTier(null);
    setProfileReady(true);
    if (clearCache) {
      cachedProfileRef.current = null;
      clearAuthCache();
    }
  }, []);

  const fetchPriceTier = useCallback(async (resolvedCompanyId: string | null) => {
    if (!resolvedCompanyId) return null;

    const { data, error } = await supabase
      .from("companies")
      .select("price_tier")
      .eq("id", resolvedCompanyId)
      .maybeSingle();

    if (error) throw error;
    return data?.price_tier ?? null;
  }, []);

  const bootstrapUser = useCallback(async (activeUser: User, options: RefreshProfileOptions = {}) => {
    const attemptId = options.attemptId ?? createAuthAttemptId();
    const method = options.method ?? "session_restore";
    const identifier = activeUser.phone || activeUser.email || activeUser.id;
    const bootstrapToken = ++bootstrapTokenRef.current;
    const cached = !options.forceRefresh && cachedProfileRef.current?.userId === activeUser.id
      ? cachedProfileRef.current
      : null;

    if (cached) {
      applyCachedState(cached, { setCompanyId, setRole, setPriceTier });
    }

    setProfileReady(false);
    logAuthEvent("AUTH_START", {
      attemptId,
      method,
      identifier,
      result: "started",
      details: { sessionUserId: activeUser.id, forceRefresh: Boolean(options.forceRefresh) },
    });

    try {
      logAuthEvent("PROFILE_FETCH_STARTED", {
        attemptId,
        method,
        identifier,
        result: "started",
        details: { sessionUserId: activeUser.id },
      });

      const normalizedPhone = normalizePhone(activeUser.phone ?? "");
      const phonePattern = normalizedPhone.last10 ? `%${normalizedPhone.last10}%` : null;

      const [authRecord, internalStaff, publicUserById, publicUserByPhone, profileRow] = await Promise.all([
        fetchAuthRoleRecord(activeUser.id),
        isInternalStaffUser(activeUser.id),
        supabase
          .from("users")
          .select("id, role, company_id, is_active, phone, mobile_number, email")
          .eq("id", activeUser.id)
          .maybeSingle(),
        phonePattern
          ? supabase
              .from("users")
              .select("id, role, company_id, is_active, phone, mobile_number, email")
              .or(`phone.ilike.${phonePattern},mobile_number.ilike.${phonePattern}`)
              .limit(5)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("profiles")
          .select("company_id, status, is_approved")
          .eq("id", activeUser.id)
          .maybeSingle(),
      ]);

      if (bootstrapTokenRef.current !== bootstrapToken) return false;

      if (publicUserById.error) throw publicUserById.error;
      if (profileRow.error) throw profileRow.error;
      if (publicUserByPhone.error) throw publicUserByPhone.error;

      const phoneMatches = (publicUserByPhone.data ?? []).filter((row: any) => row.id !== activeUser.id);
      if (phoneMatches.length) {
        logAuthEvent("USER_RESOLUTION_FAILED", {
          attemptId,
          method,
          identifier,
          result: "failed",
          error: "phone_maps_to_different_user",
          details: {
            sessionUserId: activeUser.id,
            conflictingIds: phoneMatches.map((row: any) => row.id),
          },
        });
      }

      logAuthEvent("PROFILE_FETCH_SUCCESS", {
        attemptId,
        method,
        identifier,
        result: "success",
        details: { sessionUserId: activeUser.id },
      });

      logAuthEvent("ROLE_FETCH_STARTED", {
        attemptId,
        method,
        identifier,
        result: "started",
        details: { sessionUserId: activeUser.id },
      });

      const resolvedRole = normalizeRole(authRecord.role ?? publicUserById.data?.role);
      const resolvedCompanyId = authRecord.company_id ?? profileRow.data?.company_id ?? publicUserById.data?.company_id ?? null;
      const isActive = publicUserById.data?.is_active ?? null;

      logAuthEvent("ROLE_FETCH_SUCCESS", {
        attemptId,
        method,
        identifier,
        result: "success",
        details: {
          sessionUserId: activeUser.id,
          resolvedRole,
          resolvedCompanyId,
          internalStaff,
          isActive,
        },
      });

      const nextPriceTier = await fetchPriceTier(resolvedCompanyId);
      if (bootstrapTokenRef.current !== bootstrapToken) return false;

      const nextCache: AuthCache = {
        userId: activeUser.id,
        companyId: resolvedCompanyId,
        role: resolvedRole,
        priceTier: nextPriceTier,
      };

      cachedProfileRef.current = nextCache;
      writeAuthCache(nextCache);

      setCompanyId(resolvedCompanyId);
      setRole(resolvedRole);
      setPriceTier(nextPriceTier);
      setProfileReady(true);

      console.log(`[useAuth] Auth User ID: ${activeUser.id}, Public Profile Role: ${resolvedRole ?? "(none)"}`);
      return true;
    } catch (error) {
      if (bootstrapTokenRef.current !== bootstrapToken) return false;
      const message = error instanceof Error ? error.message : "bootstrap_failed";
      logAuthEvent("PROFILE_FETCH_FAILED", {
        attemptId,
        method,
        identifier,
        result: "failed",
        error: message,
        details: { sessionUserId: activeUser.id },
      });

      const fallbackCache = cachedProfileRef.current?.userId === activeUser.id ? cachedProfileRef.current : null;
      if (fallbackCache) {
        applyCachedState(fallbackCache, { setCompanyId, setRole, setPriceTier });
      } else {
        setCompanyId(null);
        setRole(null);
        setPriceTier(null);
      }
      setProfileReady(true);
      return false;
    }
  }, [fetchPriceTier]);

  const syncSession = useCallback(async (session: Session | null, method: AuthAttemptMethod) => {
    const nextUser = session?.user ?? null;
    sessionUserIdRef.current = nextUser?.id ?? null;
    setUser(nextUser);

    if (!nextUser) {
      resetState(true);
      setLoading(false);
      return;
    }

    const cached = cachedProfileRef.current?.userId === nextUser.id ? cachedProfileRef.current : null;
    if (!cached) {
      setCompanyId(null);
      setRole(null);
      setPriceTier(null);
    } else {
      applyCachedState(cached, { setCompanyId, setRole, setPriceTier });
    }

    setLoading(false);
    await bootstrapUser(nextUser, { method, forceRefresh: !cached });
  }, [bootstrapUser, resetState]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const method: AuthAttemptMethod = event === "SIGNED_OUT"
        ? "logout"
        : event === "SIGNED_IN"
          ? "email_password"
          : "session_restore";

      void syncSession(session, method);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      void syncSession(session, "session_restore");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const refreshProfile = useCallback(async (options: RefreshProfileOptions = {}) => {
    if (!user) return false;
    return bootstrapUser(user, {
      forceRefresh: true,
      method: options.method ?? "session_restore",
      attemptId: options.attemptId,
    });
  }, [bootstrapUser, user]);

  const refreshPriceTier = useCallback(async () => {
    if (!user) return null;

    const nextPriceTier = await fetchPriceTier(companyId);
    setPriceTier(nextPriceTier);
    const nextCache: AuthCache = {
      userId: user.id,
      companyId,
      role,
      priceTier: nextPriceTier,
    };
    cachedProfileRef.current = nextCache;
    writeAuthCache(nextCache);
    return nextPriceTier;
  }, [companyId, fetchPriceTier, role, user]);

  const logout = useCallback(async () => {
    const attemptId = createAuthAttemptId();
    const identifier = user?.email || user?.phone || user?.id || null;
    logAuthEvent("LOGOUT_STARTED", {
      attemptId,
      method: "logout",
      identifier,
      result: "started",
    });

    bootstrapTokenRef.current += 1;
    resetState(true);

    const storageKeys = typeof window === "undefined" ? [] : getSupabaseStorageKeys();

    try {
      await supabase.auth.signOut();
    } finally {
      storageKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });
      try {
        sessionStorage.removeItem("oasis_welcomed");
      } catch {}
      logAuthEvent("LOGOUT_SUCCESS", {
        attemptId,
        method: "logout",
        identifier,
        result: "success",
      });
    }
  }, [resetState, user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    companyId,
    role,
    priceTier,
    profileReady,
    refreshProfile,
    refreshPriceTier,
    logout,
  }), [companyId, loading, logout, priceTier, profileReady, refreshPriceTier, refreshProfile, role, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
