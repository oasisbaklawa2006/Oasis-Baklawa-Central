import { Mic, Camera, StickyNote, FileText, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import AIOrderReview from "./AIOrderReview";

const actions = [
  { icon: Mic, label: "Voice" },
  { icon: Camera, label: "Photo" },
  { icon: StickyNote, label: "Note" },
  { icon: FileText, label: "PO Doc" },
  { icon: MessageCircle, label: "WhatsApp" },
];

const AIOrderUpload = () => {
  const [showReview, setShowReview] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-card rounded-2xl shadow-card p-8"
      >
        <h2 className="font-display text-xl md:text-2xl tracking-wide text-foreground mb-6">
          Quick Order via AI
        </h2>
        <div className="flex items-center justify-between gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => setShowReview(true)}
              className="flex flex-col items-center gap-2.5 group flex-1"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center transition-all group-hover:bg-primary/10 group-hover:scale-105">
                <action.icon size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs font-body font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <AIOrderReview open={showReview} onClose={() => setShowReview(false)} />
    </>
  );
};

export default AIOrderUpload;
