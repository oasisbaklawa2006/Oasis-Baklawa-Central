import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { FileText, Download, MessageCircle, Package, Truck, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type DocTab = "invoices" | "packing" | "transport";

const tabs: { id: DocTab; label: string; icon: typeof FileText }[] = [
  { id: "invoices", label: "Invoices & E-Way", icon: FileText },
  { id: "packing", label: "Packing Lists (DPL)", icon: Package },
  { id: "transport", label: "Transport (LR/Bilty)", icon: Truck },
];

interface Document {
  id: string;
  name: string;
  date: string;
  order: string;
  file_url: string | null;
}

const Documents = () => {
  const [activeTab, setActiveTab] = useState<DocTab>("invoices");
  const [documents, setDocuments] = useState<Record<DocTab, Document[]>>({
    invoices: [],
    packing: [],
    transport: [],
  });
  const [loading, setLoading] = useState(true);
  const { companyId } = useAuth();

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch from orders with their documents
      const { data: orders } = await supabase
        .from("orders")
        .select("id, created_at, final_invoice_url, proforma_invoice_url, eway_bill_url, eway_bill_number")
        .eq("company_id", companyId)
        .not("status", "eq", "draft")
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch from order_attachments
      const { data: attachments } = await supabase
        .from("order_attachments")
        .select("id, order_id, file_url, attachment_type, created_at")
        .in("order_id", (orders || []).map((o) => o.id))
        .order("created_at", { ascending: false });

      const invoiceDocs: Document[] = [];
      const packingDocs: Document[] = [];
      const transportDocs: Document[] = [];

      const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

      for (const order of orders || []) {
        const orderId = order.id.split("-")[0].toUpperCase();

        if (order.final_invoice_url) {
          invoiceDocs.push({
            id: `inv-${order.id}`,
            name: `Tax Invoice — ORD-${orderId}`,
            date: formatDate(order.created_at),
            order: `ORD-${orderId}`,
            file_url: order.final_invoice_url,
          });
        }
        if (order.proforma_invoice_url) {
          invoiceDocs.push({
            id: `pi-${order.id}`,
            name: `Proforma Invoice — ORD-${orderId}`,
            date: formatDate(order.created_at),
            order: `ORD-${orderId}`,
            file_url: order.proforma_invoice_url,
          });
        }
        if (order.eway_bill_url) {
          invoiceDocs.push({
            id: `eway-${order.id}`,
            name: `E-Way Bill ${order.eway_bill_number || ""} — ORD-${orderId}`,
            date: formatDate(order.created_at),
            order: `ORD-${orderId}`,
            file_url: order.eway_bill_url,
          });
        }
      }

      for (const att of attachments || []) {
        const orderId = att.order_id?.split("-")[0].toUpperCase() || "";
        const doc: Document = {
          id: att.id,
          name: `${att.attachment_type === "packing_proof" ? "Packing List" : att.attachment_type === "bilty" ? "LR/Bilty" : att.attachment_type || "Document"} — ORD-${orderId}`,
          date: att.created_at ? formatDate(att.created_at) : "",
          order: `ORD-${orderId}`,
          file_url: att.file_url,
        };

        if (att.attachment_type === "packing_proof" || att.attachment_type === "dpl") {
          packingDocs.push(doc);
        } else if (att.attachment_type === "bilty" || att.attachment_type === "lr_copy") {
          transportDocs.push(doc);
        } else {
          invoiceDocs.push(doc);
        }
      }

      setDocuments({ invoices: invoiceDocs, packing: packingDocs, transport: transportDocs });
      setLoading(false);
    };

    fetchDocuments();
  }, [companyId]);

  const handleDownload = (doc: Document) => {
    if (doc.file_url) {
      window.open(doc.file_url, "_blank");
    } else {
      toast.info("Document not available yet.");
    }
  };

  const handleWhatsApp = (doc: Document) => {
    if (doc.file_url) {
      const msg = encodeURIComponent(`Oasis Baklawa — ${doc.name}\n${doc.file_url}`);
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    } else {
      toast.info("Document not ready for sharing.");
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-5">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl tracking-wide text-foreground"
        >
          Document Center
        </motion.h1>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-fab"
                  : "bg-card text-foreground border border-border hover:border-primary/30"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : documents[activeTab].length === 0 ? (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center">
            <FileText size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No documents found in this category.</p>
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl shadow-card divide-y divide-border/50"
          >
            {documents[activeTab].map((doc) => (
              <div key={doc.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-semibold text-foreground text-sm truncate">{doc.name}</p>
                  <p className="font-body text-[11px] text-muted-foreground">
                    {doc.date} · {doc.order}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
                    aria-label="Download PDF"
                  >
                    <Download size={16} className="text-foreground" />
                  </button>
                  <button
                    onClick={() => handleWhatsApp(doc)}
                    className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors"
                    aria-label="Share via WhatsApp"
                  >
                    <MessageCircle size={16} className="text-green-600" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </AppShell>
  );
};

export default Documents;
