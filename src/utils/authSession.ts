import { supabase } from "@/integrations/supabase/client";

export async function signOutAndClearSession() {
  try {
    await supabase.auth.signOut();
  } finally {
    try {
      localStorage.clear();
    } catch {}

    try {
      sessionStorage.clear();
    } catch {}
  }
}