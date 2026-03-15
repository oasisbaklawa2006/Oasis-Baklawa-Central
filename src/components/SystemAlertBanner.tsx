import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SystemAlertBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-primary/15 border-b border-primary/20 overflow-hidden"
        >
          <div className="flex items-center gap-3 px-5 py-2.5">
            <AlertTriangle size={14} className="text-primary flex-shrink-0" />
            <p className="font-body text-xs text-foreground flex-1 leading-relaxed">
              <span className="font-semibold">Notice:</span> Production times are currently extended by 48 hours due to the upcoming festive season.
            </p>
            <button
              onClick={() => setDismissed(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={12} className="text-foreground" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SystemAlertBanner;
