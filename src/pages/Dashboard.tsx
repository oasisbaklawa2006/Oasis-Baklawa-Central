import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Building2,
  FileText,
  Wallet,
  Users,
  MapPin,
  Truck,
  HelpCircle,
  FileCheck,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
  Download,
} from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import BottomNavBar from "@/components/BottomNavBar";

const Dashboard = () => {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch the logged-in user and their linked company profile securely
      const { data, error } = await supabase
        .from("users")
        .select("*, company:companies(*)")
        .eq("id", session.user.id)
        .single();

      if (!error && data?.company) {
        setCompany(data.company);
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-3xl mx-auto space-y-6">
        <div className="mb-2">
          <h1 className="text-display-h2 text-foreground">My Account</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Manage your wholesale portal</p>
        </div>

        {/* LIVE BUSINESS PROFILE CARD */}
        <section className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-ui-h4 text-foreground leading-tight">
                {company?.business_name || "Company Profile Pending"}
              </h2>
              <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-[11px] font-bold uppercase tracking-wider border border-green-200">
                <ShieldCheck size={12} /> Verified Buyer
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">GSTIN</p>
              <p className="text-sm font-medium text-foreground">{company?.gst_number || "Pending Update"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">FSSAI License</p>
              <p className="text-sm font-medium text-foreground">{company?.fssai_license || "Pending Update"}</p>
            </div>
          </div>
        </section>

        {/* SUPPORT & ASSISTANCE CARD (NEW) */}
        <section className="bg-amber-50 rounded-2xl p-6 border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 text-amber-900 pointer-events-none">
            <Phone size={120} />
          </div>
          <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-4">Dedicated Support</h3>
          <div className="space-y-4 relative z-10">
            <a
              href="https://wa.me/919891162212"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 text-sm font-medium text-amber-800 hover:text-amber-600 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-amber-200/50 flex items-center justify-center">
                <MessageCircle size={16} />
              </div>
              WhatsApp: +91 9891162212
            </a>
            <a
              href="tel:+919999792959"
              className="flex items-center gap-3 text-sm font-medium text-amber-800 hover:text-amber-600 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-amber-200/50 flex items-center justify-center">
                <Phone size={16} />
              </div>
              Call: +91 9999792959
            </a>
            <a
              href="mailto:info@oasisbaklawa.com"
              className="flex items-center gap-3 text-sm font-medium text-amber-800 hover:text-amber-600 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-amber-200/50 flex items-center justify-center">
                <Mail size={16} />
              </div>
              info@oasisbaklawa.com
            </a>
          </div>
        </section>

        {/* DOCUMENT CENTER - LIVE PREPARATION */}
        <section className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Document Center
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Your official invoices and Lorry Receipts (LR) will appear here once dispatched.
          </p>
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center">
            <p className="text-sm text-muted-foreground font-medium">No documents available yet.</p>
          </div>
        </section>

        {/* GRAYSCALED MODULES (COMING SOON) */}
        <div className="opacity-60 grayscale-[50%] pointer-events-none space-y-6">
          <section className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Wallet size={16} /> Digital Wallet
              </h3>
              <span className="px-2 py-1 bg-muted text-[10px] font-bold uppercase tracking-wider rounded-md">
                Coming Soon
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">₹0.00</p>
            <p className="text-xs text-muted-foreground">Available Advance Balance</p>
          </section>

          <section className="bg-card rounded-2xl overflow-hidden border border-border">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
              <span className="text-sm font-bold flex items-center gap-2">
                <Users size={16} /> Manage Users
              </span>
              <span className="px-2 py-0.5 bg-muted text-[10px] font-bold uppercase rounded-md">Locked</span>
            </div>
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
              <span className="text-sm font-bold flex items-center gap-2">
                <MapPin size={16} /> Delivery Addresses
              </span>
              <span className="px-2 py-0.5 bg-muted text-[10px] font-bold uppercase rounded-md">Locked</span>
            </div>
            <div className="p-4 flex justify-between items-center bg-muted/10">
              <span className="text-sm font-bold flex items-center gap-2">
                <Download size={16} /> Master Rate Card
              </span>
              <span className="px-2 py-0.5 bg-muted text-[10px] font-bold uppercase rounded-md">Locked</span>
            </div>
          </section>
        </div>
      </main>

      <BottomNavBar />
    </div>
  );
};

export default Dashboard;
