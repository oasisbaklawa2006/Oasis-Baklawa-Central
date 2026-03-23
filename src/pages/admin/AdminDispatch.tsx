import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Truck, Package, Printer, FileText, Globe, CheckCircle2, Shield, MapPin, QrCode } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import Barcode from "react-barcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrderItem {
  id: string;
  quantity: number;
  product?: { name: string } | null;
}

interface DispatchOrder {
  id: string;
  status: string;
  sales_order_value: number | null;
  created_at: string;
  company_id: string | null;
  company?: { business_name: string; billing_address?: string; phone?: string } | null;
  order_items?: OrderItem[];
  is_export?: boolean;
}

const PACKS_PER_CARTON = 9;

const AdminDispatch = () => {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Print Engine State
  const [printMode, setPrintMode] = useState<"none" | "barcodes" | "consignee" | "packing_list" | "invoice">("none");
  const [generatedCartons, setGeneratedCartons] = useState<{ boxNum: number; total: number; barcode: string }[]>([]);

  // Dispatch Form State
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select(
        "*, company:companies(business_name, billing_address, phone), order_items(id, quantity, product:products(name))",
      )
      .in("status", ["packing", "ready_for_dispatch", "packed_ready"])
      .order("created_at", { ascending: false });

    setOrders((data as unknown as DispatchOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Trigger browser print dialog when Print Mode changes
  useEffect(() => {
    if (printMode !== "none") {
      setTimeout(() => {
        window.print();
        setPrintMode("none");
      }, 300); // Small delay to let DOM render the printable area
    }
  }, [printMode]);

  const openDispatchModal = (order: DispatchOrder) => {
    setSelectedOrder(order);
    setTransporterName("");
    setTrackingNumber("");
    setDriverPhone("");

    // Auto-generate carton data for barcodes
    const totalPacks = order.order_items?.reduce((s, i) => s + i.quantity, 0) || 0;
    const totalCartons = Math.ceil(totalPacks / PACKS_PER_CARTON);
    const shortOrderId = order.id.split("-")[0].toUpperCase();

    const cartons = [];
    for (let i = 1; i <= totalCartons; i++) {
      cartons.push({
        boxNum: i,
        total: totalCartons,
        barcode: `OASIS-${shortOrderId}-B${i.toString().padStart(3, "0")}`, // e.g. OASIS-ABC12-B001
      });
    }
    setGeneratedCartons(cartons);
  };

  const handlePrint = (mode: "barcodes" | "consignee" | "packing_list" | "invoice") => {
    setPrintMode(mode);
  };

  const handleSubmitDispatch = async () => {
    if (!selectedOrder) return;
    if (!transporterName.trim()) {
      toast.error("Transporter name is required");
      return;
    }
    setSubmitting(true);

    // 1. Create Dispatch Record
    const { data: dispatch, error: dispatchErr } = await supabase
      .from("dispatches")
      .insert({
        order_id: selectedOrder.id,
        company_id: selectedOrder.company_id,
        transporter_name: transporterName,
        tracking_number: trackingNumber,
        driver_phone: driverPhone,
        status: "dispatched",
        dispatch_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (dispatchErr || !dispatch) {
      toast.error("Failed to create dispatch");
      setSubmitting(false);
      return;
    }

    // 2. Save the Physical Cartons to DB for the Security Guard Scanner
    const cartonInserts = generatedCartons.map((c) => ({
      order_id: selectedOrder.id,
      dispatch_id: dispatch.id,
      barcode_string: c.barcode,
      box_number: c.boxNum,
      total_boxes: c.total,
      status: "labeled", // Guard will change this to 'scanned_at_gate'
    }));
    await supabase.from("dispatch_cartons").insert(cartonInserts);

    // 3. Mark Order as Dispatched
    await supabase.from("orders").update({ status: "dispatched" }).eq("id", selectedOrder.id);

    toast.success("Dispatch Created & Cartons Logged for Security!", { icon: "🚚" });
    setSelectedOrder(null);
    setSubmitting(false);
    fetchOrders();
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* ======================================================================
        PRINTABLE ENGINE (Hidden from normal view, ONLY visible during printing)
        ======================================================================
      */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          
          /* Dynamic Page Sizing based on Print Mode */
          ${printMode === "barcodes" ? "@page { size: 100mm 50mm; margin: 0; }" : "@page { size: A4; margin: 15mm; }"}
          
          /* Page break for Barcodes */
          .page-break { page-break-after: always; }
        }
      `}</style>

      <div className={`print-area ${printMode === "none" ? "hidden" : "block"}`}>
        {/* PRINT MODE 1: TSC TE244 BARCODE STICKERS (100mm x 50mm) */}
        {printMode === "barcodes" && selectedOrder && (
          <div>
            {generatedCartons.map((carton) => (
              <div
                key={carton.barcode}
                className="page-break flex flex-col justify-center items-center w-[100mm] h-[50mm] bg-white text-black p-2 box-border border-b border-dashed border-gray-300"
              >
                <h1 className="text-sm font-black uppercase tracking-widest text-center">Oasis Baklawa</h1>
                <p className="text-[10px] font-bold text-gray-600 mb-1">
                  Carton {carton.boxNum} of {carton.total}
                </p>
                <Barcode value={carton.barcode} width={1.8} height={40} fontSize={12} margin={0} displayValue={true} />
                <p className="text-[8px] font-bold mt-1 max-w-full truncate">{selectedOrder.company?.business_name}</p>
              </div>
            ))}
          </div>
        )}

        {/* PRINT MODE 2: CONSIGNOR/CONSIGNEE STICKER (A4/Half-A4) */}
        {printMode === "consignee" && selectedOrder && (
          <div className="p-8 max-w-2xl mx-auto bg-white border-2 border-black h-full">
            <div className="border-b-2 border-black pb-4 mb-4">
              <h1 className="text-3xl font-black uppercase">Shipping Label</h1>
              <p className="text-sm font-bold mt-1">Order ID: {selectedOrder.id.split("-")[0].toUpperCase()}</p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">From (Consignor)</h2>
                <p className="font-black text-lg">Oasis Baklawa Manufacturing</p>
                <p className="text-sm">Sector 5, Industrial Area</p>
                <p className="text-sm">New Delhi, India 110001</p>
                <p className="text-sm font-bold mt-1">Ph: +91 98765 43210</p>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">To (Consignee)</h2>
                <p className="font-black text-xl">{selectedOrder.company?.business_name}</p>
                <p className="text-sm">{selectedOrder.company?.billing_address}</p>
                <p className="text-sm font-bold mt-1">Ph: {selectedOrder.company?.phone || "N/A"}</p>
              </div>
            </div>
            <div className="mt-12 pt-6 border-t-2 border-black flex justify-between">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Total Cartons</p>
                <p className="text-4xl font-black">{generatedCartons.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Master Barcode</p>
                <Barcode
                  value={`MASTER-${selectedOrder.id.split("-")[0].toUpperCase()}`}
                  width={1.5}
                  height={30}
                  fontSize={10}
                  margin={0}
                />
              </div>
            </div>
          </div>
        )}

        {/* PRINT MODE 3 & 4: PACKING LIST / EXPORT INVOICE */}
        {(printMode === "packing_list" || printMode === "invoice") && selectedOrder && (
          <div className="p-8 max-w-4xl mx-auto bg-white">
            <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-widest">
                  {printMode === "invoice" ? "Commercial Invoice" : "Detailed Packing List"}
                </h1>
                <p className="text-sm font-bold text-gray-600 mt-1">Date: {new Date().toLocaleDateString()}</p>
                <p className="text-sm font-bold text-gray-600">
                  Order Ref: {selectedOrder.id.split("-")[0].toUpperCase()}
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-black">Oasis Baklawa</h2>
                <p className="text-xs text-gray-500">Export Division</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-bold bg-gray-100 p-2 uppercase tracking-widest">Consignee Details</h3>
              <div className="p-2">
                <p className="font-black text-lg">{selectedOrder.company?.business_name}</p>
                <p className="text-sm">{selectedOrder.company?.billing_address}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100 text-xs uppercase tracking-widest">
                  <th className="border border-gray-300 p-2">S.No</th>
                  <th className="border border-gray-300 p-2">Item Description</th>
                  <th className="border border-gray-300 p-2 text-right">Quantity (Packs)</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.order_items?.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-gray-300 p-2 text-sm">{idx + 1}</td>
                    <td className="border border-gray-300 p-2 text-sm font-bold">{item.product?.name}</td>
                    <td className="border border-gray-300 p-2 text-sm text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-12 text-sm font-bold text-gray-500 text-center">
              <p>Authorized Signatory</p>
              <div className="w-48 border-b border-black mx-auto mt-12"></div>
              <p className="mt-2 text-black">Oasis Baklawa Operations</p>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================================
        NORMAL WEB UI (Hidden during printing)
        ======================================================================
      */}
      <div className="print:hidden">
        <TopNavBar />
        <main className="pt-24 px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-display-h2 text-slate-900 font-bold flex items-center gap-3">
              <Truck className="text-[#B8860B]" size={32} /> Dispatch & Export Hub
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1">Generate barcodes, packing lists, and export docs.</p>
          </div>

          {/* DISPATCH QUEUE */}
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <Truck size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest">Dispatch Bay is Empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {orders.map((order) => {
                const totalPacks = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
                const totalCartons = Math.ceil(totalPacks / PACKS_PER_CARTON);
                const companyName = order.company?.business_name ?? "Direct Customer";

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[#B8860B]/30 transition-colors"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-2 inline-block border border-emerald-100">
                            Ready for Dispatch
                          </span>
                          <h3 className="text-xl font-black text-slate-900 leading-tight">{companyName}</h3>
                          <p className="text-xs font-bold text-slate-400 mt-1 font-mono uppercase">
                            ID: {order.id.split("-")[0]}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">{totalPacks} Packs</p>
                        <p className="text-xs font-bold text-[#B8860B] bg-[#B8860B]/10 px-2 py-0.5 rounded mt-1 inline-block">
                          {totalCartons} Cartons
                        </p>
                      </div>
                      <button
                        onClick={() => openDispatchModal(order)}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black transition-colors flex items-center gap-2 shadow-lg"
                      >
                        <Printer size={16} /> Process & Print
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* PROCESSING MODAL */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-50 border-slate-200 rounded-3xl p-0 print:hidden">
          {selectedOrder && (
            <>
              <DialogHeader className="p-6 pb-0 bg-white border-b border-slate-100">
                <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Package className="text-[#B8860B]" /> Logistics Command Center
                </DialogTitle>
                <div className="mt-4 pb-4">
                  <p className="text-lg font-black text-slate-900 leading-tight">
                    {selectedOrder.company?.business_name}
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} /> {selectedOrder.company?.billing_address || "No Address"}
                  </p>
                </div>
              </DialogHeader>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* LEFT COLUMN: Document Generation Engine */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                    Document Engine
                  </h3>

                  <button
                    onClick={() => handlePrint("barcodes")}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-[#B8860B] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <QrCode size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-slate-900">Carton Barcodes (TSC)</p>
                        <p className="text-xs font-medium text-slate-500">
                          {generatedCartons.length} Stickers (100x50mm)
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePrint("consignee")}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-[#B8860B] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Package size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-slate-900">Consignee Sticker</p>
                        <p className="text-xs font-medium text-slate-500">A4 Master Shipping Label</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePrint("packing_list")}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-[#B8860B] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <FileText size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-slate-900">Packing List</p>
                        <p className="text-xs font-medium text-slate-500">Detailed itemization</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePrint("invoice")}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-[#B8860B] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Globe size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-slate-900">Export Invoice</p>
                        <p className="text-xs font-medium text-slate-500">Commercial customs doc</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* RIGHT COLUMN: Physical Logistics Handover */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                    Logistics Handover
                  </h3>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Transporter Name *
                      </Label>
                      <Input
                        value={transporterName}
                        onChange={(e) => setTransporterName(e.target.value)}
                        className="bg-slate-50 border-none"
                        placeholder="e.g. FedEx / VRL"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        LR / Bilty Number
                      </Label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="bg-slate-50 border-none"
                        placeholder="Optional tracking"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Driver Phone</Label>
                      <Input
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="bg-slate-50 border-none"
                        placeholder="Driver contact"
                      />
                    </div>
                  </div>

                  <div className="bg-[#B8860B]/10 border border-[#B8860B]/20 rounded-xl p-4 flex items-start gap-3">
                    <Shield className="text-[#B8860B] mt-0.5 shrink-0" size={18} />
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-tight">Security Handover</p>
                      <p className="text-xs font-medium text-slate-600 mt-1">
                        Submitting this will push the {generatedCartons.length} barcodes to the Exit Gate terminal for
                        final physical scan-out.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmitDispatch}
                    disabled={submitting}
                    className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-colors disabled:opacity-50 bg-[#B8860B] text-white hover:bg-[#9A7009] shadow-lg shadow-[#B8860B]/20 flex items-center justify-center gap-2 mt-4"
                  >
                    {submitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Truck size={18} /> Push To Exit Gate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDispatch;
