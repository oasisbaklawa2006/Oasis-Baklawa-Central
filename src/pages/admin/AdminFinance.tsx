import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ShieldCheck,
  ShieldAlert,
  Receipt,
  UploadCloud,
  FileUp,
  X,
  Banknote,
  Calculator,
  Link,
  Package,
  XCircle,
  RotateCcw,
  IndianRupee,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

interface FinanceOrder {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  advance_paid: number | null;
  created_at: string;
  company_id: string | null;
  company?: { business_name: string } | null;
}

interface CreditRequest {
  id: string;
  company_id: string | null;
  credit_type: string | null;
  requested_amount: number;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  requested_by: string | null;
  company?: { business_name: string } | null;
  requester?: { full_name: string | null; email: string | null } | null;
}

interface ReturnRecord {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity_returned: number;
  original_value: number | null;
  final_credit_value: number | null;
  loss_amount: number | null;
  admin_approval: boolean | null;
  status: string | null;
  reason: string | null;
  created_at: string | null;
  product?: { name: string; base_price: number | null } | null;
  order?: { company_id: string | null; company: { business_name: string; wallet_balance: number | null } | null } | null;
}

interface ScrutinyRecord {
  id: string;
  company_id: string | null;
  company_name: string;
  sales_exec_name: string;
  reason: string | null;
  expected_value: number | null;
  accompanying_docs: string | null;
  created_at: string | null;
  item_count: number;
}

const FAULT_OPTIONS = ["Sales Error", "Manufacturing Defect", "Logistics Damage"];
const DEPT_OPTIONS = ["Bakery", "Arabic Sweets", "Chocolate", "Dragees", "Fusion", "Nuts", "Packing"];

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

type FinanceQueue = "validation" | "approvals" | "invoicing" | "returns" | "returns_scrutiny";

const AdminFinance = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<FinanceQueue>("validation");

  // Invoicing Modal State
  const [docOrder, setDocOrder] = useState<FinanceOrder | null>(null);
  const [tallyAmount, setTallyAmount] = useState("");
  const [tallyInvoiceNo, setTallyInvoiceNo] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);

  // Returns Settlement State
  const [returnCreditValues, setReturnCreditValues] = useState<Record<string, string>>({});
  const [returnApprovals, setReturnApprovals] = useState<Record<string, boolean>>({});

  // Returns Scrutiny State
  const [scrutinyRecords, setScrutinyRecords] = useState<ScrutinyRecord[]>([]);
  const [scrutinyTarget, setScrutinyTarget] = useState<ScrutinyRecord | null>(null);
  const [scrutinyFault, setScrutinyFault] = useState("");
  const [scrutinyDept, setScrutinyDept] = useState("");
  const [scrutinySettlement, setScrutinySettlement] = useState("");
  const [scrutinySaving, setScrutinySaving] = useState(false);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, sales_order_value, advance_paid, created_at, company_id, company:companies(business_name)",
      )
      .order("created_at", { ascending: false });

    if (!error && data) setOrders(data as unknown as FinanceOrder[]);
  };

  const fetchCreditRequests = async () => {
    const { data, error } = await supabase
      .from("credit_requests")
      .select(
        "id, company_id, credit_type, requested_amount, notes, status, created_at, requested_by, company:companies(business_name), requester:users!credit_requests_requested_by_fkey(full_name, email)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) setCreditRequests(data as unknown as CreditRequest[]);
  };

  const fetchReturns = async () => {
    const { data, error } = await supabase
      .from("order_returns")
      .select(
        "id, order_id, product_id, quantity_returned, original_value, final_credit_value, loss_amount, admin_approval, status, reason, created_at, product:products(name, base_price), order:orders(company_id, company:companies(business_name, wallet_balance))"
      )
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReturnRecords(data as unknown as ReturnRecord[]);
      // Initialize credit values and approvals
      const cv: Record<string, string> = {};
      const ap: Record<string, boolean> = {};
      (data as any[]).forEach((r) => {
        cv[r.id] = r.final_credit_value?.toString() || "";
        ap[r.id] = r.admin_approval || false;
      });
      setReturnCreditValues(cv);
      setReturnApprovals(ap);
    }
  };

  // Fetch inward_material_advice at_gate for scrutiny
  const fetchScrutiny = async () => {
    const { data: advices } = await supabase
      .from("inward_material_advice")
      .select("id, company_id, reason, expected_value, accompanying_docs, created_at, sales_exec_id, status")
      .eq("status", "at_gate");

    if (!advices || advices.length === 0) {
      setScrutinyRecords([]);
      return;
    }

    const companyIds = [...new Set(advices.map((a: any) => a.company_id).filter(Boolean))] as string[];
    const execIds = [...new Set(advices.map((a: any) => a.sales_exec_id).filter(Boolean))] as string[];

    const [{ data: companies }, { data: execs }, { data: items }] = await Promise.all([
      companyIds.length > 0 ? supabase.from("companies").select("id, business_name").in("id", companyIds) : { data: [] },
      execIds.length > 0 ? supabase.from("users").select("id, full_name, name").in("id", execIds) : { data: [] },
      supabase.from("inward_material_items").select("advice_id").in("advice_id", advices.map((a: any) => a.id)),
    ]);

    const companyMap: Record<string, string> = {};
    (companies || []).forEach((c: any) => { companyMap[c.id] = c.business_name; });
    const execMap: Record<string, string> = {};
    (execs || []).forEach((e: any) => { execMap[e.id] = e.full_name || e.name || "—"; });
    const itemCountMap: Record<string, number> = {};
    (items || []).forEach((it: any) => { itemCountMap[it.advice_id] = (itemCountMap[it.advice_id] || 0) + 1; });

    setScrutinyRecords(
      advices.map((a: any) => ({
        id: a.id,
        company_id: a.company_id,
        company_name: a.company_id ? companyMap[a.company_id] || "Unknown" : "Unknown",
        sales_exec_name: a.sales_exec_id ? execMap[a.sales_exec_id] || "—" : "—",
        reason: a.reason,
        expected_value: a.expected_value,
        accompanying_docs: a.accompanying_docs,
        created_at: a.created_at,
        item_count: itemCountMap[a.id] || 0,
      }))
    );
  };

  // Execute Settlement for scrutiny record
  const handleExecuteSettlement = async () => {
    if (!scrutinyTarget || !scrutinyFault || !scrutinySettlement) {
      toast.error("Please fill all mandatory fields.");
      return;
    }
    if (scrutinyFault === "Manufacturing Defect" && !scrutinyDept) {
      toast.error("Select the faulty department for manufacturing defects.");
      return;
    }
    const settlementVal = parseFloat(scrutinySettlement);
    if (isNaN(settlementVal) || settlementVal < 0) {
      toast.error("Enter a valid settlement value.");
      return;
    }

    setScrutinySaving(true);
    try {
      const expectedVal = scrutinyTarget.expected_value || 0;
      const lossAmount = expectedVal - settlementVal;

      // 1. Update inward_material_advice
      await supabase
        .from("inward_material_advice")
        .update({
          status: "settled",
          fault_attribution: scrutinyFault,
          fault_department: scrutinyFault === "Manufacturing Defect" ? scrutinyDept : null,
          settlement_value: settlementVal,
          settled_by: user?.id || null,
          settled_at: new Date().toISOString(),
        })
        .eq("id", scrutinyTarget.id);

      // 2. Credit company wallet
      if (scrutinyTarget.company_id && settlementVal > 0) {
        const { data: comp } = await supabase
          .from("companies")
          .select("wallet_balance")
          .eq("id", scrutinyTarget.company_id)
          .single();
        const currentBal = comp?.wallet_balance || 0;
        await supabase
          .from("companies")
          .update({ wallet_balance: currentBal + settlementVal })
          .eq("id", scrutinyTarget.company_id);
      }

      // 3. Audit log
      await supabase.from("audit_logs").insert({
        module_name: "finance",
        action_type: "return_settlement_executed",
        entity_name: "inward_material_advice",
        entity_id: scrutinyTarget.id,
        actor_id: user?.id || null,
        new_value: {
          company: scrutinyTarget.company_name,
          expected_value: expectedVal,
          settlement_value: settlementVal,
          loss: lossAmount > 0 ? lossAmount : 0,
          fault_attribution: scrutinyFault,
          fault_department: scrutinyFault === "Manufacturing Defect" ? scrutinyDept : null,
        },
      });

      toast.success(`₹${settlementVal.toLocaleString("en-IN")} credited to ${scrutinyTarget.company_name}'s wallet.`, { icon: "💰" });
      setScrutinyTarget(null);
      setScrutinyFault("");
      setScrutinyDept("");
      setScrutinySettlement("");
      fetchScrutiny();
    } catch (err) {
      toast.error("Settlement failed.");
    }
    setScrutinySaving(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchOrders(), fetchCreditRequests(), fetchReturns(), fetchScrutiny()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleValidatePayment = async (orderId: string) => {
    setActing(orderId);
    try {
      await supabase
        .from("orders")
        .update({ payment_status: "verified_advance", status: "in_production" })
        .eq("id", orderId);
      toast.success("Advance Verified. Cleared for Dispatch Team to pack.");
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  const handleCreditAction = async (req: CreditRequest, action: "approved" | "rejected") => {
    setActing(req.id);
    try {
      // Update credit request status
      await supabase
        .from("credit_requests")
        .update({ status: action })
        .eq("id", req.id);

      if (action === "approved" && req.company_id) {
        // If long_term_limit, update the company's credit_limit
        if (req.credit_type === "long_term_limit") {
          await supabase
            .from("companies")
            .update({ credit_limit: req.requested_amount, allow_credit: true })
            .eq("id", req.company_id);
        }
        // For short_term_so, just log it (no credit_limit change)
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        module_name: "finance",
        action_type: `credit_request_${action}`,
        entity_name: "credit_requests",
        entity_id: req.id,
        actor_id: user?.id || null,
        new_value: {
          company_id: req.company_id,
          credit_type: req.credit_type,
          requested_amount: req.requested_amount,
          decision: action,
        },
      });

      toast.success(
        action === "approved"
          ? `Credit approved for ${req.company?.business_name}. ${req.credit_type === "long_term_limit" ? "Limit updated." : "Short-term SO logged."}`
          : `Credit request rejected.`,
      );
      fetchCreditRequests();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // Execute Wallet Credit for a return
  const handleExecuteWalletCredit = async (ret: ReturnRecord) => {
    const creditValue = parseFloat(returnCreditValues[ret.id] || "0");
    if (creditValue <= 0) {
      toast.error("Enter a valid credit value.");
      return;
    }
    if (!returnApprovals[ret.id]) {
      toast.error("Admin approval must be toggled ON before executing credit.");
      return;
    }
    setActing(ret.id);
    try {
      const companyId = (ret.order as any)?.company_id;
      const productValue = (ret.product?.base_price || 0) * ret.quantity_returned;
      const lossAmount = productValue - creditValue;

      // Update the return record
      await supabase
        .from("order_returns")
        .update({
          final_credit_value: creditValue,
          loss_amount: lossAmount > 0 ? lossAmount : 0,
          original_value: productValue,
          admin_approval: true,
          status: "settled",
        })
        .eq("id", ret.id);

      // Credit company wallet
      if (companyId) {
        const currentBalance = (ret.order as any)?.company?.wallet_balance || 0;
        await supabase
          .from("companies")
          .update({ wallet_balance: currentBalance + creditValue })
          .eq("id", companyId);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        module_name: "finance",
        action_type: "wallet_credit_executed",
        entity_name: "order_returns",
        entity_id: ret.id,
        actor_id: user?.id || null,
        new_value: {
          credit_value: creditValue,
          loss_amount: lossAmount > 0 ? lossAmount : 0,
          company_id: companyId,
          product_id: ret.product_id,
        },
      });

      toast.success(`₹${creditValue.toLocaleString("en-IN")} credited to wallet.`, { icon: "💰" });
      fetchReturns();
    } catch (err) {
      toast.error("Failed to execute wallet credit.");
    }
    setActing(null);
  };


  const handleRequestBalance = async () => {
    if (!docOrder || !tallyAmount || !tallyInvoiceNo || !invoiceUploaded) {
      toast.error("Please fill all Tally details and attach the PDF.");
      return;
    }
    setActing(docOrder.id);
    try {
      await supabase
        .from("orders")
        .update({
          sales_order_value: parseFloat(tallyAmount),
          status: "awaiting_final_payment",
        })
        .eq("id", docOrder.id);

      toast.success("Invoice Locked! Payment request sent to customer.");
      setDocOrder(null);
      setInvoiceUploaded(false);
      setTallyAmount("");
      setTallyInvoiceNo("");
      fetchOrders();
    } catch (err) {
      toast.error("Upload failed.");
    }
    setActing(null);
  };

  // Queues
  const validationQueue = orders.filter((o) => o.payment_status === "awaiting_receipt");
  const invoicingQueue = orders.filter((o) => o.status === "in_production" || o.status === "packed_ready");

  const totalValueToday = orders.reduce((sum, o) => sum + (o.sales_order_value || 0), 0);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* HEADER */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-end mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Finance Control Tower</h1>
            <p className="text-sm text-slate-400 mt-1">Approval, invoicing, and payment validation.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total Exposure</p>
            <p className="text-2xl font-black text-[#B8860B]">{formatPrice(totalValueToday)}</p>
          </div>
        </div>
      </div>

      {/* QUEUE NAVIGATION */}
      <div className="max-w-7xl mx-auto px-6 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex overflow-x-auto scrollbar-hide gap-2">
          {[
            { id: "validation", label: "Advance Receipts", count: validationQueue.length, icon: Banknote },
            { id: "approvals", label: "Credit Approvals", count: creditRequests.length, icon: ShieldCheck },
            { id: "invoicing", label: "Post-Pack Invoicing", count: invoicingQueue.length, icon: Calculator },
            { id: "returns", label: "Returns Settlement", count: returnRecords.length, icon: RotateCcw },
            { id: "returns_scrutiny", label: "Returns Scrutiny", count: scrutinyRecords.length, icon: ShieldAlert },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveQueue(tab.id as FinanceQueue)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeQueue === tab.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <tab.icon size={16} className={activeQueue === tab.id ? "text-[#B8860B]" : "text-slate-400"} />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${activeQueue === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ACTIVE QUEUE RENDERER */}
        <div className="mt-6">
          {/* QUEUE 1: ADVANCE VALIDATION */}
          {activeQueue === "validation" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {validationQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No receipts pending validation.</p>
              ) : (
                validationQueue.map((order) => (
                  <div key={order.id} className="bg-white border-l-4 border-amber-400 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">SO #{order.id.split("-")[0]}</p>
                        <p className="font-black text-slate-900 text-lg">{order.company?.business_name}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <p className="text-xl font-black text-amber-600">{formatPrice(order.sales_order_value || 0)}</p>
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <AlertTriangle size={12} /> Advance Receipt
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50">
                        View Receipt
                      </button>
                      <button
                        onClick={() => handleValidatePayment(order.id)}
                        disabled={acting === order.id}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1"
                      >
                        {acting === order.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Verify Advance
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 2: CREDIT APPROVALS */}
          {activeQueue === "approvals" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditRequests.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No credit requests pending approval.</p>
              ) : (
                creditRequests.map((req) => (
                  <div key={req.id} className="bg-white border-l-4 border-violet-400 rounded-xl p-5 shadow-sm">
                    <div className="border-b border-slate-100 pb-3 mb-3">
                      <p className="font-black text-slate-900 text-lg">{req.company?.business_name || "Unknown"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Requested by: {req.requester?.full_name || req.requester?.email || "N/A"}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xl font-black text-[#B8860B]">{formatPrice(req.requested_amount)}</p>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          req.credit_type === "long_term_limit"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {req.credit_type === "long_term_limit" ? "Long-Term Limit" : "Short-Term SO"}
                      </span>
                    </div>
                    {req.notes && (
                      <p className="text-xs text-slate-500 italic mb-4 line-clamp-2">"{req.notes}"</p>
                    )}
                    {!req.notes && <div className="mb-4" />}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreditAction(req, "rejected")}
                        disabled={acting === req.id}
                        className="flex-1 py-2.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 flex justify-center items-center gap-1"
                      >
                        {acting === req.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <XCircle size={14} /> Reject
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleCreditAction(req, "approved")}
                        disabled={acting === req.id}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1"
                      >
                        {acting === req.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Approve
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 3: POST-PACK INVOICING */}
          {activeQueue === "invoicing" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoicingQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No orders packed and awaiting invoice.</p>
              ) : (
                invoicingQueue.map((order) => (
                  <div key={order.id} className="bg-white border-l-4 border-[#B8860B] rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">SO #{order.id.split("-")[0]}</p>
                        <p className="font-black text-slate-900 text-lg">{order.company?.business_name}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Packed Value Est.</p>
                        <p className="text-lg font-black text-slate-900">{formatPrice(order.sales_order_value || 0)}</p>
                      </div>
                      <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <Package size={12} /> Packed by Ops
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setDocOrder(order);
                        setSoNumber(`SO-${order.id.split("-")[0].toUpperCase()}`);
                      }}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black flex justify-center items-center gap-1.5"
                    >
                      <Calculator size={14} /> Process Final Invoice
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 4: RETURNS SETTLEMENT */}
          {activeQueue === "returns" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {returnRecords.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No returns pending settlement.</p>
              ) : (
                returnRecords.map((ret) => {
                  const productValue = (ret.product?.base_price || 0) * ret.quantity_returned;
                  const creditVal = parseFloat(returnCreditValues[ret.id] || "0");
                  const lossCalc = productValue - creditVal;
                  const isApproved = returnApprovals[ret.id] || false;

                  return (
                    <div key={ret.id} className="bg-white border-l-4 border-orange-400 rounded-xl p-5 shadow-sm">
                      <div className="border-b border-slate-100 pb-3 mb-3">
                        <p className="font-black text-slate-900 text-lg">{ret.product?.name || "Unknown Product"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {(ret.order as any)?.company?.business_name || "Unknown Company"} • {ret.quantity_returned} units returned
                        </p>
                        {ret.reason && <p className="text-xs text-slate-500 italic mt-1">"{ret.reason}"</p>}
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Original Value</span>
                          <span className="font-bold text-slate-900">{formatPrice(productValue)}</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Final Credit Value (₹)</label>
                          <input
                            type="number"
                            value={returnCreditValues[ret.id] || ""}
                            onChange={(e) => setReturnCreditValues((prev) => ({ ...prev, [ret.id]: e.target.value }))}
                            placeholder="Enter credit amount"
                            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-[#B8860B]"
                          />
                        </div>
                        {creditVal > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-red-500 font-bold">Loss Amount</span>
                            <span className="font-black text-red-600">{formatPrice(lossCalc > 0 ? lossCalc : 0)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-3 border border-slate-200">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Admin Approval</span>
                        <button
                          onClick={() => setReturnApprovals((prev) => ({ ...prev, [ret.id]: !prev[ret.id] }))}
                          className={`w-12 h-6 rounded-full transition-colors relative ${isApproved ? "bg-emerald-500" : "bg-slate-300"}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isApproved ? "left-[26px]" : "left-0.5"}`} />
                        </button>
                      </div>

                      {isApproved && creditVal > 0 && (
                        <button
                          onClick={() => handleExecuteWalletCredit(ret)}
                          disabled={acting === ret.id}
                          className="w-full py-3 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1.5"
                        >
                          {acting === ret.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Wallet size={14} /> Execute Wallet Credit ({formatPrice(creditVal)})
                            </>
                          )}
                        </button>
                      )}

                      {(!isApproved || creditVal <= 0) && (
                        <div className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {!isApproved ? "Toggle admin approval to proceed" : "Enter credit value"}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* QUEUE 5: RETURNS SCRUTINY */}
          {activeQueue === "returns_scrutiny" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scrutinyRecords.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No returns at gate pending scrutiny.</p>
              ) : (
                scrutinyRecords.map((rec) => (
                  <div key={rec.id} className="bg-white border-l-4 border-red-400 rounded-xl p-5 shadow-sm">
                    <div className="border-b border-slate-100 pb-3 mb-3">
                      <p className="font-black text-slate-900 text-lg">{rec.company_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Sales Exec: {rec.sales_exec_name} • {rec.item_count} item(s)
                      </p>
                    </div>
                    <div className="space-y-1 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reason</span>
                        <span className="font-semibold text-slate-700">{rec.reason || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Expected Value</span>
                        <span className="font-black text-[#B8860B]">{formatPrice(rec.expected_value || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Documents</span>
                        <span className="text-slate-600 text-xs">{rec.accompanying_docs || "None"}</span>
                      </div>
                      {rec.created_at && (
                        <p className="text-slate-400 text-xs pt-1">
                          Advised: {formatDate(rec.created_at)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setScrutinyTarget(rec);
                        setScrutinyFault("");
                        setScrutinyDept("");
                        setScrutinySettlement("");
                      }}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black flex justify-center items-center gap-1.5"
                    >
                      <ShieldAlert size={14} /> Open Scrutiny
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* SCRUTINY MODAL */}
      <AnimatePresence>
        {scrutinyTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl my-8"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Returns Scrutiny</h3>
                  <p className="text-sm text-slate-500 mt-1">{scrutinyTarget.company_name}</p>
                </div>
                <button
                  onClick={() => setScrutinyTarget(null)}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Sales Exec Notes */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-1 text-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sales Executive Notes</p>
                  <p><span className="text-slate-500">Reason:</span> <span className="font-semibold text-slate-800">{scrutinyTarget.reason || "—"}</span></p>
                  <p><span className="text-slate-500">Docs:</span> <span className="text-slate-700">{scrutinyTarget.accompanying_docs || "None"}</span></p>
                  <p><span className="text-slate-500">Expected Value:</span> <span className="font-black text-[#B8860B]">{formatPrice(scrutinyTarget.expected_value || 0)}</span></p>
                  <p><span className="text-slate-500">Exec:</span> <span className="text-slate-700">{scrutinyTarget.sales_exec_name}</span></p>
                </div>

                {/* Fault Attribution */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Fault Attribution *</label>
                  <select
                    value={scrutinyFault}
                    onChange={(e) => { setScrutinyFault(e.target.value); if (e.target.value !== "Manufacturing Defect") setScrutinyDept(""); }}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                  >
                    <option value="">Select fault type...</option>
                    {FAULT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                {/* Faulty Department (only for Manufacturing Defect) */}
                {scrutinyFault === "Manufacturing Defect" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Faulty Department *</label>
                    <select
                      value={scrutinyDept}
                      onChange={(e) => setScrutinyDept(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                    >
                      <option value="">Select department...</option>
                      {DEPT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {/* Final Settlement Value */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Final Settlement Value (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={scrutinySettlement}
                    onChange={(e) => setScrutinySettlement(e.target.value)}
                    placeholder="Amount to refund to client wallet"
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-black text-[#B8860B] outline-none focus:border-[#B8860B]"
                  />
                </div>

                {/* Loss Preview */}
                {scrutinySettlement && parseFloat(scrutinySettlement) >= 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-red-600 uppercase">Calculated Loss</span>
                    <span className="font-black text-red-700">
                      {formatPrice(Math.max(0, (scrutinyTarget.expected_value || 0) - parseFloat(scrutinySettlement)))}
                    </span>
                  </div>
                )}

                {/* Execute Button */}
                <button
                  onClick={handleExecuteSettlement}
                  disabled={scrutinySaving}
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  {scrutinySaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Wallet size={18} /> Execute Settlement
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FINANCE INVOICING MODAL */}
      <AnimatePresence>
        {docOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl my-8"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">Process Final Invoice</h3>
                  <p className="text-sm text-slate-500 mt-1">{docOrder.company?.business_name}</p>
                </div>
                <button
                  onClick={() => setDocOrder(null)}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calculator size={14} /> Internal Reconciliation Sheet
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Packed Items Value (As per Slab)</span>
                      <span className="font-bold">{formatPrice((docOrder.sales_order_value || 0) * 0.82)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
                      <span>Estimated GST (18%)</span>
                      <span className="font-bold">{formatPrice((docOrder.sales_order_value || 0) * 0.18)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold pt-1">
                      <span>Gross Invoice Value</span>
                      <span>{formatPrice(docOrder.sales_order_value || 0)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Less: Advance Paid</span>
                      <span>- {formatPrice(docOrder.advance_paid || 0)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-bold border-b border-slate-200 pb-3">
                      <span>Less: Wallet / Previous Credit</span>
                      <span>- ₹0</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                        Calculated Due Balance
                      </span>
                      <span className="font-black text-xl text-[#B8860B]">
                        {formatPrice((docOrder.sales_order_value || 0) - (docOrder.advance_paid || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Receipt size={14} /> Enter Official Tally Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                        Generated Against SO #
                      </label>
                      <input
                        type="text"
                        value={soNumber}
                        onChange={(e) => setSoNumber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                        Official Tally Inv #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INV/25-26/042"
                        value={tallyInvoiceNo}
                        onChange={(e) => setTallyInvoiceNo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      Exact Tally Amount (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="Enter final amount to adjust round-offs"
                      value={tallyAmount}
                      onChange={(e) => setTallyAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-black text-[#B8860B] outline-none focus:border-[#B8860B]"
                    />
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => {
                      setInvoiceUploaded(true);
                      toast.success("Tally PDF Attached");
                    }}
                    className={`w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-xl transition-all ${invoiceUploaded ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 hover:border-[#B8860B] bg-slate-50 text-slate-500"}`}
                  >
                    {invoiceUploaded ? <CheckCircle2 size={20} /> : <FileUp size={20} />}
                    <span className="text-sm font-bold">
                      {invoiceUploaded ? "Tax Invoice Attached" : "Upload Tally Tax Invoice (PDF)"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 rounded-b-3xl">
                <button
                  onClick={() => setDocOrder(null)}
                  className="px-6 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestBalance}
                  disabled={acting === docOrder.id}
                  className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  {acting === docOrder.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Link size={18} /> Lock Invoice & Request Balance
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFinance;
