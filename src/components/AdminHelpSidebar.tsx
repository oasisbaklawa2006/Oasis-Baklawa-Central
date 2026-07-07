import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ManualEntry {
  id: string;
  tool_name: string | null;
  description: string | null;
  image_snapshot_url: string | null;
  step_order: number | null;
}

const ROLE_TIPS: Record<string, { title: string; tips: { icon: string; label: string; desc: string }[] }> = {
  finance_head: {
    title: "Finance Manual",
    tips: [
      { icon: "💳", label: "Settlement Flow", desc: "Navigate to Finance → Select pending orders → Click 'Settle'. The system auto-calculates GST and wallet adjustments." },
      { icon: "📊", label: "Audit Compliance", desc: "All wallet updates are logged as 'High Risk'. Review daily in Audit Trail → High Risk tab." },
      { icon: "🔒", label: "Credit Approvals", desc: "Credit requests appear in Finance Control. Approve or reject with mandatory notes for audit trail." },
    ],
  },
  production_manager: {
    title: "Production Manual",
    tips: [
      { icon: "🏭", label: "Daily Logs", desc: "Log production output and wastage for each product daily. This feeds into capacity planning." },
      { icon: "⚡", label: "Priority Queue", desc: "Orders marked 'Urgent' appear at the top. Complete these within 24 hours." },
      { icon: "📋", label: "Task Handoff", desc: "Mark items as 'Ready for Packing' to push them to the dispatch queue automatically." },
    ],
  },
  sales_executive: {
    title: "Sales Manual",
    tips: [
      { icon: "🤝", label: "Client Visits", desc: "Log every client interaction in the CRM tab. Follow-up reminders auto-generate." },
      { icon: "📈", label: "Your Scorecard", desc: "Track your sales performance, commission balance, and liability score in Sales Console." },
      { icon: "↩️", label: "Returns", desc: "Returns attributed to 'Sales Error' affect your liability. Ensure order accuracy to maintain a clean record." },
    ],
  },
  super_admin: {
    title: "CMD Manual",
    tips: [
      { icon: "👑", label: "Heartbeat", desc: "The CMD Heartbeat shows real-time vitals across all departments. Check daily for critical alerts." },
      { icon: "🔐", label: "User Control", desc: "Manage roles and permissions in User & Role Control. All changes are audit-logged." },
      { icon: "📡", label: "Notifications", desc: "Configure automated messaging templates and monitor the Live Outbox for delivery status." },
    ],
  },
  admin: {
    title: "Admin Manual",
    tips: [
      { icon: "⚙️", label: "System Settings", desc: "Configure MOQ rules, currency rates, and pricing slabs from the Rules & Controls section." },
      { icon: "🛡️", label: "Security", desc: "Review audit logs regularly. Archive logs older than 90 days to maintain system performance." },
      { icon: "📦", label: "Inventory", desc: "Monitor factory stock levels. Items below threshold auto-flag in the Exception Center." },
    ],
  },
};

const DEFAULT_TIPS = ROLE_TIPS.admin;

const AdminHelpSidebar = () => {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      const r = data?.role ?? "admin";
      setRole(r);

      const { data: entries } = await supabase
        .from("admin_manual_entries")
        .select("*")
        .eq("role_target", r)
        .order("step_order", { ascending: true });
      if (entries) setManualEntries(entries);
    };
    fetch();
  }, [user]);

  const tips = (role && ROLE_TIPS[role]) || DEFAULT_TIPS;

  return (
    <>
      {/* Floating help button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[160] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors"
        style={{
          background: "linear-gradient(135deg, #C4A052, #D4B56A)",
          color: "#0a0a0a",
          boxShadow: "0 4px 20px rgba(196,160,82,0.35)",
        }}
      >
        <HelpCircle size={20} />
      </motion.button>

      {/* Slide-over */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[170] bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-[170] w-full max-w-sm overflow-y-auto"
              style={{ backgroundColor: "#111111", borderLeft: "1px solid rgba(196,160,82,0.15)" }}
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <BookOpen size={18} style={{ color: "#C4A052" }} />
                  <h2 className="font-display text-lg font-semibold" style={{ color: "#ffffff" }}>
                    {tips.title}
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Tips */}
              <div className="p-6 space-y-4">
                <p className="text-[10px] tracking-[0.25em] uppercase font-ui font-semibold" style={{ color: "#C4A052" }}>
                  Quick Reference
                </p>
                {tips.tips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-xl p-4 space-y-2"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {/* Snapshot placeholder */}
                    <div
                      className="w-full h-20 rounded-lg flex items-center justify-center text-2xl mb-3"
                      style={{ backgroundColor: "rgba(196,160,82,0.06)", border: "1px solid rgba(196,160,82,0.1)" }}
                    >
                      {tip.icon}
                    </div>
                    <h4 className="text-sm font-ui font-semibold" style={{ color: "#ffffff" }}>
                      {tip.label}
                    </h4>
                    <p className="text-xs font-body leading-relaxed" style={{ color: "#8a8a8a" }}>
                      {tip.desc}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* DB-sourced entries */}
              {manualEntries.length > 0 && (
                <div className="p-6 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] tracking-[0.25em] uppercase font-ui font-semibold" style={{ color: "#C4A052" }}>
                    Detailed Instructions
                  </p>
                  {manualEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl p-4 space-y-2"
                      style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {entry.image_snapshot_url && (
                        <img
                          src={entry.image_snapshot_url}
                          alt={entry.tool_name ?? ""}
                          className="w-full h-24 object-cover rounded-lg"
                          loading="lazy"
                        />
                      )}
                      <h4 className="text-sm font-ui font-semibold" style={{ color: "#ffffff" }}>
                        {entry.tool_name}
                      </h4>
                      <p className="text-xs font-body leading-relaxed" style={{ color: "#8a8a8a" }}>
                        {entry.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="p-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-ui" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Oasis Baklawa ERP • Role-Specific Manual v1.0
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminHelpSidebar;
