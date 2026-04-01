import { MessageCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import SupportChat from "./SupportChat";

const FloatingActions = () => {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
      <div className="fixed bottom-[88px] right-4 z-40 flex flex-col gap-2.5">
        <motion.a
          href="tel:+919999792959"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="w-10 h-10 rounded-full flex items-center justify-center border border-primary/20"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}
          aria-label="Call Us"
        >
          <Phone size={16} className="text-primary" strokeWidth={1.5} />
        </motion.a>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowChat(!showChat)}
          className="w-10 h-10 rounded-full flex items-center justify-center border border-primary/20"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}
          aria-label="AI Chat"
        >
          <MessageCircle size={16} className="text-primary" strokeWidth={1.5} />
        </motion.button>
      </div>
      <SupportChat open={showChat} onClose={() => setShowChat(false)} />
    </>
  );
};

export default FloatingActions;
