import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { releaseOrderToManufacturing } from "@/lib/order-authority/orderAuthorityClient";
import {
  buildPaymentIdempotencyKey,
  buildPaymentCorrelationId,
  buildPaymentProofIdentity,
  type PaymentProofIdentityInput,
  getPaymentFacts,
  recordPaymentProof,
  resolvePaymentBinding,
  verifyPayment,
} from "@/lib/order-authority/paymentAuthorityClient";
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
  BookOpen,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { queueNotification } from "@/utils/notificationOutbox";
import { LedgerDisputesPanel } from "@/components/admin/LedgerDisputesPanel";
import { exportTallyBridgeV1ToCsv, isOrderReadyForTallyExportV1 } from "@/utils/tallyExportV1";
import {
  deriveFinanceReleaseState,
  getAdvanceVerificationGuardMessages,
  getFinanceReleaseBlockers,
  getShortTermCreditReleaseGuardMessages,
} from "@/utils/financeReleaseState";
import { FinanceReleaseChips } from "@/components/admin/FinanceReleaseChips";
import {
  buildCreditRequestIdentity,
  buildCreditWalletCorrelationId,
  buildCreditWalletIdempotencyKey,
  buildWalletIdentity,
  decideCreditRequest,
  recordWalletEntry,
  requestCredit,
  resolveCreditBinding,
} from "@/lib/order-authority/creditWalletAuthorityClient";

interface FinanceOrder {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  advance_paid: number | null;
  advance_required: number | null;
  created_at: string;
  company_id: string | null;
  payment_receipt_url: string | null;
  final_invoice_url?: string | null;
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
  order_id: string | null;
  proforma_invoice_id: string | null;
  commercial_version_id: string | null;
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
  order?: { company_id: string | null; company: { business_name: string } | null } | null;
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

interface DplLineItem {
  quantity: number;
  actual_packed_qty?: number | null;
  product?: { price_per_kg?: number | null } | null;
}

interface InwardAdviceRow {
  id: string;
  company_id: string | null;
  sales_exec_id: string | null;
  reason: string | null;
  expected_value: number | null;
  accompanying_docs: string | null;
  created_at: string | null;
  status: string | null;
}

interface CompanyNameRow {
  id: string;
  business_name: string;
}

interface UserNameRow {
  id: string;
  full_name: string | null;
  name: string | null;
}

interface InwardMaterialItemRow {
  advice_id: string;
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

type FinanceQueue = "validation" | "approvals" | "invoicing" | "returns" | "returns_scrutiny" | "commission_payouts" | "ledger";

interface SalesExecPayout {
  id: string;
  full_name: string | null;
  name: string | null;
  commission_rate_percentage: number | null;
  earned: number;
  paid: number;
}

// Financial Entry Form state
interface FinancialEntryState {
  orderId: string;
  companyName: string;
  soValue: number;
  actualAmountReceived: string;
  paymentMode: string;
  utrReference: string;
  receiptUrl: string | null;
}

const PAYMENT_MODES = ["NEFT/RTGS", "UPI", "Cheque", "Cash", "Wire Transfer", "Credit Note"];

const AdminFinance = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<FinanceQueue>("validation");

  // Financial Entry Modal
  const [financialEntry, setFinancialEntry] = useState<FinancialEntryState | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);

  // Short-Term Credit Modal
  const [shortTermTarget, setShortTermTarget] = useState<FinanceOrder | null>(null);
  const [shortTermDays, setShortTermDays] = useState("");
  const [savingShortTerm, setSavingShortTerm] = useState(false);

  // Invoicing Modal State
  const [docOrder, setDocOrder] = useState<FinanceOrder | null>(null);
  const [tallyAmount, setTallyAmount] = useState("");
  const [tallyInvoiceNo, setTallyInvoiceNo] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);

  // DPL Reconciliation state
  const [dplData, setDplData] = useState<{ soValue: number; dplValue: number; items: DplLineItem[] } | null>(null);

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

  // Commission Payouts State
  const [salesExecPayouts, setSalesExecPayouts] = useState<SalesExecPayout[]>([]);
  const [payoutActing, setPayoutActing] = useState<string | null>(null);
  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, string>>({});
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});

  // Tally Bridge v1 (single-order CSV, per-dispatch legs)
  const [tallyExportOrderId, setTallyExportOrderId] = useState("");
  const [tallyExportDispatchId, setTallyExportDispatchId] = useState("");
  const [tallyDispatchOptions, setTallyDispatchOptions] = useState<{ id: string; label: string }[]>([]);
  const [tallyExporting, setTallyExporting] = useState(false);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, sales_order_value, advance_paid, advance_required, created_at, company_id, payment_receipt_url, final_invoice_url, company:companies(business_name)",
      )
      .order("created_at", { ascending: false });

    if (!error && data) setOrders(data as unknown as FinanceOrder[]);
  };

  const fetchCreditRequests = async () => {
    const { data, error } = await supabase
      .from("credit_requests")
      .select(
        "id, company_id, order_id, proforma_invoice_id, commercial_version_id, credit_type, requested_amount, notes, status, created_at, requested_by, company:companies(business_name), requester:users!credit_requests_requested_by_fkey(full_name, email)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) setCreditRequests(data as unknown as CreditRequest[]);
  };

  const fetchReturns = async () => {
    const { data, error } = await supabase
      .from("order_returns")
      .select(
        "id, order_id, product_id, quantity_returned, original_value, final_credit_value, loss_amount, admin_approval, status, reason, created_at, product:products(name, base_price), order:orders(company_id, company:companies(business_name))"
      )
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReturnRecords(data as unknown as ReturnRecord[]);
      // Initialize credit values and approvals
      const cv: Record<string, string> = {};
      const ap: Record<string, boolean> = {};
      (data as ReturnRecord[]).forEach((r) => {
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

    const companyIds = [...new Set(advices.map((a) => a.company_id).filter(Boolean))] as string[];
    const execIds = [...new Set(advices.map((a) => a.sales_exec_id).filter(Boolean))] as string[];

    const [{ data: companies }, { data: execs }, { data: items }] = await Promise.all([
      companyIds.length > 0 ? supabase.from("companies").select("id, business_name").in("id", companyIds) : { data: [] },
      execIds.length > 0 ? supabase.from("users").select("id, full_name, name").in("id", execIds) : { data: [] },
      supabase.from("inward_material_items").select("advice_id").in("advice_id", advices.map((a) => a.id)),
    ]);

    const companyMap: Record<string, string> = {};
    (companies ?? []).forEach((c: CompanyNameRow) => { companyMap[c.id] = c.business_name; });
    const execMap: Record<string, string> = {};
    (execs ?? []).forEach((e: UserNameRow) => { execMap[e.id] = e.full_name || e.name || "—"; });
    const itemCountMap: Record<string, number> = {};
    (items ?? []).forEach((it: InwardMaterialItemRow) => { itemCountMap[it.advice_id] = (itemCountMap[it.advice_id] || 0) + 1; });

    setScrutinyRecords(
      advices.map((a: InwardAdviceRow) => ({
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
        const identity = buildWalletIdentity({
          companyId: scrutinyTarget.company_id,
          direction: "credit",
          amount: settlementVal,
          currency: "INR",
          sourceChannel: "CENTRAL_FINANCE",
          sourceReference: `inward-advice:${scrutinyTarget.id}`,
          reason: "Inward material advice settlement",
        });
        await recordWalletEntry({
          companyId: scrutinyTarget.company_id,
          direction: "credit",
          amount: settlementVal,
          currency: "INR",
          sourceChannel: "CENTRAL_FINANCE",
          sourceReference: `inward-advice:${scrutinyTarget.id}`,
          reason: "Inward material advice settlement",
          correlationId: await buildCreditWalletCorrelationId("wallet", identity),
          idempotencyKey: await buildCreditWalletIdempotencyKey("wallet", identity),
          actorId: user?.id ?? "",
        });
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

      // Template-driven wallet credited notification
      try {
        const { data: evt } = await supabase
          .from("notification_events")
          .select("is_enabled, template_body")
          .eq("event_key", "wallet_credited")
          .single();

        if (evt?.is_enabled) {
          const generatedMessage = (evt.template_body || "")
            .replace(/\{\{amount\}\}/g, `₹${settlementVal.toLocaleString("en-IN")}`)
            .replace(/\{\{client_name\}\}/g, scrutinyTarget.company_name || "Unknown");

          await supabase.from("audit_logs").insert({
            action_type: "wallet_credit_notified",
            module_name: "Finance",
            entity_name: "inward_material_advice",
            entity_id: scrutinyTarget.id,
            actor_id: user?.id || null,
            new_value: {
              generated_message: generatedMessage,
              amount: settlementVal,
              company: scrutinyTarget.company_name,
            },
          });

          // Queue to outbox for actual delivery
          let recipientPhone: string | null = null;
          if (scrutinyTarget.company_id) {
            const { data: compApp } = await supabase
              .from("b2b_applications")
              .select("contact_phone")
              .eq("user_id", scrutinyTarget.company_id)
              .maybeSingle();
            recipientPhone = compApp?.contact_phone || null;
          }
          await queueNotification({
            eventType: "wallet_credited",
            messageBody: generatedMessage,
            recipientPhone,
            priority: "normal",
          });
        }
      } catch { /* notification logging is non-critical */ }

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

  // Fetch commission payouts data
  const fetchCommissionPayouts = async () => {
    // Get all sales executives
    const { data: execs } = await supabase
      .from("users")
      .select("id, full_name, name, commission_rate_percentage")
      .in("role", ["sales_executive"]);
    if (!execs || execs.length === 0) { setSalesExecPayouts([]); return; }

    // For each exec, get delivered orders for their companies + payouts
    const results: SalesExecPayout[] = [];
    for (const exec of execs) {
      const { data: comps } = await supabase.from("companies").select("id").eq("account_manager_id", exec.id);
      const compIds = (comps ?? []).map((c) => c.id);
      let earned = 0;
      if (compIds.length > 0) {
        const { data: ords } = await supabase
          .from("orders")
          .select("sales_order_value")
          .in("company_id", compIds)
          .eq("status", "delivered");
        const totalDelivered = (ords ?? []).reduce((s, o) => s + (o.sales_order_value || 0), 0);
        earned = totalDelivered * ((exec.commission_rate_percentage || 0) / 100);
      }
      const { data: payouts } = await supabase
        .from("commission_payouts")
        .select("amount_paid")
        .eq("executive_id", exec.id);
      const totalPaid = (payouts ?? []).reduce((s, p) => s + (p.amount_paid || 0), 0);
      results.push({ ...exec, earned, paid: totalPaid });
    }
    setSalesExecPayouts(results);
  };

  const handleSettleCommission = async (exec: SalesExecPayout) => {
    const amount = parseFloat(payoutAmounts[exec.id] || "0");
    if (amount <= 0) { toast.error("Enter a valid amount."); return; }
    setPayoutActing(exec.id);
    const { error } = await supabase.from("commission_payouts").insert({
      executive_id: exec.id,
      amount_paid: amount,
      paid_by: user?.id || null,
      payment_ref: payoutRefs[exec.id] || null,
    });
    if (error) {
      toast.error("Payout failed: " + error.message);
    } else {
      await supabase.from("audit_logs").insert({
        action_type: "commission_payout_settled",
        module_name: "finance",
        entity_name: "commission_payouts",
        entity_id: exec.id,
        actor_id: user?.id || null,
        risk_level: "high",
        new_value: { executive: exec.full_name || exec.name, amount, ref: payoutRefs[exec.id] || null },
      });
      toast.success(`₹${amount.toLocaleString("en-IN")} paid to ${exec.full_name || exec.name}.`);
      setPayoutAmounts((p) => ({ ...p, [exec.id]: "" }));
      setPayoutRefs((p) => ({ ...p, [exec.id]: "" }));
      fetchCommissionPayouts();
    }
    setPayoutActing(null);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchOrders(), fetchCreditRequests(), fetchReturns(), fetchScrutiny(), fetchCommissionPayouts()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!tallyExportOrderId) {
      setTallyDispatchOptions([]);
      setTallyExportDispatchId("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("dispatches")
        .select("id, dispatch_date, dispatch_number, is_partial")
        .eq("order_id", tallyExportOrderId)
        .order("dispatch_date", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      setTallyDispatchOptions(
        (data || []).map((d) => ({
          id: d.id,
          label: `${d.dispatch_number || d.id.slice(0, 8)}${d.dispatch_date ? ` · ${d.dispatch_date}` : ""}${d.is_partial ? " (partial)" : ""}`,
        })),
      );
      setTallyExportDispatchId("");
    })();
    return () => {
      cancelled = true;
    };
  }, [tallyExportOrderId]);

  const handleValidatePayment = async (orderId: string) => {
    setActing(orderId);
    try {
      // GUARD: Verify order has a value before proceeding
      const target = orders.find(o => o.id === orderId);
      if (!target || (target.sales_order_value ?? 0) <= 0) {
        toast.error("⛔ Cannot release order with ₹0 value. Check order items.");
        console.error(`[Finance] ABORT: Tried to validate order ${orderId} with ₹0 value.`);
        setActing(null);
        return;
      }
      const releaseGuards = getAdvanceVerificationGuardMessages({
        status: target.status,
        payment_status: target.payment_status,
        advance_paid: target.advance_paid,
        advance_required: target.advance_required,
        sales_order_value: target.sales_order_value,
      });
      if (releaseGuards.length > 0) {
        toast.error(releaseGuards.join(" "));
        setActing(null);
        return;
      }
      await releaseOrderToManufacturing(orderId, "verified_advance");
      toast.success("Advance verified — order moved to Manufacturing.");
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // Financial Entry Submit
  const handleFinancialEntrySubmit = async () => {
    if (!financialEntry) return;
    const amount = parseFloat(financialEntry.actualAmountReceived);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount."); return; }
    if (!financialEntry.paymentMode) { toast.error("Select payment mode."); return; }
    if (financialEntry.paymentMode !== "Cash" && !financialEntry.utrReference.trim()) {
      toast.error("UTR / Reference Number is mandatory for bank payments."); return;
    }
    setSavingEntry(true);
    try {
      // IMMUTABLE VALUE PROTECTION: Fetch the LIVE database value — never trust local state
      const { data: liveOrder, error: liveErr } = await supabase
        .from("orders")
        .select("sales_order_value, company_id, status, payment_status, advance_paid, advance_required")
        .eq("id", financialEntry.orderId)
        .single();

      if (liveErr || !liveOrder) {
        toast.error("⛔ Could not fetch live order data. Aborting.");
        console.error("[Finance] ABORT: Failed to fetch live order", liveErr);
        setSavingEntry(false);
        return;
      }

      const liveGuards = getAdvanceVerificationGuardMessages({
        status: liveOrder.status,
        payment_status: liveOrder.payment_status,
        advance_paid: liveOrder.advance_paid,
        advance_required: liveOrder.advance_required,
        sales_order_value: liveOrder.sales_order_value,
      });
      if (liveGuards.length > 0) {
        toast.error(liveGuards.join(" "));
        setSavingEntry(false);
        return;
      }

      const binding = await resolvePaymentBinding(financialEntry.orderId);
      const facts = await getPaymentFacts(binding.piId);
      if (facts.orderId !== financialEntry.orderId || facts.commercialVersionId !== binding.commercialVersionId) {
        throw new Error("Core payment facts do not match the governed order version");
      }
      const liveSOValue = facts.commercialValue;

      // GUARD: Never release a ₹0 order
      if (liveSOValue <= 0) {
        toast.error("⛔ Cannot release order with ₹0 value. Run Restore Total first.");
        console.error(`[Finance] ABORT: order ${financialEntry.orderId} has ₹0 live DB value.`);
        setSavingEntry(false);
        return;
      }

      if (!financialEntry.receiptUrl) {
        throw new Error("Canonical payment proof requires an uploaded receipt before verification");
      }
      const proofIdentityInput: PaymentProofIdentityInput = {
        orderId: financialEntry.orderId,
        piId: binding.piId,
        commercialVersionId: binding.commercialVersionId,
        paymentType: "advance",
        submittedAmount: amount,
        currency: "INR",
        paymentMode: financialEntry.paymentMode,
        externalReference: financialEntry.utrReference.trim() || null,
        proofEvidenceReference: financialEntry.receiptUrl,
        sourceChannel: "SALES",
        sourceReference: `central:finance-entry:${financialEntry.orderId}`,
      };
      const proofIdentity = buildPaymentProofIdentity(proofIdentityInput);
      const correlationId = await buildPaymentCorrelationId("proof", proofIdentity);
      const proof = await recordPaymentProof({
        ...proofIdentityInput,
        correlationId,
        idempotencyKey: await buildPaymentIdempotencyKey("proof", proofIdentity),
        actorId: user?.id ?? "",
      });
      const verificationCorrelationId = await buildPaymentCorrelationId("verify", proof.paymentId);
      await verifyPayment({
        paymentId: proof.paymentId,
        verifiedAmount: amount,
        verifiedReference: financialEntry.utrReference.trim() || null,
        verificationEvidenceReference: financialEntry.receiptUrl,
        reason: "Finance review",
        correlationId: verificationCorrelationId,
        idempotencyKey: await buildPaymentIdempotencyKey("verify", proof.paymentId),
        actorId: user?.id ?? "",
      });

      toast.success(`₹${amount.toLocaleString("en-IN")} verified in Core; production release remains a separate governed action.`);
      setFinancialEntry(null);
      fetchOrders();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Verification failed."); }
    setSavingEntry(false);
  };

  // Short-Term Credit Release
  const handleShortTermCreditRelease = async () => {
    if (!shortTermTarget || !shortTermDays) { toast.error("Set payment deadline days."); return; }
    const days = parseInt(shortTermDays);
    if (isNaN(days) || days <= 0) { toast.error("Invalid deadline."); return; }
    setSavingShortTerm(true);
    try {
      const creditGuards = getShortTermCreditReleaseGuardMessages({
        status: shortTermTarget.status,
        payment_status: shortTermTarget.payment_status,
        advance_paid: shortTermTarget.advance_paid,
        advance_required: shortTermTarget.advance_required,
        sales_order_value: shortTermTarget.sales_order_value,
      });
      if (creditGuards.length > 0) {
        toast.error(creditGuards.join(" "));
        setSavingShortTerm(false);
        return;
      }
      // GUARD: Never release a ₹0 order
      if ((shortTermTarget.sales_order_value ?? 0) <= 0) {
        toast.error("⛔ Cannot release order with ₹0 value.");
        setSavingShortTerm(false);
        return;
      }
      if (!shortTermTarget.company_id || !user?.id) throw new Error("Authenticated Finance actor and company are required");
      const binding = await resolveCreditBinding(shortTermTarget.id);
      const base = {
        companyId: shortTermTarget.company_id,
        orderId: shortTermTarget.id,
        proformaInvoiceId: binding.piId,
        commercialVersionId: binding.commercialVersionId,
        creditType: "short_term_so" as const,
        requestedAmount: shortTermTarget.sales_order_value ?? 0,
        sourceChannel: "CENTRAL_FINANCE",
        sourceReference: `central:short-term-credit:${shortTermTarget.id}`,
        reason: `Short-term credit requested with ${days}-day deadline`,
        expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
      };
      const identity = buildCreditRequestIdentity(base);
      const request = await requestCredit({
        ...base,
        correlationId: await buildCreditWalletCorrelationId("credit-request", identity),
        idempotencyKey: await buildCreditWalletIdempotencyKey("credit-request", identity),
        actorId: user.id,
      });
      toast.success(request.alreadyRequested ? "Existing governed short-term credit request restored." : `Short-term credit request submitted for Finance decision (${days}-day expiry).`);
      setShortTermTarget(null);
      setShortTermDays("");
      fetchOrders();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Governed credit request failed."); }
    setSavingShortTerm(false);
  };

  // Fetch DPL data for invoicing modal
  const fetchDplForOrder = async (orderId: string) => {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, quantity, actual_packed_qty, product:products(name, price_per_kg)")
      .eq("order_id", orderId);
    if (!items) return;
    const lineItems = (items ?? []) as DplLineItem[];
    const soVal = lineItems.reduce((s, i) => s + (i.quantity * (i.product?.price_per_kg || 0)), 0);
    const dplVal = lineItems.reduce((s, i) => s + ((i.actual_packed_qty ?? i.quantity) * (i.product?.price_per_kg || 0)), 0);
    setDplData({ soValue: soVal, dplValue: dplVal, items: lineItems });
  };

  // Generate barcode ZPL label
  const generateBarcodeLabel = (orderId: string, companyName: string, boxNum: number, totalBoxes: number, tallyInv: string) => {
    const consignor = "TCF Chocolates & Gifts Pvt. Ltd.\nWZ-117, Kirti Nagar Industrial Area\nNew Delhi - 110015";
    const barcodeData = `${orderId.slice(0, 8).toUpperCase()}-${tallyInv || "DRAFT"}`;
    const label = `Pack [${String(boxNum).padStart(2, "0")}] of [${totalBoxes}]\n\nConsignee: ${companyName}\nConsignor: ${consignor}\n\nBarcode: ${barcodeData}\n\n[TSC TE 244 Format]`;
    // Open in new window for printing
    const w = window.open("", "_blank", "width=400,height=600");
    if (w) {
      w.document.write(`<html><head><title>Dispatch Label</title><style>body{font-family:monospace;padding:24px;font-size:13px;white-space:pre-wrap}h2{text-align:center;border-bottom:2px solid #000;padding-bottom:8px}.barcode{text-align:center;font-size:18px;font-weight:bold;letter-spacing:3px;border:2px solid #000;padding:12px;margin:16px 0}@media print{button{display:none}}</style></head><body>`);
      w.document.write(`<h2>DISPATCH LABEL</h2>\n${label.replace(/\n/g, "<br/>")}`);
      w.document.write(`<div class="barcode">${barcodeData}</div>`);
      w.document.write(`<button onclick="window.print()" style="width:100%;padding:12px;font-size:14px;font-weight:bold;cursor:pointer;margin-top:16px">🖨️ Print Label</button>`);
      w.document.write("</body></html>");
      w.document.close();
    }
  };

  const handleCreditAction = async (req: CreditRequest, action: "approved" | "rejected") => {
    setActing(req.id);
    try {
      if (!user?.id) throw new Error("Authenticated Finance actor is required");
      if (!req.order_id || !req.proforma_invoice_id || !req.commercial_version_id) {
        throw new Error("This request has no exact SO/PI/commercial-version binding and is not eligible for governed decision.");
      }
      const decisionIdentity = JSON.stringify([req.id, action, req.notes || ""]);
      const decision = await decideCreditRequest({
        requestId: req.id,
        approve: action === "approved",
        reason: req.notes?.trim() || `Finance ${action} decision`,
        sourceChannel: "CENTRAL_FINANCE",
        correlationId: await buildCreditWalletCorrelationId("credit-decision", decisionIdentity),
        idempotencyKey: await buildCreditWalletIdempotencyKey("credit-decision", decisionIdentity),
        actorId: user.id,
      });

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

      toast.success(decision.alreadyDecided ? `Existing governed ${decision.status} decision restored.` : action === "approved"
        ? `Credit approved for ${req.company?.business_name}. No production release was performed.`
        : "Credit request rejected.");
      fetchCreditRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Governed credit decision failed.");
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
      const companyId = ret.order?.company_id;
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
      if (companyId && ret.order_id && user?.id) {
        const binding = await resolveCreditBinding(ret.order_id);
        const identity = buildWalletIdentity({
          companyId,
          direction: "credit",
          amount: creditValue,
          currency: "INR",
          orderId: ret.order_id,
          proformaInvoiceId: binding.piId,
          commercialVersionId: binding.commercialVersionId,
          sourceChannel: "CENTRAL_FINANCE",
          sourceReference: `order-return:${ret.id}`,
          reason: "Approved order return wallet credit",
        });
        await recordWalletEntry({
          companyId, direction: "credit", amount: creditValue, currency: "INR",
          orderId: ret.order_id, proformaInvoiceId: binding.piId, commercialVersionId: binding.commercialVersionId,
          sourceChannel: "CENTRAL_FINANCE", sourceReference: `order-return:${ret.id}`,
          reason: "Approved order return wallet credit",
          correlationId: await buildCreditWalletCorrelationId("wallet", identity),
          idempotencyKey: await buildCreditWalletIdempotencyKey("wallet", identity), actorId: user.id,
        });
      } else if (creditValue > 0) {
        throw new Error("A governed order/PI/commercial-version binding is required before wallet credit.");
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
      toast.error(err instanceof Error ? err.message : "Governed wallet credit failed.");
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
      const parsedTally = parseFloat(tallyAmount);
      if (isNaN(parsedTally) || parsedTally <= 0) {
        toast.error("⛔ Tally amount must be greater than ₹0.");
        setActing(null);
        return;
      }
      await supabase
        .from("orders")
        .update({
          sales_order_value: parsedTally,
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

  // Queues — FILTER OUT ₹0 orders so Finance only sees actionable, valued orders
  const valuedOrders = orders.filter((o) => (o.sales_order_value || 0) > 0);
  const zeroValueOrders = orders.filter((o) => (o.sales_order_value || 0) <= 0 && o.status !== "draft");
  const validationQueue = valuedOrders.filter((o) => o.status === "submitted" || o.payment_status === "awaiting_receipt" || o.payment_status === "unpaid");
  const invoicingQueue = valuedOrders.filter((o) => o.status === "in_production" || o.status === "packed_ready");
  const tallyEligibleOrders = useMemo(
    () =>
      orders
        .filter((o) => (o.sales_order_value || 0) > 0)
        .filter((o) => isOrderReadyForTallyExportV1(o.status)),
    [orders],
  );

  const handleTallyBridgeExport = async () => {
    if (!tallyExportOrderId) {
      toast.error("Select an order to export.");
      return;
    }
    setTallyExporting(true);
    try {
      const tallyResult = await exportTallyBridgeV1ToCsv(supabase, tallyExportOrderId, {
        dispatchId: tallyExportDispatchId || undefined,
      });
      if ("error" in tallyResult) {
        toast.error(tallyResult.error);
        return;
      }
      for (const w of tallyResult.warnings) {
        toast.warning(w, { duration: 8000 });
      }
      const blob = new Blob(["\uFEFF", tallyResult.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tallyResult.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Tally Bridge v1 CSV downloaded.");
    } finally {
      setTallyExporting(false);
    }
  };

  const totalValueToday = orders.reduce((sum, o) => sum + (o.sales_order_value || 0), 0);

  if (loading)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
        <div className="grid w-full max-w-md gap-3">
          <Skeleton className="h-4 w-[75%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[83%]" />
        </div>
        <p className="text-sm text-slate-500">Loading finance queues…</p>
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
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total SO Value</p>
            <p className="text-2xl font-black text-[#B8860B]">{formatPrice(totalValueToday)}</p>
          </div>
        </div>
      </div>

      {/* QUEUE NAVIGATION */}
        <div className="max-w-7xl mx-auto min-w-0 px-4 sm:px-6 -mt-6">
        <div className="flex min-h-0 gap-2 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white p-2 scrollbar-hide pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {[
            { id: "validation", label: "Advance Receipts", count: validationQueue.length, icon: Banknote },
            { id: "approvals", label: "Credit Approvals", count: creditRequests.length, icon: ShieldCheck },
            { id: "invoicing", label: "Post-Pack Invoicing", count: invoicingQueue.length, icon: Calculator },
            { id: "returns", label: "Returns Settlement", count: returnRecords.length, icon: RotateCcw },
            { id: "returns_scrutiny", label: "Returns Scrutiny", count: scrutinyRecords.length, icon: ShieldAlert },
            { id: "commission_payouts", label: "Commission Payouts", count: salesExecPayouts.length, icon: IndianRupee },
            { id: "ledger", label: "Ledger & Disputes", count: 0, icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveQueue(tab.id as FinanceQueue)}
              className={`flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] focus-visible:ring-offset-2 ${activeQueue === tab.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
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

        {/* ZERO-VALUE RESTORE SECTION */}
        {zeroValueOrders.length > 0 && (
          <div className="mt-6 bg-red-50 border-2 border-red-300 rounded-2xl p-5">
            <h3 className="font-bold text-red-800 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <AlertTriangle size={16} /> ₹0 Value Orders — Restore Required ({zeroValueOrders.length})
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {zeroValueOrders.map((order) => (
                <div key={order.id} className="bg-white border border-red-200 rounded-xl p-4 flex flex-col gap-2">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">SO #{order.id.split("-")[0]}</p>
                    <p className="font-bold text-slate-900">{order.company?.business_name || "Unknown"}</p>
                    <p className="text-xs text-red-500 font-bold">Status: {order.status} • Value: ₹0</p>
                  </div>
                  <button
                    onClick={async () => {
                      setActing(order.id);
                      try {
                        const { data: restored, error } = await supabase.rpc("restore_order_financials", { _order_id: order.id });
                        if (error) {
                          toast.error("Restore failed: " + error.message);
                        } else {
                          toast.success(`✅ Order value restored to ${formatPrice(restored || 0)}`);
                          await supabase.from("audit_logs").insert({
                            action_type: "order_value_restored",
                            module_name: "Finance",
                            entity_name: "orders",
                            entity_id: order.id,
                            actor_id: user?.id || null,
                            new_value: { restored_value: restored },
                            risk_level: "high",
                          });
                          fetchOrders();
                        }
                      } catch { toast.error("Restore failed."); }
                      setActing(null);
                    }}
                    disabled={acting === order.id}
                    className="py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 flex justify-center items-center gap-1.5"
                  >
                    {acting === order.id ? <Loader2 size={14} className="animate-spin" /> : <><RotateCcw size={14} /> Restore Total from Items</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <div className="mb-3 space-y-1.5">
                      <FinanceReleaseChips
                        variant="admin"
                        state={deriveFinanceReleaseState({
                          status: order.status,
                          payment_status: order.payment_status,
                          advance_paid: order.advance_paid,
                          advance_required: order.advance_required,
                          sales_order_value: order.sales_order_value,
                        })}
                      />
                      <p className="text-[10px] leading-snug text-slate-600">
                        {(getFinanceReleaseBlockers({
                          status: order.status,
                          payment_status: order.payment_status,
                          advance_paid: order.advance_paid,
                          advance_required: order.advance_required,
                          sales_order_value: order.sales_order_value,
                        })
                          .map((b) => b.message)
                          .join(" · ") || "No finance blockers — awaiting finance action or customer receipt.")}
                      </p>
                    </div>
                    {order.payment_receipt_url && (
                      <button
                        onClick={() => window.open(order.payment_receipt_url!, "_blank")}
                        className="w-full py-2 mb-2 border border-blue-300 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50 flex justify-center items-center gap-1"
                      >
                        <FileText size={14} /> View Uploaded Receipt
                      </button>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setFinancialEntry({
                          orderId: order.id,
                          companyName: order.company?.business_name || "Unknown",
                          soValue: order.sales_order_value || 0,
                          actualAmountReceived: "",
                          paymentMode: "",
                          utrReference: "",
                          receiptUrl: order.payment_receipt_url || null,
                        })}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1"
                      >
                        <ShieldCheck size={14} /> Record Proof & Verify
                      </button>
                      <button
                        onClick={() => setShortTermTarget(order)}
                        className="flex-1 py-2.5 border border-violet-300 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-50 flex justify-center items-center gap-1"
                      >
                        <Receipt size={14} /> Short-Term Credit
                      </button>
                      <button
                        onClick={async () => {
                          // 1. Insert notification for client
                          const notifMsg = `Action Required: Please upload advance for Order #${order.id.slice(0, 8).toUpperCase()}.`;
                          await supabase.from("notifications").insert({
                            company_id: order.company_id,
                            type: "payment_request",
                            message: notifMsg,
                          });
                          // 2. Update order to awaiting_advance so Dashboard reacts
                          await supabase.from("orders").update({ payment_status: "awaiting_advance" }).eq("id", order.id);
                          // 3. Queue notification for email delivery
                          await queueNotification({
                            eventType: "advance_requested",
                            messageBody: notifMsg,
                            priority: "high",
                          });
                          // 4. WhatsApp placeholder
                          console.log(`[WhatsApp Placeholder] Sending to company ${order.company_id}: "${notifMsg}"`);
                          toast.success(`Payment request sent to ${order.company?.business_name || "Client"}`);
                          fetchOrders();
                        }}
                        className="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 flex justify-center items-center gap-1"
                      >
                        Request Advance
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
                    <div className="mb-3">
                      <FinanceReleaseChips
                        variant="admin"
                        state={deriveFinanceReleaseState({
                          status: order.status,
                          payment_status: order.payment_status,
                          advance_paid: order.advance_paid,
                          advance_required: order.advance_required,
                          sales_order_value: order.sales_order_value,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setDocOrder(order);
                          setSoNumber(`SO-${order.id.split("-")[0].toUpperCase()}`);
                          fetchDplForOrder(order.id);
                        }}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black flex justify-center items-center gap-1.5"
                      >
                        <Calculator size={14} /> Process Final Invoice
                      </button>
                      <button
                        onClick={() => generateBarcodeLabel(order.id, order.company?.business_name || "Client", 1, 1, "")}
                        className="w-full py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex justify-center items-center gap-1.5"
                      >
                        🏷️ Print Dispatch Barcodes
                      </button>
                    </div>
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
                          {ret.order?.company?.business_name || "Unknown Company"} • {ret.quantity_returned} units returned
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

          {/* QUEUE 6: COMMISSION PAYOUTS */}
          {activeQueue === "commission_payouts" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {salesExecPayouts.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No sales executives found.</p>
              ) : (
                salesExecPayouts.map((exec) => {
                  const pending = exec.earned - exec.paid;
                  return (
                    <div key={exec.id} className="bg-white border-l-4 border-[#B8860B] rounded-xl p-5 shadow-sm">
                      <div className="border-b border-slate-100 pb-3 mb-3">
                        <p className="font-black text-slate-900 text-lg">{exec.full_name || exec.name || "—"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Rate: {exec.commission_rate_percentage || 0}%</p>
                      </div>
                      <div className="space-y-1 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Earned</span>
                          <span className="font-bold text-emerald-600">{formatPrice(exec.earned)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Paid</span>
                          <span className="font-bold text-slate-700">{formatPrice(exec.paid)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1">
                          <span className="text-slate-800 font-bold">Pending</span>
                          <span className={`font-black ${pending > 0 ? "text-[#B8860B]" : "text-slate-400"}`}>{formatPrice(pending > 0 ? pending : 0)}</span>
                        </div>
                      </div>
                      {pending > 0 && (
                        <div className="space-y-2">
                          <input
                            type="number"
                            min="0"
                            max={pending}
                            placeholder="Amount to pay"
                            value={payoutAmounts[exec.id] || ""}
                            onChange={(e) => setPayoutAmounts((p) => ({ ...p, [exec.id]: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-[#B8860B]"
                          />
                          <input
                            type="text"
                            placeholder="Payment ref (optional)"
                            value={payoutRefs[exec.id] || ""}
                            onChange={(e) => setPayoutRefs((p) => ({ ...p, [exec.id]: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-[#B8860B]"
                          />
                          <button
                            onClick={() => handleSettleCommission(exec)}
                            disabled={payoutActing === exec.id}
                            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1.5"
                          >
                            {payoutActing === exec.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <><IndianRupee size={14} /> Settle Payment</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* QUEUE 7: BI-MONTHLY LEDGER & DISPUTES */}
          {activeQueue === "ledger" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <Receipt size={18} className="text-[#B8860B]" />
                  Tally Bridge v1
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Single-order CSV export: one row per packing line per dispatch leg (packed quantities only). Order must be at least dispatched.
                </p>
                {tallyEligibleOrders.length === 0 ? (
                  <p className="text-sm text-slate-500 font-medium">No dispatched / delivered orders with value in the current list.</p>
                ) : (
                  <div className="flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Order</label>
                      <select
                        value={tallyExportOrderId}
                        onChange={(e) => setTallyExportOrderId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                      >
                        <option value="">Select order…</option>
                        {tallyEligibleOrders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.company?.business_name || "Unknown"} · {o.id.slice(0, 8)}… · {o.status} · {formatPrice(o.sales_order_value || 0)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Dispatch leg</label>
                      <select
                        value={tallyExportDispatchId}
                        onChange={(e) => setTallyExportDispatchId(e.target.value)}
                        disabled={!tallyExportOrderId || tallyDispatchOptions.length === 0}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B] disabled:opacity-50"
                      >
                        <option value="">All legs in one file</option>
                        {tallyDispatchOptions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleTallyBridgeExport()}
                      disabled={tallyExporting || !tallyExportOrderId}
                      className="py-3 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {tallyExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                      Download CSV
                    </button>
                  </div>
                )}
                {tallyExportOrderId &&
                  !orders.find((o) => o.id === tallyExportOrderId)?.final_invoice_url && (
                    <div className="mt-4 flex gap-2 items-start rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                      <p>
                        <span className="font-bold">No final invoice URL on this order.</span> Export is still allowed — reconcile line totals with your signed tax invoice before posting to Tally.
                      </p>
                    </div>
                  )}
              </div>
              <LedgerDisputesPanel />
            </div>
          )}
        </div>
      </div>

      {/* SCRUTINY MODAL */}
      <AnimatePresence>
        {scrutinyTarget && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="z-[190] flex max-h-[min(92dvh,100%)] w-full max-w-[min(100%,32rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Returns Scrutiny</h3>
                  <p className="mt-1 text-sm text-slate-500">{scrutinyTarget.company_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScrutinyTarget(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] focus-visible:ring-offset-2"
                  aria-label="Close scrutiny modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-6">
                <div className="space-y-5">
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

                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={handleExecuteSettlement}
                  disabled={scrutinySaving}
                  className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 font-bold text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-60"
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
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="z-[190] flex max-h-[min(92dvh,100%)] w-full max-w-[min(100%,42rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">Process Final Invoice</h3>
                  <p className="mt-1 text-sm text-slate-500">{docOrder.company?.business_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocOrder(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] focus-visible:ring-offset-2"
                  aria-label="Close invoice modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain p-6">
                {/* DPL Reconciliation */}
                {dplData && (
                  <div className={`rounded-2xl border-2 p-4 ${dplData.dplValue < dplData.soValue ? "border-emerald-400 bg-emerald-50" : dplData.dplValue > dplData.soValue ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                    <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 text-slate-600">
                      <Package size={14} /> DPL vs SO Reconciliation
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">SO Value</p>
                        <p className="font-black text-slate-900">{formatPrice(dplData.soValue * 1.18)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">DPL Value</p>
                        <p className="font-black text-blue-700">{formatPrice(dplData.dplValue * 1.18)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Variance</p>
                        <p className={`font-black ${dplData.dplValue < dplData.soValue ? "text-emerald-600" : dplData.dplValue > dplData.soValue ? "text-red-600" : "text-slate-600"}`}>
                          {dplData.dplValue < dplData.soValue ? `Credit ₹${((dplData.soValue - dplData.dplValue) * 1.18).toLocaleString("en-IN")}` :
                           dplData.dplValue > dplData.soValue ? `Debit ₹${((dplData.dplValue - dplData.soValue) * 1.18).toLocaleString("en-IN")}` : "Exact Match"}
                        </p>
                      </div>
                    </div>
                    {dplData.dplValue < dplData.soValue && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-emerald-700 font-bold text-center">💰 Wallet credit of {formatPrice((dplData.soValue - dplData.dplValue) * 1.18)} will be applied</p>
                        <button
                          onClick={async () => {
                            const creditAmt = (dplData.soValue - dplData.dplValue) * 1.18;
                            if (!docOrder?.company_id || !user?.id) { toast.error("Authenticated actor and company are required"); return; }
                            try {
                              const binding = await resolveCreditBinding(docOrder.id);
                              const identity = buildWalletIdentity({
                                companyId: docOrder.company_id, direction: "credit", amount: creditAmt, currency: "INR",
                                orderId: docOrder.id, proformaInvoiceId: binding.piId, commercialVersionId: binding.commercialVersionId,
                                sourceChannel: "CENTRAL_FINANCE", sourceReference: `dpl-variance:${docOrder.id}`,
                                reason: "DPL variance wallet credit",
                              });
                              const wallet = await recordWalletEntry({
                                companyId: docOrder.company_id, direction: "credit", amount: creditAmt, currency: "INR",
                                orderId: docOrder.id, proformaInvoiceId: binding.piId, commercialVersionId: binding.commercialVersionId,
                                sourceChannel: "CENTRAL_FINANCE", sourceReference: `dpl-variance:${docOrder.id}`,
                                reason: "DPL variance wallet credit",
                                correlationId: await buildCreditWalletCorrelationId("wallet", identity),
                                idempotencyKey: await buildCreditWalletIdempotencyKey("wallet", identity), actorId: user.id,
                              });
                              await supabase.from("audit_logs").insert([{
                                action_type: "DPL_WALLET_CREDIT",
                                module_name: "Finance",
                                entity_name: "companies",
                                entity_id: docOrder.company_id,
                                actor_id: user.id,
                                new_value: { credit_amount: creditAmt, new_balance: wallet.balance, order_id: docOrder.id, so_value: dplData.soValue, dpl_value: dplData.dplValue },
                                risk_level: "high",
                              }]);
                              toast.success(`✅ ₹${creditAmt.toLocaleString("en-IN")} credited to client wallet`);
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Governed wallet credit failed.");
                            }
                          }}
                          className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                        >
                          <Wallet size={14} /> Credit ₹{((dplData.soValue - dplData.dplValue) * 1.18).toLocaleString("en-IN")} to Wallet
                        </button>
                      </div>
                    )}
                    {dplData.dplValue > dplData.soValue && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-red-700 font-bold text-center">⚠️ Balance due of {formatPrice((dplData.dplValue - dplData.soValue) * 1.18)} flagged</p>
                        <div className="bg-red-100 border border-red-300 rounded-xl p-2 text-center">
                          <p className="text-[11px] text-red-800 font-bold">Outstanding updated: ₹{((dplData.dplValue - dplData.soValue) * 1.18).toLocaleString("en-IN")} balance payment requested</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

              <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setDocOrder(null)}
                  className="min-h-[3rem] rounded-xl border border-slate-200 bg-white px-6 py-4 font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:px-8"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestBalance}
                  disabled={acting === docOrder.id}
                  className="flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-xl shadow-slate-900/20 transition-all hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-50"
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

      {/* FINANCIAL ENTRY MODAL */}
      <AnimatePresence>
        {financialEntry && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="z-[190] flex max-h-[min(92dvh,100%)] w-full max-w-[min(100%,32rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Financial Entry</h3>
                  <p className="mt-1 text-sm text-slate-500">SO #{financialEntry.orderId.slice(0, 8)} — {financialEntry.companyName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFinancialEntry(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] focus-visible:ring-offset-2"
                  aria-label="Close financial entry modal"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-6">
                <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase">SO Value</span>
                  <span className="font-black text-amber-800">{formatPrice(financialEntry.soValue)}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Actual Amount Received (₹) *</label>
                  <input type="number" min="0" value={financialEntry.actualAmountReceived}
                    onChange={(e) => setFinancialEntry(prev => prev ? { ...prev, actualAmountReceived: e.target.value } : null)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-black text-[#B8860B] outline-none focus:border-[#B8860B]"
                    placeholder="Enter exact amount" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Payment Mode *</label>
                  <select value={financialEntry.paymentMode}
                    onChange={(e) => setFinancialEntry(prev => prev ? { ...prev, paymentMode: e.target.value } : null)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]">
                    <option value="">Select mode...</option>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    UTR / Reference Number {financialEntry.paymentMode && financialEntry.paymentMode !== "Cash" ? "*" : ""}
                  </label>
                  <input type="text" value={financialEntry.utrReference}
                    onChange={(e) => setFinancialEntry(prev => prev ? { ...prev, utrReference: e.target.value } : null)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                    placeholder="Bank reference / UTR" />
                </div>
                {financialEntry.receiptUrl ? (
                  <button onClick={() => window.open(financialEntry.receiptUrl!, "_blank")}
                    className="w-full py-2.5 border border-blue-300 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-50 flex justify-center items-center gap-2">
                    <FileText size={14} /> View Uploaded Receipt
                  </button>
                ) : (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-bold text-slate-400">
                    <UploadCloud size={14} /> No receipt uploaded by Sales
                  </div>
                )}
                </div>
              </div>
              <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={handleFinancialEntrySubmit}
                  disabled={savingEntry}
                  className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 font-bold text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-60"
                >
                    {savingEntry ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Record proof & verify in Core</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHORT-TERM CREDIT MODAL */}
      <AnimatePresence>
        {shortTermTarget && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="z-[190] flex max-h-[min(92dvh,100%)] w-full max-w-[min(100%,28rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Issue Short-Term Credit</h3>
                  <p className="mt-1 text-sm text-slate-500">{shortTermTarget.company?.business_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShortTermTarget(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  aria-label="Close short-term credit modal"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-6">
                <div className="space-y-4">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex justify-between">
                  <span className="text-xs font-bold text-violet-700 uppercase">Order Value</span>
                  <span className="font-black text-violet-800">{formatPrice(shortTermTarget.sales_order_value || 0)}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Payment Deadline (Days) *</label>
                  <input type="number" min="1" max="90" value={shortTermDays}
                    onChange={(e) => setShortTermDays(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-black text-violet-700 outline-none focus:border-violet-500"
                    placeholder="e.g. 15" />
                </div>
                <p className="text-xs text-slate-500 italic">
                  This submits a governed short-term credit request for Finance decision. It does not release the order to production.
                </p>
                </div>
              </div>
              <div className="shrink-0 border-t border-violet-100 bg-violet-50/80 p-4">
                <button
                  type="button"
                  onClick={handleShortTermCreditRelease}
                  disabled={savingShortTerm}
                  className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-4 font-bold text-white shadow-xl shadow-violet-600/20 transition-all hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-60"
                >
                  {savingShortTerm ? <Loader2 size={18} className="animate-spin" /> : <><ShieldCheck size={18} /> Submit Credit Request</>}
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
