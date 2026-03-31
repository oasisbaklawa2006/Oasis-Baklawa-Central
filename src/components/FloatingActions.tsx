import { MessageCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import SupportChat from "./SupportChat";

const FloatingActions = () => {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
      <div className="fixed bottom-[100px] right-5 z-40 flex flex-col gap-3">
        <motion.a
          href="tel:+919999792959"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            border: "1px solid rgba(255,255,255,0.5)",
          }}
          aria-label="Call Us"
        >
          <Phone size={18} className="text-primary" />
        </motion.a>
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowChat(!showChat)}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            border: "1px solid rgba(255,255,255,0.5)",
          }}
          aria-label="AI Chat"
        >
          <MessageCircle size={18} className="text-primary" />
        </motion.button>
      </div>
      <SupportChat open={showChat} onClose={() => setShowChat(false)} />
    </>
  );
};

export default FloatingActions;
