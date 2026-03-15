import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import logoImg from "@/assets/logo-open.png";

const Register = () => {
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" className="h-16 mx-auto object-contain" />
          <h1 className="font-display text-2xl tracking-wide text-foreground">B2B Application</h1>
          <p className="font-body text-sm text-muted-foreground">Apply for wholesale access</p>
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card rounded-2xl shadow-card p-6 space-y-5"
            >
              <div className="space-y-2">
                <label className="font-body text-xs font-semibold text-foreground">Business Name</label>
                <Input placeholder="Your Company Pvt. Ltd." className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="font-body text-xs font-semibold text-foreground">GST Number</label>
                <Input placeholder="e.g. 07AAFCT0640R1ZZ" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="font-body text-xs font-semibold text-foreground">Email Address</label>
                <Input type="email" placeholder="you@business.com" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="font-body text-xs font-semibold text-foreground">Expected Monthly Volume</label>
                <Input placeholder="e.g. 50 Cartons / Month" className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="font-body text-xs font-semibold text-foreground">GST Certificate</label>
                  <button className="w-full py-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2">
                    <Upload size={20} className="text-muted-foreground" />
                    <span className="font-body text-[11px] text-muted-foreground">Upload PDF</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="font-body text-xs font-semibold text-foreground">Shop Photo</label>
                  <button className="w-full py-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2">
                    <Upload size={20} className="text-muted-foreground" />
                    <span className="font-body text-[11px] text-muted-foreground">Upload Image</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSubmitted(true)}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm hover:bg-primary/90 transition-colors shadow-fab"
              >
                Submit Application
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl shadow-card p-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="font-display text-xl tracking-wide text-foreground">Application Submitted</h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Your B2B application is now under review. Our team will manually verify your documents and approve your account within 24–48 hours.
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
