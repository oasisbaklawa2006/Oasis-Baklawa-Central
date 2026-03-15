import { MessageCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";

const FloatingActions = () => {
  return (
    <div className="fixed bottom-24 right-5 z-40 flex flex-col gap-3">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-full bg-primary shadow-fab flex items-center justify-center"
        aria-label="Contact"
      >
        <Phone size={20} className="text-primary-foreground" />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full bg-foreground shadow-fab flex items-center justify-center"
        aria-label="AI Chat"
      >
        <MessageCircle size={24} className="text-card" />
      </motion.button>
    </div>
  );
};

export default FloatingActions;
