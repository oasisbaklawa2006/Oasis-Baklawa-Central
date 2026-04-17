// System Credit Lock — full-screen overlay shown when company.is_frozen = TRUE
// Blocks the buyer dashboard and surfaces the rescue payment requirement.
import { useEffect, useState } from "react";
import { Lock, AlertTriangle, Phone, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FrozenState {
  is_frozen: boolean;
  total_outstanding: number;
  business_name: string;
  rescue_payment_date: string | null;
  settlement_deadline: string | null;
}

const fmtINR = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function CreditLockOverlay() {
  const { user, companyId, role } = useAuth();
  const [state, setState] = useState<FrozenState | null>(null);

  // Staff bypass — only buyers see the lock
  const isStaff = role && !["BUYER", "BUYER_ADMIN", "BUYER_USER", null, ""].includes(role.toUpperCase());

  useEffect(() => {
    if (!user || !companyId || isStaff) {
      setState(null);
      return;
    }

    let cancelled = false;
    const fetchState = async () => {
      const { data } = await supabase
        .from("companies")
        .select("is_frozen, total_outstanding, business_name, rescue_payment_date, settlement_deadline")
        .eq("id", companyId)
        .maybeSingle();
      if (!cancelled && data) setState(data as FrozenState);
    };

    fetchState();

    // Realtime: react to unlock without refresh
    const ch = supabase
      .channel(`credit-lock-${companyId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "companies", filter: `id=eq.${companyId}` },
        (payload) => {
          if (cancelled) return;
          const n = payload.new as any;
          setState({
            is_frozen: !!n.is_frozen,
            total_outstanding: Number(n.total_outstanding || 0),
            business_name: n.business_name,
            rescue_payment_date: n.rescue_payment_date,
            settlement_deadline: n.settlement_deadline,
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, companyId, isStaff]);

  if (!state?.is_frozen) return null;

  const minimumUnlock = state.total_outstanding * 0.7;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">
            System Credit Lock
          </h1>
          <p className="text-sm text-slate-600 mb-1">{state.business_name}</p>
          <p className="text-xs text-slate-500 mb-6">
            Month-End Settlement Protocol: Full balance required to resume operations.
          </p>

          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-5">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              Total Outstanding
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {fmtINR(state.total_outstanding)}
            </p>
          </div>

          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
            <p className="text-[11px] uppercase tracking-wider text-amber-700 font-bold flex items-center justify-center gap-1">
              <AlertTriangle size={11} /> Minimum Unlock (70%)
            </p>
            <p className="text-3xl font-bold text-amber-700 mt-1">
              {fmtINR(minimumUnlock)}
            </p>
            <p className="text-[11px] text-amber-700/80 mt-1">
              Pay 70% to restore continuity until month-end
            </p>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Once your rescue payment is verified, full access resumes automatically.
            The remaining balance + new purchases must clear by the last day of this month.
          </p>

          <div className="w-full bg-slate-900 text-white rounded-xl p-3 mb-4 text-left">
            <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">
              Automated Credit Governance Active
            </p>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              Manual override is disabled for financial compliance. Please follow the payment protocol below to resume.
            </p>
          </div>

          <div className="w-full grid grid-cols-2 gap-2">
            <a
              href="tel:+919876543210"
              className="py-3 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800"
            >
              <Phone size={14} /> Call Finance
            </a>
            <a
              href="https://wa.me/919876543210?text=Rescue%20payment%20%E2%80%94%20please%20share%20bank%20details"
              target="_blank"
              rel="noreferrer"
              className="py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
