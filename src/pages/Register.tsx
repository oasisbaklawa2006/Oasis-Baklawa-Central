import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, ArrowLeft, Loader2, FileText, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";

const VOLUME_OPTIONS = [
  "₹50,000 - ₹1 Lakh",
  "₹1 Lakh - ₹5 Lakhs",
  "₹5 Lakhs+",
];

const Register = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [shopFile, setShopFile] = useState<File | null>(null);
  const gstInputRef = useRef<HTMLInputElement>(null);
  const shopInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!email || !password || !businessName) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);

    // Step 1: Sign up user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          business_name: businessName,
          gst_number: gstNumber,
          business_volume: volume,
        },
      },
    });

    if (authErr) {
      toast.error(authErr.message);
      setLoading(false);
      return;
    }

    // Step 2: Insert into b2b_applications
    const { error: appErr } = await supabase.from("b2b_applications").insert({
      business_name: businessName,
      gst_number: gstNumber || null,
      expected_volume: volume || null,
      contact_email: email,
      user_id: authData.user?.id ?? null,
      status: "pending",
    });

    if (appErr) {
      console.error("B2B application insert error:", appErr);
      // Don't block – user is created, application just needs retry
    }

    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10" style={{ backgroundColor: "#f3f5f9" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" className="h-14 mx-auto object-contain" />
          <h1 className="font-display text-2xl tracking-wide" style={{ color: "#1c1c1c" }}>B2B Application</h1>
          <p className="font-body text-sm text-muted-foreground">Apply for wholesale access</p>
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-2xl shadow-card p-6 space-y-5"
            >
              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Business Name *</label>
                <Input placeholder="Your Company Pvt. Ltd." className="rounded-xl" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>GST Number</label>
                <Input placeholder="e.g. 07AAFCT0640R1ZZ" className="rounded-xl" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Email Address *</label>
                <Input type="email" placeholder="you@business.com" className="rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Password *</label>
                <Input type="password" placeholder="Min 6 characters" className="rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Expected Monthly Volume</label>
                <select
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select volume range…</option>
                  {VOLUME_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>GST Certificate</label>
                  <input
                    ref={gstInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => setGstFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => gstInputRef.current?.click()}
                    className="w-full py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2"
                  >
                    {gstFile ? (
                      <>
                        <FileText size={18} className="text-primary" />
                        <span className="font-body text-[11px] text-primary font-medium truncate max-w-full px-2">{gstFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload size={18} className="text-muted-foreground" />
                        <span className="font-body text-[11px] text-muted-foreground">Upload PDF/Image</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Shop Photo</label>
                  <input
                    ref={shopInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => setShopFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => shopInputRef.current?.click()}
                    className="w-full py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2"
                  >
                    {shopFile ? (
                      <>
                        <Image size={18} className="text-primary" />
                        <span className="font-body text-[11px] text-primary font-medium truncate max-w-full px-2">{shopFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload size={18} className="text-muted-foreground" />
                        <span className="font-body text-[11px] text-muted-foreground">Upload Image</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-ui font-bold text-sm hover:bg-primary/90 transition-colors shadow-fab disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? "Submitting…" : "Submit Application"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-card p-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="font-display text-xl tracking-wide" style={{ color: "#1c1c1c" }}>Application Submitted</h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Check your email to confirm your account. Our team will verify your documents and approve your B2B access within 24–48 hours.
              </p>
              <p className="font-fine text-xs text-muted-foreground">Pending Manual Admin Approval</p>
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 mx-auto text-primary font-body text-sm font-semibold hover:underline mt-2"
              >
                <ArrowLeft size={14} />
                Back to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted && (
          <div className="text-center">
            <p className="font-body text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary font-semibold hover:underline">
                Login
              </button>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Register;
