import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_ITEMS = [
  { q: "What is the minimum order quantity (MOQ)?", a: "MOQ varies by product category. Bulk sweets require a minimum of 5kg, ready packs require 9 packs per carton, and premium gift boxes have category-specific minimums. Check the cart for real-time MOQ validation." },
  { q: "How does the 20% advance payment work?", a: "Once you confirm your order, a 20% advance (rounded to the nearest ₹1,000) is required to begin production. The remaining balance is due before dispatch." },
  { q: "What payment methods are accepted?", a: "We accept UPI, NEFT/RTGS bank transfers, and wallet balance. All payments are verified by our finance team before production begins." },
  { q: "How long does production take?", a: "Standard production takes 3-5 working days from advance confirmation. Estimated dispatch dates are shown in your cart and order tracker." },
  { q: "Can I modify my order after placing it?", a: "Orders can only be modified while in 'Draft' status. Once submitted and advance is paid, the order is locked for production." },
  { q: "How do I track my order?", a: "Use the 'My Orders' section to view real-time status updates through our 10-point tracking timeline: Placed → Confirmed → Manufacturing → Assembly → Packing → Invoice → Dispatched → In Transit → Delivered → Support." },
  { q: "What is the support window after delivery?", a: "You have a 10-day support window after dispatch to raise any quality complaints or return requests." },
  { q: "How do I become a registered B2B partner?", a: "Register through our onboarding form with your GST number and business details. Our team reviews applications within 24-48 hours." },
];

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-5 py-6 pt-24 pb-32">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-display text-2xl font-bold tracking-wide text-foreground">
            Frequently Asked Questions
          </h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border border-border px-4">
                <AccordionTrigger className="text-sm font-semibold text-foreground text-left py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </AppShell>
  );
};

export default FAQ;
