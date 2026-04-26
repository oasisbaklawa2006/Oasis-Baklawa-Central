import { createContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { AuthAttemptMethod } from "@/lib/auth-logging";

export interface RefreshProfileOptions {
  forceRefresh?: boolean;
  attemptId?: string;
  method?: AuthAttemptMethod;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  companyId: string | null;
  role: string | null;
  priceTier: string | null;
  profileReady: boolean;
  hasAppliedB2B: boolean;
  profileStatus: string | null;
  refreshProfile: (options?: RefreshProfileOptions) => Promise<boolean>;
  refreshPriceTier: () => Promise<string | null>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
