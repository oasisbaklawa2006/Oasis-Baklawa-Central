import { MessageCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import SupportChat from "./SupportChat";

const FloatingActions = () => {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
      <div className="fixed z-40 flex flex-col gap-2" style={{ bottom: "76px", right: "14px", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <motion.a
          href="tel:+919999792959"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-primary/15"
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
          aria-label="Call Us"
        >
          <Phone size={14} className="text-primary" strokeWidth={1.5} />
        </motion.a>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowChat(!showChat)}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-primary/15"
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
          aria-label="AI Chat"
        >
          <MessageCircle size={14} className="text-primary" strokeWidth={1.5} />
        </motion.button>
      </div>
      <SupportChat open={showChat} onClose={() => setShowChat(false)} />
    </>
  );
};

export default FloatingActions;
