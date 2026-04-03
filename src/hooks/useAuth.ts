import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  role: string | null;
  company_id: string | null;
  companyStatus: string | null;
  priceTier: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>({
    role: null,
    company_id: null,
    companyStatus: null,
    priceTier: null,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: userData } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", userId)
      .maybeSingle();

    const role = userData?.role ?? null;
    const companyId = userData?.company_id ?? null;
    let companyStatus: string | null = null;
    let priceTier: string | null = null;

    if (companyId) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("status, price_tier")
        .eq("id", companyId)
        .maybeSingle();
      companyStatus = companyData?.status ?? null;
      priceTier = (companyData as any)?.price_tier ?? null;
    }

    setProfile({ role, company_id: companyId, companyStatus, priceTier });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          // Defer profile fetch to avoid blocking auth state change
          setTimeout(() => fetchProfile(u.id), 0);
        } else {
          setProfile({ role: null, company_id: null, companyStatus: null });
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    role: profile.role,
    company_id: profile.company_id,
    companyStatus: profile.companyStatus,
    refreshProfile: user ? () => fetchProfile(user.id) : () => Promise.resolve(),
  };
}
