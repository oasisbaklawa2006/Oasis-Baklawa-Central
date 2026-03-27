import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Wand2,
  ChevronLeft,
  CreditCard,
  Banknote,
  X,
  Printer,
  ShieldAlert,
  MapPin,
  Truck,
  Plus,
  Wallet,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ProductRecommendations from "@/components/ProductRecommendations";
import { generateProFormaInvoice } from "@/utils/invoiceGenerator";
import {
  calculatePackPrice,
  calculateLineTotal,
  calculateLineTax,
  getGstRate,
  getHsnCode,
  getProductCategory,
  getPacksPerCarton,
  isCartonSealed,
  unitsToFillCarton,
  getDisplayPrice,
  getPrimaryPackWeightKg,
  getMinOrderQty,
  getQtyIncrement,
} from "@/utils/pricing";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

// Group items by their carton family (packs_per_carton value)
function groupByCartonFamily(items: any[]) {
  const map = new Map<string, any[]>();
  for (const item of items) {
    const p = item.product;
    const cat = getProductCategory(p);
    const perCarton = getPacksPerCarton(p);
    const key = `${cat}_${perCarton}_${p?.carton_type || "Standard"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => {
    const firstProduct = groupItems[0]?.product;
    const cat = getProductCategory(firstProduct);
    const perCarton = getPacksPerCarton(firstProduct);
    return {
      key,
      category: cat,
      perCarton,
      cartonType: firstProduct?.carton_type || "Standard",
      items: groupItems,
    };
  });
}

interface MoqRule {
  id: string;
  rule_scope: string;
  min_quantity: number | null;
  product_id: string | null;
  category_id: string | null;
  customer_type: string | null;
  pack_size: string | null;
  carton_type: string | null;
  validation_mode: string | null;
}

interface MoqViolation {
  ruleName: string;
  message: string;
  mode: "hard_stop" | "warning";
}

const emptyAddress = { label: "", street_address: "", city: "", state: "", pincode: "", contact_person: "", contact_phone: "" };

const Cart = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upload_receipt");
  const [moqRules, setMoqRules] = useState<MoqRule[]>([]);

  // Logistics State
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [transporter, setTransporter] = useState({ name: "", account: "" });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [allowCredit, setAllowCredit] = useState(false);

  // Quick-add address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [savingAddress, setSavingAddress] = useState(false);

  // Token deposit
  const [depositAmount, setDepositAmount] = useState("");

  const { draftOrder, items, updateQuantity, fetchCart, clearCart, loading: cartLoading } = useCart();

  // Extracted address fetch for reuse & retry
  const fetchAddresses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: userRow } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const cid = userRow?.company_id;
    if (!cid) return;
    setCompanyId(cid);

    const { data: addrs } = await supabase
      .from("delivery_addresses")
      .select("*")
      .eq("company_id", cid);
    if (addrs && addrs.length > 0) {
      setAddresses(addrs);
      const defaultAddr = addrs.find((a: any) => a.is_default);
      setSelectedAddress(defaultAddr ? defaultAddr.id : addrs[0].id);
    } else {
      setAddresses([]);
      setShowAddressForm(true); // Auto-show form if no addresses
    }

    const { data: comp } = await supabase
      .from("companies")
      .select("preferred_courier, courier_account_number, allow_credit")
      .eq("id", cid)
      .single();
    if (comp) {
      setTransporter({ name: comp.preferred_courier || "", account: comp.courier_account_number || "" });
      setAllowCredit(!!(comp as any).allow_credit);
    }
  }, []);

  // Fetch active MOQ rules & Logistics
  useEffect(() => {
    const fetchCheckoutData = async () => {
      const { data: moqData } = await supabase.from("moq_rules").select("*").eq("is_active", true);
      if (moqData) setMoqRules(moqData as MoqRule[]);
      await fetchAddresses();
    };
    fetchCheckoutData();
  }, [fetchAddresses]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || "")),
    [items],
  );
  const sections = useMemo(() => groupByCartonFamily(sortedItems), [sortedItems]);

  // Per-line item tax calculations
  const subtotal = sortedItems.reduce((sum, item) => {
    return sum + calculateLineTotal(item.product, item.quantity);
  }, 0);

  const totalTax = sortedItems.reduce((sum, item) => {
    return sum + calculateLineTax(item.product, item.quantity);
  }, 0);

  const grandTotal = Math.round(subtotal + totalTax);
  const minimumToken = Math.ceil(grandTotal * 0.2);

  // Sealed carton check across all sections
  const hasIncompleteCartons = sections.some((section) => {
    if (section.category === "premium_pc") {
      return section.items.some((item) => !isCartonSealed(item.product, item.quantity));
    }
    const totalQty = section.items.reduce((s, it) => s + it.quantity, 0);
    return totalQty > 0 && totalQty % section.perCarton !== 0;
  });

  // MOQ Validation
  const moqViolations = useMemo((): MoqViolation[] => {
    if (!moqRules.length || !sortedItems.length) return [];
    const violations: MoqViolation[] = [];

    for (const rule of moqRules) {
      const minQty = rule.min_quantity ?? 0;
      if (minQty <= 0) continue;
      const mode = (rule.validation_mode === "warning" ? "warning" : "hard_stop") as "hard_stop" | "warning";

      if (rule.rule_scope === "product" && rule.product_id) {
        const matchingItems = sortedItems.filter((it) => it.product_id === rule.product_id);
        const totalQty = matchingItems.reduce((s, it) => s + it.quantity, 0);
        if (matchingItems.length > 0 && totalQty < minQty) {
          const productName = matchingItems[0]?.product?.name || "Product";
          violations.push({ ruleName: productName, message: `${productName} requires minimum ${minQty} units (you have ${totalQty})`, mode });
        }
      } else if (rule.rule_scope === "category" && rule.category_id) {
        const matchingItems = sortedItems.filter((it) => (it.product as any)?.category_id === rule.category_id);
        const totalQty = matchingItems.reduce((s, it) => s + it.quantity, 0);
        if (matchingItems.length > 0 && totalQty < minQty) {
          violations.push({ ruleName: `Category`, message: `This category requires minimum ${minQty} units (you have ${totalQty})`, mode });
        }
      } else if (rule.rule_scope === "global") {
        const totalQty = sortedItems.reduce((s, it) => s + it.quantity, 0);
        if (totalQty < minQty) {
          violations.push({ ruleName: "Global MOQ", message: `Minimum order quantity is ${minQty} units (you have ${totalQty})`, mode });
        }
      } else if (rule.rule_scope === "carton_type" && rule.carton_type) {
        const matchingSection = sections.find((s) => s.cartonType.toLowerCase() === rule.carton_type!.toLowerCase());
        if (matchingSection) {
          const totalQty = matchingSection.items.reduce((s, it) => s + it.quantity, 0);
          if (totalQty < minQty) {
            violations.push({ ruleName: `Carton ${rule.carton_type}`, message: `Carton type ${rule.carton_type} requires minimum ${minQty} units (you have ${totalQty})`, mode });
          }
        }
      }
    }
    return violations;
  }, [moqRules, sortedItems, sections]);

  const hardStopViolations = moqViolations.filter((v) => v.mode === "hard_stop");
  const warningViolations = moqViolations.filter((v) => v.mode === "warning");
  const hasHardStop = hardStopViolations.length > 0;

  const handleAutoOptimize = async (section: any) => {
    const sectionQty = section.items.reduce((s: number, it: any) => s + it.quantity, 0);
    const remainder = sectionQty % section.perCarton;
    if (remainder > 0) {
      const neededToFill = section.perCarton - remainder;
      const targetItem = [...section.items].sort((a: any, b: any) => b.quantity - a.quantity)[0];
      await updateQuantity(targetItem.id, targetItem.quantity + neededToFill);
      await fetchCart();
      toast.success(`✨ Carton perfectly optimized!`, { icon: "📦" });
    }
  };

  const handleSmartAdd = async (itemId: string, currentQty: number, needed: number) => {
    await updateQuantity(itemId, currentQty + needed);
    await fetchCart();
    toast.success(`Added ${needed} units to fill carton!`);
  };

  const handleQtyChange = async (itemId: string, currentQty: number, delta: number, product: any) => {
    const increment = getQtyIncrement(product);
    const minQty = getMinOrderQty(product);
    const newQty = currentQty + (delta > 0 ? increment : -increment);

    if (newQty <= 0) {
      await updateQuantity(itemId, 0);
    } else if (newQty < minQty) {
      await updateQuantity(itemId, 0);
    } else {
      await updateQuantity(itemId, newQty);
    }
  };

  const handleSaveAddress = async () => {
    if (!companyId) { toast.error("Company not found. Please contact support."); return; }
    if (!newAddress.label || !newAddress.street_address || !newAddress.city || !newAddress.state || !newAddress.pincode) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSavingAddress(true);
    const isFirst = addresses.length === 0;
    const { error } = await supabase.from("delivery_addresses").insert({
      ...newAddress,
      company_id: companyId,
      is_default: isFirst,
    });
    setSavingAddress(false);
    if (error) { toast.error("Failed to save address."); return; }
    toast.success("Address saved!");
    setNewAddress(emptyAddress);
    setShowAddressForm(false);
    await fetchAddresses();
  };

  const handlePrintSO = async () => {
    let companyDetails: { business_name: string; gst_number?: string | null } | null = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      if (profile?.company_id) {
        const { data: comp } = await supabase.from("companies").select("business_name, gst_number").eq("id", profile.company_id).single();
        if (comp) companyDetails = comp;
      }
    }
    const addr = addresses.find((a) => a.id === selectedAddress) || null;
    generateProFormaInvoice(sortedItems, companyDetails, addr);
    toast.success("Pro-Forma Invoice downloaded!");
  };

  const handleFinalSubmit = async () => {
    if (paymentMethod === "pay_online") {
      toast.info("Online Payment Gateway — Coming Soon");
      return;
    }
    if (!draftOrder) return;

    // Validate deposit for non-credit paths
    if (paymentMethod !== "credit") {
      const deposit = parseFloat(depositAmount);
      if (isNaN(deposit) || deposit < minimumToken) {
        toast.error(`Confirmation Deposit must be at least ${formatPrice(minimumToken)} (20% of order value).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updatePayload: any = {
        status: "submitted",
        sales_order_value: grandTotal,
        document_stage: "SO",
        payment_status: paymentMethod === "credit" ? "on_credit" : "awaiting_receipt",
      };

      if (paymentMethod !== "credit") {
        const deposit = parseFloat(depositAmount);
        updatePayload.advance_required = deposit;
      }

      const { data: updatedOrders, error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", draftOrder.id)
        .eq("status", "draft")
        .select("id");

      if (updateError) throw updateError;
      if (!updatedOrders || updatedOrders.length === 0) {
        throw new Error("Failed to submit order to database: no draft order was updated.");
      }

      clearCart();

      if (paymentMethod === "credit") {
        toast.success("Sales Order confirmed on credit terms!");
      } else {
        toast.success("Sales Order submitted! Please upload your payment receipt.");
      }
      setShowPaymentModal(false);
      setTimeout(() => navigate("/orders"), 1500);
    } catch (error: any) {
      console.error("[Cart] Order submission failed:", error);
      toast.error(error?.message || "Failed to submit order to database. Please try again.");
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartLoading)
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground font-medium">Fetching your order...</p>
        </div>
      </AppShell>
    );

  if (sortedItems.length === 0)
    return (
      <AppShell>
        <div className="px-5 pt-10 flex flex-col items-center justify-start min-h-[60vh] space-y-4">
          <ShoppingCart size={48} className="text-muted-foreground/30" />
          <h1 className="font-display text-2xl tracking-wide">Your Order is Empty</h1>
          <button onClick={() => navigate("/catalogue")} className="text-primary font-bold">
            Browse Catalogue
          </button>
        </div>
      </AppShell>
    );

  // Build per-line tax breakdown for display
  const taxBreakdown = sortedItems.reduce<Record<string, { hsn: string; rate: number; taxable: number; tax: number }>>((acc, item) => {
    const p = item.product;
    const hsn = getHsnCode(p);
    const rate = getGstRate(p);
    const lineTotal = calculateLineTotal(p, item.quantity);
    const lineTax = calculateLineTax(p, item.quantity);
    const key = `${hsn}_${rate}`;
    if (!acc[key]) acc[key] = { hsn, rate, taxable: 0, tax: 0 };
    acc[key].taxable += lineTotal;
    acc[key].tax += lineTax;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="px-5 pt-8 space-y-6 pb-32 max-w-3xl mx-auto flex flex-col justify-start min-h-screen">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <ChevronLeft size={24} />
            </button>
            <h1 className="font-display text-2xl tracking-wide">Sales Order (SO)</h1>
          </div>
          <button
            onClick={handlePrintSO}
            className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 rounded-xl text-xs font-bold hover:bg-muted/80 transition-colors"
          >
            <Printer size={14} /> Pro-Forma
          </button>
        </div>

        {/* MOQ Hard Stop Violations */}
        {hardStopViolations.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-red-800 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert size={14} /> MOQ Requirements Not Met
            </p>
            {hardStopViolations.map((v, i) => (
              <p key={i} className="text-[11px] text-red-700 font-medium pl-5">• {v.message}</p>
            ))}
          </div>
        )}

        {/* MOQ Warning Violations */}
        {warningViolations.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle size={14} /> MOQ Advisory
            </p>
            {warningViolations.map((v, i) => (
              <p key={i} className="text-[11px] text-amber-700 font-medium pl-5">• {v.message}</p>
            ))}
          </div>
        )}

        {/* CART ITEMS LIST */}
        <div className="space-y-4">
          {sections.map((section) => {
            const sectionQty = section.items.reduce((s, it) => s + it.quantity, 0);
            const isPremium = section.category === "premium_pc";
            const isBulk = section.category === "bulk_kg";

            const sectionSealed = isPremium
              ? section.items.every((item) => isCartonSealed(item.product, item.quantity))
              : sectionQty % section.perCarton === 0;
            const sectionNeeded = isPremium ? 0 : unitsToFillCarton(section.items[0]?.product, sectionQty);

            const categoryLabel = isBulk ? "Bulk (Kg)" : isPremium ? "Premium" : "Ready Packs (Pc)";

            return (
              <motion.section
                key={section.key}
                className={`bg-card rounded-[2rem] p-5 border shadow-sm ${!sectionSealed ? "border-amber-200" : "border-border"}`}
              >
                <h2 className="font-bold text-foreground text-sm mb-1">
                  {categoryLabel} — 1 Carton = {section.perCarton} {isBulk ? "Packs" : "Pcs"}
                  {isBulk && (() => {
                    const w = getPrimaryPackWeightKg(section.items[0]?.product);
                    return w ? ` of ${w} Kg Each` : "";
                  })()}
                </h2>
                <p className="text-[10px] text-muted-foreground mb-4 uppercase tracking-wider">
                  {section.cartonType}
                </p>

                <div className="space-y-4">
                  {section.items.map((item) => {
                    const p = item.product as any;
                    const unitPrice = calculatePackPrice(p);
                    const lineTotal = calculateLineTotal(p, item.quantity);
                    const lineTax = calculateLineTax(p, item.quantity);
                    const gstRate = getGstRate(p);
                    const hsn = getHsnCode(p);
                    const weightKg = getPrimaryPackWeightKg(p);
                    const perCarton = getPacksPerCarton(p);
                    const increment = getQtyIncrement(p);

                    const itemSealed = isPremium ? isCartonSealed(p, item.quantity) : true;
                    const itemNeeded = isPremium ? unitsToFillCarton(p, item.quantity) : 0;

                    return (
                      <div key={item.id}>
                        <div className="flex items-center justify-between">
                          <div className="w-16 h-16 rounded-xl bg-muted/30 flex items-center justify-center flex-shrink-0 mr-3 overflow-hidden">
                            {p?.image_url ? (
                              <img src={p.image_url} alt={p?.name || ""} className="w-full h-full object-contain mix-blend-multiply" />
                            ) : (
                              <Package size={20} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 pr-4 min-w-0">
                            <p className="font-bold text-sm truncate">
                              {p?.name}
                              {isBulk && weightKg ? ` (${weightKg}kg)` : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                              {isBulk
                                ? `₹${getDisplayPrice(p).price}/kg × ${weightKg}kg = ${formatPrice(unitPrice)}/pack`
                                : `${formatPrice(unitPrice)}/pc`}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                              Qty: {item.quantity} × {formatPrice(unitPrice)} = <span className="text-foreground">{formatPrice(lineTotal)}</span>
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              GST @{gstRate}%: {formatPrice(lineTax)} {hsn ? `| HSN: ${hsn}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border">
                            <button
                              onClick={() => handleQtyChange(item.id, item.quantity, -1, p)}
                              className="w-8 h-8 rounded-lg bg-card shadow-sm font-bold"
                            >
                              {item.quantity <= increment ? <Trash2 size={12} className="text-destructive mx-auto" /> : "−"}
                            </button>
                            <span className="font-bold text-xs w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleQtyChange(item.id, item.quantity, 1, p)}
                              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {isPremium && !itemSealed && (
                          <div className="mt-2 bg-amber-50 rounded-lg p-2 border border-amber-200">
                            <p className="text-[10px] text-amber-800 font-bold">
                              ⚠ Add {itemNeeded} more to complete carton ({perCarton}/carton)
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Section carton status (for non-premium) */}
                {!isPremium && (
                  <div className="pt-4 mt-5 border-t border-border">
                    {!sectionSealed ? (
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-inner">
                        <p className="text-xs font-bold text-amber-900 mb-3 flex items-center gap-1.5">
                          <AlertTriangle size={14} /> Add {sectionNeeded} more to fill carton.
                        </p>
                        <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden mb-4">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${((sectionQty % section.perCarton) / section.perCarton) * 100}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {section.items.map((item) => (
                            <button
                              key={`suggest-${item.id}`}
                              onClick={() => handleSmartAdd(item.id, item.quantity, sectionNeeded)}
                              className="px-3 py-2 bg-card border border-amber-200 text-amber-900 rounded-lg text-[10px] font-bold shadow-sm hover:bg-amber-100 transition-colors flex-1 min-w-[120px]"
                            >
                              +{sectionNeeded} {item.product?.name}
                            </button>
                          ))}
                          <button
                            onClick={() => handleAutoOptimize(section)}
                            className="w-full mt-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-2 shadow-sm hover:bg-primary/90"
                          >
                            <Wand2 size={14} /> Auto-Fill Mix
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 rounded-xl p-3 flex justify-center items-center gap-2 border border-emerald-100">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          All Cartons Filled & Sealed
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>

        {/* LOGISTICS SECTION */}
        <motion.section className="bg-card rounded-[2rem] p-6 border border-border shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <MapPin className="text-primary" size={20} />
            <h2 className="font-serif text-xl font-bold text-foreground">Delivery Logistics</h2>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Select Delivery Warehouse
            </label>
            {addresses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAddress === addr.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                  >
                    <input type="radio" checked={selectedAddress === addr.id} onChange={() => setSelectedAddress(addr.id)} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${selectedAddress === addr.id ? "border-primary" : "border-muted-foreground/30"}`}>
                      {selectedAddress === addr.id && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{addr.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {addr.street_address}, {addr.city}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Add New Address toggle */}
            {!showAddressForm && (
              <button
                onClick={() => setShowAddressForm(true)}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-primary/30 rounded-2xl text-primary text-xs font-bold hover:bg-primary/5 transition-colors"
              >
                <Plus size={14} /> Add New Delivery Address
              </button>
            )}

            {/* Quick Add Address Form */}
            <AnimatePresence>
              {showAddressForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-muted/30 rounded-2xl p-4 border border-border space-y-3 mt-3">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Quick Add Address</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Label (e.g. Main Warehouse)*"
                        value={newAddress.label}
                        onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                        className="col-span-2 text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                      <input
                        placeholder="Street Address*"
                        value={newAddress.street_address}
                        onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                        className="col-span-2 text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                      <input
                        placeholder="City*"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                      <input
                        placeholder="State*"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                      <input
                        placeholder="Pincode*"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                        className="text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                      <input
                        placeholder="Contact Person"
                        value={newAddress.contact_person}
                        onChange={(e) => setNewAddress({ ...newAddress, contact_person: e.target.value })}
                        className="text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                      <input
                        placeholder="Contact Phone"
                        value={newAddress.contact_phone}
                        onChange={(e) => setNewAddress({ ...newAddress, contact_phone: e.target.value })}
                        className="col-span-2 text-xs p-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/30 outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveAddress}
                        disabled={savingAddress}
                        className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {savingAddress ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Save Address
                      </button>
                      {addresses.length > 0 && (
                        <button
                          onClick={() => { setShowAddressForm(false); setNewAddress(emptyAddress); }}
                          className="px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted/80"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1">
              <Truck size={12} /> Assigned Transporter
            </label>
            <div className="bg-muted/30 p-4 rounded-2xl border border-border">
              <p className="font-bold text-foreground text-sm">{transporter.name || "Default Oasis Logistics"}</p>
              {transporter.account && <p className="text-[11px] text-muted-foreground mt-1">A/C: {transporter.account}</p>}
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-2 bg-primary/10 inline-block px-2 py-1 rounded">
                Freight: To Pay at Destination
              </p>
            </div>
          </div>
        </motion.section>

        {/* CROSS-SELL */}
        <ProductRecommendations title="Frequently Bought Together" />

        {/* TAX BREAKDOWN */}
        {Object.keys(taxBreakdown).length > 0 && (
          <motion.section className="bg-card rounded-[2rem] p-5 border border-border shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">GST Breakdown</h3>
            <div className="space-y-2">
              {Object.values(taxBreakdown).map((row, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {row.hsn ? `HSN ${row.hsn}` : "General"} @ {row.rate}%
                  </span>
                  <span className="text-foreground font-bold">{formatPrice(row.tax)}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* SUMMARY & CHECKOUT BAR */}
        <motion.section className="bg-[#005F5F] text-white rounded-[2rem] shadow-2xl p-6 relative overflow-hidden print:hidden">
          <div className="relative z-10 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/80 font-medium uppercase tracking-wider text-xs">Sub Total (Before Tax)</span>
              <span className="text-white font-bold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm pb-3 border-b border-[#C5A059]/40">
              <span className="text-white/80 font-medium uppercase tracking-wider text-xs">Total GST</span>
              <span className="text-white font-bold">{formatPrice(totalTax)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-white font-bold uppercase tracking-wider text-xs">Grand Total</span>
              <span className="font-black text-3xl text-[#D4AF37]">{formatPrice(grandTotal)}</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (!selectedAddress && addresses.length > 0)
                return toast.error("Please select a delivery address to proceed.");
              if (addresses.length === 0)
                return toast.error("Please add a delivery address first.");
              setDepositAmount(String(minimumToken));
              setShowPaymentModal(true);
            }}
            disabled={hasIncompleteCartons || hasHardStop}
            className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#005F5F] font-bold text-sm hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-black/20"
          >
            {hasHardStop
              ? "MOQ Requirements Not Met"
              : hasIncompleteCartons
                ? "FILL CARTONS TO CONTINUE"
                : "PROCEED TO ORDER CONFIRMATION"}
          </button>
        </motion.section>
      </div>

      {/* ORDER CONFIRMATION MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-card rounded-3xl p-6 flex flex-col max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display text-2xl font-bold text-foreground">Confirm Sales Order</h3>
                  <p className="text-sm text-muted-foreground mt-1">Review & submit your SO.</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/80"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Order Summary */}
              <div className="bg-muted/30 p-5 rounded-2xl border border-border mb-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-bold text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground border-b border-border pb-3">
                  <span>Total GST</span>
                  <span className="font-bold text-foreground">{formatPrice(totalTax)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-xs">SO Value</span>
                  <span className="font-black text-2xl text-primary">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Token Deposit Section */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4 space-y-3">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Confirmation Deposit</p>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Minimum Token (20%)</span>
                  <span className="font-bold text-foreground">{formatPrice(minimumToken)}</span>
                </div>
                {paymentMethod !== "credit" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">Enter Deposit Amount</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min={minimumToken}
                      className="w-full text-sm p-3 rounded-xl border border-border bg-card font-bold focus:ring-2 focus:ring-primary/30 outline-none"
                      placeholder={`Min. ${formatPrice(minimumToken)}`}
                    />
                    {parseFloat(depositAmount) > 0 && parseFloat(depositAmount) < minimumToken && (
                      <p className="text-[10px] text-destructive font-bold mt-1">
                        Must be at least {formatPrice(minimumToken)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="space-y-3 pb-4">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Choose Settlement Path</p>

                {/* Pay Token Online */}
                <label
                  className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "pay_online" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <input type="radio" name="payment" value="pay_online" checked={paymentMethod === "pay_online"} onChange={() => setPaymentMethod("pay_online")} className="hidden" />
                  <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${paymentMethod === "pay_online" ? "bg-primary/10" : "bg-muted"}`}>
                    <CreditCard size={20} className={paymentMethod === "pay_online" ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-foreground text-sm">Pay Token Online</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Pay the deposit instantly via UPI, Cards, or Netbanking.
                    </p>
                  </div>
                </label>

                {/* Submit SO & Upload Receipt */}
                <label
                  className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "upload_receipt" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <input type="radio" name="payment" value="upload_receipt" checked={paymentMethod === "upload_receipt"} onChange={() => setPaymentMethod("upload_receipt")} className="hidden" />
                  <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${paymentMethod === "upload_receipt" ? "bg-primary/10" : "bg-muted"}`}>
                    <Banknote size={20} className={paymentMethod === "upload_receipt" ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-bold text-foreground text-sm">Submit SO & Upload Receipt</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Confirm the SO now. Transfer via NEFT/RTGS and upload the receipt from your Orders page.
                    </p>
                  </div>
                </label>

                {/* Credit Option - only if allowed */}
                {allowCredit && (
                  <label
                    className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === "credit" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                  >
                    <input type="radio" name="payment" value="credit" checked={paymentMethod === "credit"} onChange={() => setPaymentMethod("credit")} className="hidden" />
                    <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${paymentMethod === "credit" ? "bg-primary/10" : "bg-muted"}`}>
                      <Wallet size={20} className={paymentMethod === "credit" ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="font-bold text-foreground text-sm">Pay Later / On Credit</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Your company has approved credit terms. No token deposit required.
                      </p>
                    </div>
                  </label>
                )}
              </div>

              <div className="pt-4 mt-auto border-t border-border">
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-bold text-primary-foreground bg-foreground flex justify-center items-center shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : paymentMethod === "pay_online" ? (
                    `Pay ${formatPrice(parseFloat(depositAmount) || minimumToken)} Online`
                  ) : paymentMethod === "credit" ? (
                    "Confirm SO on Credit"
                  ) : (
                    "Submit Sales Order"
                  )}
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-2 leading-relaxed">
                  By confirming, you agree to Oasis Baklawa's B2B terms. Document stage: Sales Order (SO).
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Cart;
