import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, ArrowLeft, Loader2, FileText, Image, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";

const VOLUME_OPTIONS = [
  "₹50,000 - ₹1 Lakh",
  "₹1 Lakh - ₹5 Lakhs",
  "₹5 Lakhs+",
];

const BUSINESS_TYPES = [
  "Retailer",
  "Wholesaler / Distributor",
  "HoReCa (Hotel / Restaurant / Café)",
  "Gifting / Corporate",
  "E-commerce Reseller",
  "Other",
];

const DISPATCH_OPTIONS = [
  "Company Logistics",
  "Own Transporter",
  "Third-Party Courier",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh",
];

const Register = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [currentBrands, setCurrentBrands] = useState("");
  const [preferredDispatch, setPreferredDispatch] = useState("");
  const [preferredDispatchOther, setPreferredDispatchOther] = useState("");
  const [tradeDeclaration, setTradeDeclaration] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);

  // Files
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const gstInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!businessName.trim()) e.businessName = "Required";
    if (!contactPerson.trim()) e.contactPerson = "Required";
    if (!mobileNumber.trim()) e.mobileNumber = "Required";
    else if (!/^\d{10}$/.test(mobileNumber.trim())) e.mobileNumber = "Enter valid 10-digit number";
    if (!contactEmail.trim()) e.contactEmail = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) e.contactEmail = "Invalid email";
    if (!registeredAddress.trim()) e.registeredAddress = "Required";
    if (!city.trim()) e.city = "Required";
    if (!state) e.state = "Required";
    if (!pincode.trim()) e.pincode = "Required";
    else if (!/^\d{6}$/.test(pincode.trim())) e.pincode = "Enter valid 6-digit pincode";
    if (!businessType) e.businessType = "Required";
    if (!tradeDeclaration) e.tradeDeclaration = "You must accept the trade declaration";
    if (!dataConsent) e.dataConsent = "You must consent to data processing";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("trade-documents").upload(path, file);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    return path;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted errors");
      return;
    }
    setLoading(true);

    try {
      // Upload files
      let gstPath: string | null = null;
      let proofPath: string | null = null;

      if (gstFile) {
        gstPath = await uploadFile(gstFile, "gst-certificates");
        if (!gstPath) {
          toast.error("Failed to upload GST certificate");
          setLoading(false);
          return;
        }
      }

      if (proofFile) {
        proofPath = await uploadFile(proofFile, "business-proofs");
        if (!proofPath) {
          toast.error("Failed to upload business proof");
          setLoading(false);
          return;
        }
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from("b2b_applications")
        .select("id")
        .eq("contact_email", contactEmail.trim().toLowerCase())
        .in("status", ["pending", "approved"])
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("An application with this email already exists");
        setLoading(false);
        return;
      }

      // Insert application
      const { error: insertErr } = await supabase.from("b2b_applications").insert({
        business_name: businessName.trim(),
        trade_name: tradeName.trim() || null,
        business_type: businessType || null,
        contact_person: contactPerson.trim(),
        mobile_number: mobileNumber.trim(),
        contact_email: contactEmail.trim().toLowerCase(),
        registered_address: registeredAddress.trim(),
        city: city.trim(),
        state: state,
        pincode: pincode.trim(),
        gst_number: gstNumber.trim() || null,
        gst_certificate_path: gstPath,
        business_proof_path: proofPath,
        expected_volume: expectedVolume || null,
        current_brands: currentBrands.trim() || null,
        preferred_dispatch: preferredDispatch || null,
        preferred_dispatch_other_name: preferredDispatch === "Own Transporter" ? preferredDispatchOther.trim() || null : null,
        trade_declaration: tradeDeclaration,
        data_consent: dataConsent,
        status: "pending",
      });

      if (insertErr) {
        console.error("Insert error:", insertErr);
        toast.error("Failed to submit application. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const FieldError = ({ field }: { field: string }) => {
    if (!errors[field]) return null;
    return <span className="text-destructive text-xs font-ui flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors[field]}</span>;
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-body-h3 text-foreground pt-2 pb-1 border-b border-border">{children}</h3>
  );

  const selectClass = "w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{ backgroundColor: "hsl(var(--background))" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-6"
      >
        <div className="text-center space-y-2">
          <img src={logoImg} alt="Oasis Baklawa" className="h-12 mx-auto object-contain" />
          <h1 className="text-display-h2 text-foreground">Trade Application</h1>
          <p className="text-body-p2 text-muted-foreground">Apply for wholesale ordering access</p>
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card rounded-2xl border border-border p-6 space-y-5"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              {/* Section 1: Business Identity */}
              <SectionTitle>Business Identity</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-ui-label text-foreground">Business Name *</label>
                  <Input placeholder="Legal entity name" className="rounded-xl mt-1" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                  <FieldError field="businessName" />
                </div>
                <div>
                  <label className="text-ui-label text-foreground">Trade Name</label>
                  <Input placeholder="Brand / trade name" className="rounded-xl mt-1" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-ui-label text-foreground">Business Type *</label>
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="">Select type…</option>
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <FieldError field="businessType" />
              </div>

              {/* Section 2: Contact */}
              <SectionTitle>Contact Information</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-ui-label text-foreground">Contact Person *</label>
                  <Input placeholder="Full name" className="rounded-xl mt-1" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                  <FieldError field="contactPerson" />
                </div>
                <div>
                  <label className="text-ui-label text-foreground">Mobile Number *</label>
                  <Input placeholder="10-digit mobile" className="rounded-xl mt-1" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} maxLength={10} />
                  <FieldError field="mobileNumber" />
                </div>
              </div>
              <div>
                <label className="text-ui-label text-foreground">Email Address *</label>
                <Input type="email" placeholder="you@business.com" className="rounded-xl mt-1" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                <FieldError field="contactEmail" />
              </div>

              {/* Section 3: Address */}
              <SectionTitle>Registered Address</SectionTitle>
              <div>
                <label className="text-ui-label text-foreground">Address *</label>
                <Textarea placeholder="Full registered address" className="rounded-xl mt-1" value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} rows={2} />
                <FieldError field="registeredAddress" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-ui-label text-foreground">City *</label>
                  <Input placeholder="City" className="rounded-xl mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
                  <FieldError field="city" />
                </div>
                <div>
                  <label className="text-ui-label text-foreground">State *</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className={`${selectClass} mt-1`}>
                    <option value="">Select…</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <FieldError field="state" />
                </div>
                <div>
                  <label className="text-ui-label text-foreground">Pincode *</label>
                  <Input placeholder="6 digits" className="rounded-xl mt-1" value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6} />
                  <FieldError field="pincode" />
                </div>
              </div>

              {/* Section 4: Tax & Documents */}
              <SectionTitle>Tax & Documents</SectionTitle>
              <div>
                <label className="text-ui-label text-foreground">GST Number</label>
                <Input placeholder="e.g. 07AAFCT0640R1ZZ" className="rounded-xl mt-1" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-ui-label text-foreground">GST Certificate</label>
                  <input ref={gstInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => setGstFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => gstInputRef.current?.click()} className="w-full py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2">
                    {gstFile ? (
                      <><FileText size={18} className="text-primary" /><span className="text-fine text-primary font-medium truncate max-w-full px-2">{gstFile.name}</span></>
                    ) : (
                      <><Upload size={18} className="text-muted-foreground" /><span className="text-fine text-muted-foreground">Upload PDF/Image</span></>
                    )}
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-ui-label text-foreground">Business Proof</label>
                  <input ref={proofInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => proofInputRef.current?.click()} className="w-full py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2">
                    {proofFile ? (
                      <><Image size={18} className="text-primary" /><span className="text-fine text-primary font-medium truncate max-w-full px-2">{proofFile.name}</span></>
                    ) : (
                      <><Upload size={18} className="text-muted-foreground" /><span className="text-fine text-muted-foreground">Upload Image/PDF</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* Trade Details section removed per business request */}

              {/* Section 6: Declarations */}
              <SectionTitle>Declarations</SectionTitle>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox id="trade-decl" checked={tradeDeclaration} onCheckedChange={(v) => setTradeDeclaration(v === true)} className="mt-0.5" />
                  <label htmlFor="trade-decl" className="text-body-p3 text-foreground leading-snug cursor-pointer">
                    I declare that this application is for trade/wholesale purposes only and all information provided is accurate. *
                  </label>
                </div>
                <FieldError field="tradeDeclaration" />
                <div className="flex items-start gap-3">
                  <Checkbox id="data-consent" checked={dataConsent} onCheckedChange={(v) => setDataConsent(v === true)} className="mt-0.5" />
                  <label htmlFor="data-consent" className="text-body-p3 text-foreground leading-snug cursor-pointer">
                    I consent to the processing of my data for the purpose of this B2B trade application. *
                  </label>
                </div>
                <FieldError field="dataConsent" />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-ui-button hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? "Submitting…" : "Submit Trade Application"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl border border-border p-8 text-center space-y-4"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-display-h2 text-foreground">Application Submitted</h2>
              <p className="text-body-p2 text-muted-foreground leading-relaxed">
                Your account will be verified very soon.
              </p>
              <p className="text-fine text-muted-foreground">Status: Pending Manual Review</p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="tel:+919999999999"
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-ui font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-primary/90"
                >
                  📞 Call Our Helpline
                </a>
                <a
                  href="https://wa.me/919999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl bg-[hsl(142,70%,40%)] text-white font-ui font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-[hsl(142,70%,35%)]"
                >
                  💬 WhatsApp Us
                </a>
              </div>

              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 mx-auto text-primary text-body-p2 font-semibold hover:underline mt-2"
              >
                <ArrowLeft size={14} />
                Back to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted && (
          <div className="text-center">
            <p className="text-body-p2 text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary font-semibold hover:underline">Login</button>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Register;
