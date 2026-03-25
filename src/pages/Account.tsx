import AppShell from "@/components/AppShell";
import WithdrawalModal from "@/components/WithdrawalModal";
import { motion } from "framer-motion";
import {
  Building2,
  FileText,
  MapPin,
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Users,
  Truck,
  Settings,
  Globe,
  BarChart3,
  HelpCircle,
  ScrollText,
  LogOut,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Adjusted to match your exact Supabase schema
interface CompanyProfile {
  id: string;
  business_name: string;
  gst_number: string | null;
  website: string | null;
  current_balance: number | null; // Changed from wallet_balance
  credit_limit: number | null;
}

interface WalletTx {
  id: string;
  type: string | null; // Database returns string | null
  reference: string | null; // Changed from label
  amount: number;
  created_at: string | null;
}

const settingsMenu = [
  { label: "Manage Users", desc: "Add or remove team members", icon: Users, path: "/account/users" },
  { label: "Delivery Addresses", desc: "Manage shipping locations", icon: MapPin, path: "/account/addresses" },
  { label: "Preferred Courier", desc: "Set default transporter", icon: Truck, path: "/account/logistics" },
  { label: "FAQ", desc: "Frequently asked questions", icon: HelpCircle, path: "/faq" },
  { label: "Terms & Conditions", desc: "Legal and compliance info", icon: ScrollText, path: "/terms" },
];

const formatPrice = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Account = () => {
  const navigate = useNavigate();
  const [showWithdrawal, setShowWithdrawal] = useState(false);

  // Real Data State
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);

  useEffect(() => {
    const fetchAccountData = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login");
          return;
        }

        const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();

        if (profile?.company_id) {
          const { data: companyData } = await supabase
            .from("companies")
            .select("*")
            .eq("id", profile.company_id)
            .single();

          // Use unknown cast to safely bypass TS strictness while matching actual schema
          if (companyData) setCompany(companyData as unknown as CompanyProfile);

          const { data: txData } = await supabase
            .from("wallet_transactions")
            .select("*")
            .eq("company_id", profile.company_id)
            .order("created_at", { ascending: false })
            .limit(5);

          if (txData) setTransactions(txData as unknown as WalletTx[]);
        }
      } catch (error) {
        console.error("Error fetching account data:", error);
        toast.error("Failed to load account details.");
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [navigate]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-[#C5A059]" size={32} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pt-24 max-w-4xl mx-auto pb-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold tracking-wide text-gray-900"
        >
          My Account
        </motion.h1>

        {/* Company Profile (REAL DATA) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/10 flex items-center justify-center border border-[#C5A059]/20">
              <Building2 size={28} className="text-[#C5A059]" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-gray-900 text-xl md:text-2xl">
                {company?.business_name || "Unregistered Business"}
              </h2>
              <p className="font-medium text-xs text-gray-500 uppercase tracking-wider mt-1">Registered B2B Partner</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 py-3 border-b border-gray-100">
              <FileText size={16} className="text-[#C5A059] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GSTIN</p>
                <p className="font-bold text-sm text-gray-900">{company?.gst_number || "Pending Update"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3 border-b border-gray-100">
              <FileText size={16} className="text-[#C5A059] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">FSSAI License</p>
                <p className="font-bold text-sm text-gray-900">Pending Update</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3 border-b border-gray-100 md:col-span-2">
              <MapPin size={16} className="text-[#C5A059] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Registered Billing Address
                </p>
                <p className="font-medium text-sm text-gray-900 leading-relaxed">
                  No address on file. Please update your profile.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Digital Wallet (REAL DATA) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={20} className="text-[#C5A059]" />
            <h2 className="font-serif text-xl font-bold tracking-wide text-gray-900">Digital Wallet & Credit</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-[#C5A059]/10 to-[#C5A059]/5 rounded-2xl p-6 border border-[#C5A059]/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059] mb-1">
                Available Cash Balance
              </p>
              <p className="font-serif text-4xl font-bold text-gray-900">
                {formatPrice(company?.current_balance || 0)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                Approved Credit Limit
              </p>
              <p className="font-serif text-3xl font-bold text-gray-900">{formatPrice(company?.credit_limit || 0)}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => toast.info("Top-up instructions sent to your registered email.")}
              className="flex-1 py-3.5 rounded-xl bg-[#C5A059] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#B38F48] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <Plus size={16} /> Add Funds
            </button>
            <button
              onClick={() => setShowWithdrawal(true)}
              disabled={(company?.current_balance || 0) <= 0}
              className="flex-1 py-3.5 rounded-xl bg-white border-2 border-[#C5A059]/20 text-[#C5A059] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#C5A059]/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard size={16} /> Request Withdrawal
            </button>
          </div>

          {/* Ledger */}
          <div className="pt-6 border-t border-gray-100">
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Recent Transactions</h3>
              <button className="text-[10px] font-bold text-[#C5A059] hover:underline uppercase tracking-widest">
                View Ledger
              </button>
            </div>

            <div className="space-y-1">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 border-b last:border-0 border-gray-100 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === "credit" ? "bg-green-50 border border-green-100 text-green-600" : "bg-red-50 border border-red-100 text-red-600"}`}
                      >
                        {tx.type === "credit" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{tx.reference || "Transaction"}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">
                          {tx.created_at ? formatDate(tx.created_at) : "N/A"}
                        </p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "credit" ? "+" : "−"}
                      {formatPrice(tx.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <AlertCircle size={24} className="mx-auto text-gray-300 mb-2 opacity-50" />
                  <p className="text-xs font-medium text-gray-500">No recent transactions found.</p>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* Account Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Settings size={20} className="text-[#C5A059]" />
            <h2 className="font-serif text-xl font-bold tracking-wide text-gray-900">Preferences & Settings</h2>
          </div>

          <div className="space-y-2">
            {settingsMenu.map((item, i) => (
              <button
                key={i}
                onClick={() => toast.info(`Navigating to ${item.label}...`)}
                className="w-full flex items-center gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-[#C5A059]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C5A059] group-hover:text-white transition-colors">
                  <item.icon size={18} className="text-[#C5A059] group-hover:text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm text-gray-900">{item.label}</p>
                  <p className="text-[11px] font-medium text-gray-500">{item.desc}</p>
                </div>
                <ArrowUpRight size={16} className="text-gray-400 group-hover:text-[#C5A059] transition-colors" />
              </button>
            ))}

            <button
              onClick={() => navigate("/documents")}
              className="w-full flex items-center gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group mt-2"
            >
              <div className="w-10 h-10 rounded-full bg-[#C5A059]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C5A059] group-hover:text-white transition-colors">
                <FileText size={18} className="text-[#C5A059] group-hover:text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-sm text-gray-900">Document Center</p>
                <p className="text-[11px] font-medium text-gray-500">Invoices, packing lists & LR copies</p>
              </div>
              <ArrowUpRight size={16} className="text-gray-400 group-hover:text-[#C5A059] transition-colors" />
            </button>
          </div>
        </motion.section>

        {/* Logout */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Logged out successfully");
              navigate("/login");
            }}
            className="w-full py-4 rounded-2xl border-2 border-red-100 text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-200 transition-colors"
          >
            <LogOut size={18} />
            Secure Sign Out
          </button>
        </motion.section>
      </div>

      <WithdrawalModal open={showWithdrawal} onClose={() => setShowWithdrawal(false)} />
    </AppShell>
  );
};

export default Account;
