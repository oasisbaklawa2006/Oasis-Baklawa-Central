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
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="w-12 h-12 rounded-full bg-primary/80 shadow-lg flex items-center justify-center"
          aria-label="Call Us"
        >
          <Phone size={20} className="text-primary-foreground" />
        </motion.a>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowChat(!showChat)}
          className="w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center"
          aria-label="AI Chat"
        >
          <MessageCircle size={20} className="text-primary-foreground" />
        </motion.button>
      </div>
      <SupportChat open={showChat} onClose={() => setShowChat(false)} />
    </>
  );
};

export default FloatingActions;
