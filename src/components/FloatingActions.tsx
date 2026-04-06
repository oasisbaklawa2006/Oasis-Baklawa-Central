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
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-primary/15"
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
          aria-label="Request Callback"
        >
          <Phone size={13} className="text-primary" strokeWidth={1.5} />
          <span className="text-[8px] font-bold text-primary tracking-wider uppercase">Callback</span>
        </motion.a>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowChat(!showChat)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-primary/15"
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
          aria-label="Smart AI Chat"
        >
          <MessageCircle size={13} className="text-primary" strokeWidth={1.5} />
          <span className="text-[8px] font-bold text-primary tracking-wider uppercase">AI Chat</span>
        </motion.button>
      </div>
      <SupportChat open={showChat} onClose={() => setShowChat(false)} />
    </>
  );
};

export default FloatingActions;
