import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { FileText, Download, MessageCircle, Package, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DocTab = "invoices" | "packing" | "transport";

const tabs: { id: DocTab; label: string; icon: typeof FileText }[] = [
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "packing", label: "Packing Lists", icon: Package },
  { id: "transport", label: "Transport (LR)", icon: Truck },
];

interface Document {
  id: string;
  name: string;
  date: string;
  order: string;
}

const documents: Record<DocTab, Document[]> = {
  invoices: [
    { id: "inv1", name: "Invoice INV-2026-089", date: "12 Mar 2026", order: "ORD-089" },
    { id: "inv2", name: "Invoice INV-2026-074", date: "28 Feb 2026", order: "ORD-074" },
    { id: "inv3", name: "Invoice INV-2026-061", date: "15 Feb 2026", order: "ORD-061" },
  ],
  packing: [
    { id: "pl1", name: "Packing List PL-089", date: "13 Mar 2026", order: "ORD-089" },
    { id: "pl2", name: "Packing List PL-074", date: "01 Mar 2026", order: "ORD-074" },
  ],
  transport: [
    { id: "lr1", name: "LR Copy LR-089-DL", date: "14 Mar 2026", order: "ORD-089" },
    { id: "lr2", name: "LR Copy LR-074-DL", date: "02 Mar 2026", order: "ORD-074" },
  ],
};

const handleWhatsApp = (doc: Document) => {
  toast.success(`Sharing ${doc.name} via WhatsApp`);
};

const Documents = () => {
  const [activeTab, setActiveTab] = useState<DocTab>("invoices");

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
                  onClick={() => toast.info(`Downloading ${doc.name}...`)}
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
      </div>
    </AppShell>
  );
};

export default Documents;
