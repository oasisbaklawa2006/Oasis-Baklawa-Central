import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-5 py-6 pt-24 pb-32">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-display text-2xl font-bold tracking-wide text-foreground">
            Terms & Conditions
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-6 space-y-6 text-sm text-muted-foreground leading-relaxed"
        >
          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">1. General Terms</h2>
            <p>These terms govern the B2B trade relationship between TCF Chocolates & Gifts Private Limited (trading as "Oasis Baklawa") and registered trade partners using this platform. By placing an order, you agree to these terms.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">2. Ordering & Payment</h2>
            <p>All orders require a 20% advance payment (rounded to the nearest ₹1,000) before production begins. The advance is non-refundable once production has commenced. The remaining balance must be cleared before dispatch.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">3. Pricing</h2>
            <p>Prices are exclusive of GST unless stated otherwise. GST is calculated per line item based on product category (5% for bulk sweets, 18% for ready packs and premium items). Prices may be updated without prior notice; the price at the time of order confirmation is binding.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">4. Delivery & Dispatch</h2>
            <p>Estimated dispatch dates are calculated based on production capacity, factory holidays, and buffer days. Oasis Baklawa is not liable for delays caused by force majeure, courier issues, or payment delays.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">5. Returns & Complaints</h2>
            <p>Quality complaints must be raised within 10 days of the actual dispatch date through the Support Ticket system. Returns are subject to inspection and admin approval. Manufacturing defects are credited at full value; other returns may incur a restocking charge.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">6. Wallet & Credit</h2>
            <p>Wallet balances are maintained per company account and can be used for future orders. Credit facilities are available only upon admin approval and are subject to credit limits. Withdrawal requests are processed within 5-7 business days.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">7. Data Privacy</h2>
            <p>Business information shared during registration is used solely for trade operations and communication. We do not share your data with third parties without consent.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground text-base mb-2">8. Governing Law</h2>
            <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Mumbai, Maharashtra.</p>
          </section>
        </motion.div>
      </div>
    </AppShell>
  );
};

export default Terms;
