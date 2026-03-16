import AppShell from "@/components/AppShell";
import WithdrawalModal from "@/components/WithdrawalModal";
import { motion } from "framer-motion";
import { Building2, FileText, MapPin, Wallet, Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Users, Truck, Settings, Globe, BarChart3, HelpCircle, ScrollText, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const transactions = [
  { id: 1, type: "credit" as const, label: "Excess Advance Refund", amount: 10000, date: "12 Mar 2026" },
  { id: 2, type: "debit" as const, label: "Adjusted on ORD-089", amount: 2500, date: "08 Mar 2026" },
  { id: 3, type: "credit" as const, label: "Wallet Top-Up via NEFT", amount: 50000, date: "01 Mar 2026" },
  { id: 4, type: "debit" as const, label: "Advance for ORD-074", amount: 12500, date: "25 Feb 2026" },
];

const settingsMenu = [
  { label: "Manage Users", desc: "Add or remove team members", icon: Users },
  { label: "Delivery Addresses", desc: "Manage shipping locations", icon: MapPin },
  { label: "Preferred Courier", desc: "Set default transporter", icon: Truck },
  { label: "FAQ", desc: "Frequently asked questions", icon: HelpCircle },
  { label: "Terms & Conditions", desc: "Legal and compliance info", icon: ScrollText },
];

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const Account = () => {
  const navigate = useNavigate();
  const [showWithdrawal, setShowWithdrawal] = useState(false);

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl tracking-wide text-foreground"
        >
          My Account
        </motion.h1>

        {/* Company Profile */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl shadow-card p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-body font-bold text-foreground text-sm">TCF Chocolates & Gifts Private Limited</h2>
              <p className="font-fine text-[11px] text-muted-foreground">Registered Business Entity</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 py-2 border-b border-border/50">
              <FileText size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-fine text-[11px] text-muted-foreground">GSTIN</p>
                <p className="font-body text-sm font-semibold text-foreground">07AAFCT0640R1ZZ</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-border/50">
              <FileText size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-fine text-[11px] text-muted-foreground">FSSAI License</p>
                <p className="font-body text-sm font-semibold text-foreground">13320007000438</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-border/50">
              <Globe size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-fine text-[11px] text-muted-foreground">Business Website</p>
                <p className="font-body text-sm font-semibold text-primary">www.tcfchocolates.com</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-border/50">
              <BarChart3 size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-fine text-[11px] text-muted-foreground">Registered Business Volume</p>
                <p className="font-body text-sm font-semibold text-foreground">Expected Volume: ₹2 Lakhs/month</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <MapPin size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-fine text-[11px] text-muted-foreground">Billing Address</p>
                <p className="font-body text-sm font-semibold text-foreground leading-relaxed">
                  23/5-B, East Patel Nagar, New Delhi – 110008
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Digital Wallet */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl shadow-card p-5 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-primary" />
            <h2 className="font-display text-lg tracking-wide text-foreground">Digital Wallet</h2>
          </div>

          <div className="bg-primary/5 rounded-xl p-5 text-center space-y-1 border border-primary/15">
            <p className="font-fine text-[11px] text-muted-foreground font-medium">Available Balance</p>
            <p className="font-display text-3xl text-foreground tracking-wide">₹45,000</p>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab">
              <Plus size={16} />
              Add Funds
            </button>
            <button className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:border-primary/50 transition-colors">
              <CreditCard size={16} />
              Withdraw
            </button>
          </div>

          {/* Ledger */}
          <div className="space-y-1">
            <h3 className="font-body font-bold text-foreground text-sm">Recent Transactions</h3>
            <div className="space-y-0">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0 border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === "credit" ? "bg-green-50 text-green-600" : "bg-destructive/5 text-destructive"}`}>
                      {tx.type === "credit" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div>
                      <p className="font-body text-sm font-semibold text-foreground">{tx.label}</p>
                      <p className="font-fine text-[11px] text-muted-foreground">{tx.date}</p>
                    </div>
                  </div>
                  <p className={`font-body text-sm font-bold ${tx.type === "credit" ? "text-green-600" : "text-destructive"}`}>
                    {tx.type === "credit" ? "+" : "−"}{formatPrice(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowWithdrawal(true)}
            className="w-full py-3 rounded-xl bg-card border border-border text-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:border-primary/50 transition-colors"
          >
            <Wallet size={16} className="text-primary" />
            Request Withdrawal
          </button>
        </motion.section>

        {/* Account Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl shadow-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h2 className="font-display text-lg tracking-wide text-foreground">Account Settings</h2>
          </div>

          <div className="space-y-1">
            {settingsMenu.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-body text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="font-fine text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}

            <button
              onClick={() => navigate("/documents")}
              className="w-full flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-body text-sm font-semibold text-foreground">Document Center</p>
                <p className="font-fine text-[11px] text-muted-foreground">Invoices, packing lists & LR copies</p>
              </div>
              <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </motion.section>
      </div>

      <WithdrawalModal open={showWithdrawal} onClose={() => setShowWithdrawal(false)} />
    </AppShell>
  );
};

export default Account;
