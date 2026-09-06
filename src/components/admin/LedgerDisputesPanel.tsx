import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Send, AlertTriangle, CheckCircle2, Download, Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  ledgerDisputeGuardMessage,
  ledgerDisputeResolutionAvailability,
  resolveLedgerDispute,
  LedgerDisputeWriteBlockedError,
  isGovernedWriteUnavailable,
} from "@/lib/finance-ageing";

interface CreditCompany {
  id: string;
  business_name: string;
  phone: string | null;
  current_balance: number | null;
  credit_limit: number | null;
  total_outstanding?: number | null;
  is_frozen?: boolean | null;
  rescue_payment_date?: string | null;
  settlement_deadline?: string | null;
}

interface LedgerRow {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  order_count: number;
  pdf_url: string | null;
  status: string;
  sent_at: string | null;
  generated_at: string;
  whatsapp_message_id: string | null;
  company?: { business_name: string } | null;
}

interface DisputeRow {
  id: string;
  ledger_id: string;
  company_id: string;
  description: string | null;
  status: string;
  resolution_notes: string | null;
  raised_via: string;
  created_at: string;
  resolved_at: string | null;
  company?: { business_name: string } | null;
  ledger?: { period_start: string; period_end: string; total_amount: number } | null;
}

const fmtINR = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const LedgerDisputesPanel = () => {
  const { user } = useAuth();
  const [creditCompanies, setCreditCompanies] = useState<CreditCompany[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<DisputeRow | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveSaving, setResolveSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [companiesRes, ledgersRes, disputesRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, business_name, phone, current_balance, credit_limit, total_outstanding, is_frozen, rescue_payment_date, settlement_deadline")
        .eq("payment_terms", "credit")
        .order("business_name"),
      supabase
        .from("bi_monthly_ledgers")
        .select("*, company:companies(business_name)")
        .order("generated_at", { ascending: false })
        .limit(50),
      supabase
        .from("ledger_disputes")
        .select("*, company:companies(business_name), ledger:bi_monthly_ledgers(period_start, period_end, total_amount)")
        .in("status", ["open", "investigating"])
        .order("created_at", { ascending: false }),
    ]);
    setCreditCompanies((companiesRes.data || []) as any);
    setLedgers((ledgersRes.data || []) as any);
    setDisputes((disputesRes.data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleGenerate = async (companyId: string | null) => {
    const key = companyId || "ALL";
    setGenerating(key);
    try {
      const { data, error } = await supabase.functions.invoke("generate-bi-monthly-ledger", {
        body: companyId ? { company_id: companyId } : {},
      });
      if (error) throw error;
      const generated = (data as any)?.generated || 0;
      toast.success(
        companyId
          ? `Ledger generated and sent (${generated} client)`
          : `Bi-monthly run complete — ${generated} ledgers sent`,
      );
      fetchAll();
    } catch (e: any) {
      toast.error("Generation failed: " + (e?.message || "unknown"));
    } finally {
      setGenerating(null);
    }
  };

  const disputeWriteAvailability = ledgerDisputeResolutionAvailability();
  const disputeWriteBlocked = isGovernedWriteUnavailable(disputeWriteAvailability)
    ? disputeWriteAvailability
    : null;

  const handleResolveDispute = async () => {
    if (!resolveTarget) return;
    if (!resolveNotes.trim()) {
      toast.error("Please add resolution notes.");
      return;
    }
    if (!user?.id) {
      toast.error("Authenticated finance actor is required.");
      return;
    }
    setResolveSaving(true);
    try {
      await resolveLedgerDispute({
        disputeId: resolveTarget.id,
        ledgerId: resolveTarget.ledger_id,
        companyId: resolveTarget.company_id,
        resolutionNotes: resolveNotes.trim(),
        actorId: user.id,
        correlationId: `central:ledger-dispute:${resolveTarget.id}`,
        idempotencyKey: `central:ledger-dispute:${resolveTarget.id}:${user.id}`,
      });
    } catch (error) {
      const message =
        error instanceof LedgerDisputeWriteBlockedError
          ? ledgerDisputeGuardMessage()
          : error instanceof Error
            ? error.message
            : "Governed dispute resolution unavailable";
      toast.error(message);
    } finally {
      setResolveSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#B8860B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TOP CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">Bi-Monthly Ledger Run</h3>
            <p className="text-sm text-slate-500">
              {creditCompanies.length} credit clients • Window: last 15 days
            </p>
          </div>
          <button
            onClick={() => handleGenerate(null)}
            disabled={generating === "ALL"}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 flex items-center gap-2 disabled:opacity-60"
          >
            {generating === "ALL" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Generate & Send All
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {creditCompanies.map((c) => {
            const out = Number(c.total_outstanding || 0);
            const minUnlock = out * 0.7;
            return (
              <div
                key={c.id}
                className={`rounded-xl p-3 border ${
                  c.is_frozen ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="font-bold text-slate-900 text-sm">{c.business_name}</p>
                  {c.is_frozen ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white rounded-full text-[9px] font-bold">
                      <Lock size={9} /> FROZEN
                    </span>
                  ) : out > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[9px] font-bold">
                      <ShieldAlert size={9} /> ACCRUED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-bold">
                      <CheckCircle2 size={9} /> CLEAR
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Limit: {fmtINR(c.credit_limit || 0)} • Outstanding: <span className="font-bold text-slate-900">{fmtINR(out)}</span>
                </p>
                {c.is_frozen && (
                  <p className="text-[10px] text-red-700 font-bold mt-1">
                    Min unlock (70%): {fmtINR(minUnlock)}
                  </p>
                )}
                {c.settlement_deadline && !c.is_frozen && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Deadline: {fmtDate(c.settlement_deadline)}
                  </p>
                )}
                <div className="mt-2">
                  <button
                    onClick={() => handleGenerate(c.id)}
                    disabled={generating === c.id}
                    className="w-full py-1.5 bg-[#B8860B] text-white rounded-lg text-[10px] font-bold hover:opacity-90 flex justify-center items-center gap-1 disabled:opacity-60"
                  >
                    {generating === c.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                    Send Ledger
                  </button>
                  <p className="text-[9px] text-slate-400 mt-1.5 italic text-center">
                    Lock state is system-managed (payment / month-end cron)
                  </p>
                </div>
              </div>
            );
          })}
          {creditCompanies.length === 0 && (
            <p className="text-sm text-slate-500 col-span-full">
              No clients on credit terms yet. Set <code>payment_terms = 'credit'</code> on companies to enable.
            </p>
          )}
        </div>
      </div>

      {disputeWriteBlocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Dispute resolution is read-only until Core ships{" "}
          <code className="text-xs font-mono">{disputeWriteBlocked.prerequisiteRpc}</code>.{" "}
          {ledgerDisputeGuardMessage()}
        </div>
      )}

      {/* OPEN DISPUTES */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-display text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-600" />
          Open Disputes ({disputes.length})
        </h3>
        {disputes.length === 0 ? (
          <p className="text-sm text-slate-500">No open disputes. All ledgers reconciled.</p>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <div key={d.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">{d.company?.business_name || "—"}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Ledger {fmtDate(d.ledger?.period_start || null)} – {fmtDate(d.ledger?.period_end || null)} •{" "}
                      <span className="font-bold">{fmtINR(d.ledger?.total_amount || 0)}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Raised via {d.raised_via} • {fmtDate(d.created_at)}
                    </p>
                    {d.description && (
                      <p className="text-sm text-slate-700 mt-2 italic">"{d.description}"</p>
                    )}
                  </div>
                  <button
                    onClick={() => setResolveTarget(d)}
                    disabled={Boolean(disputeWriteBlocked)}
                    title={disputeWriteBlocked ? ledgerDisputeGuardMessage() : "Resolve dispute"}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORY */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-display text-lg font-bold text-slate-900 mb-4">Recent Ledgers</h3>
        {ledgers.length === 0 ? (
          <p className="text-sm text-slate-500">No ledgers generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3 text-right">Orders</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">PDF</th>
                </tr>
              </thead>
              <tbody>
                {ledgers.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-bold text-slate-900">{l.company?.business_name || "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {fmtDate(l.period_start)} – {fmtDate(l.period_end)}
                    </td>
                    <td className="py-2 pr-3 text-right">{l.order_count}</td>
                    <td className="py-2 pr-3 text-right font-bold text-[#B8860B]">{fmtINR(l.total_amount)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === "resolved"
                            ? "bg-emerald-100 text-emerald-700"
                            : l.status === "disputed"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {l.status === "resolved" && <CheckCircle2 size={10} />}
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {l.pdf_url ? (
                        <a
                          href={l.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#B8860B] hover:underline inline-flex items-center gap-1 text-xs font-bold"
                        >
                          <Download size={12} /> Open
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESOLVE MODAL */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative z-[190] bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-slate-900 mb-1">Resolve Dispute</h3>
            <p className="text-sm text-slate-500 mb-4">{resolveTarget.company?.business_name}</p>
            <textarea
              rows={5}
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes — what was the discrepancy and how was it settled?"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-[#B8860B]"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setResolveTarget(null); setResolveNotes(""); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveDispute}
                disabled={resolveSaving}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {resolveSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
