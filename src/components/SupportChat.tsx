import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Paperclip, Bot, Sparkles } from "lucide-react";
import { useState } from "react";

interface ChatMessage {
  id: number;
  role: "ai" | "user";
  text: string;
}

const initialMessages: ChatMessage[] = [
  { id: 1, role: "ai", text: "Hello! How can I assist you with your Oasis Baklawa B2B orders today?" },
  { id: 2, role: "user", text: "I need help understanding the Category C MOQ rules." },
  { id: 3, role: "ai", text: "Certainly! Category C cartons require exactly 9 packs. Any single variant you choose must have a minimum of 3 packs. Therefore, valid combinations include 3+3+3, 6+3, 4+5, or 9 of a single variant." },
];

interface SupportChatProps {
  open: boolean;
  onClose: () => void;
}

const SupportChat = ({ open, onClose }: SupportChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: Date.now(), role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    // Simulate AI reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "ai", text: "Thank you for your question! Let me look into that for you. Is there anything specific about your order you'd like to know?" },
      ]);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-24 right-5 z-[90] w-[340px] max-w-[calc(100vw-40px)] bg-card rounded-3xl shadow-card overflow-hidden flex flex-col"
          style={{ height: "min(520px, calc(100vh - 160px))" }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-border/50">
            <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center">
              <Bot size={18} className="text-card" />
            </div>
            <div className="flex-1">
              <h3 className="font-body font-bold text-foreground text-sm">Oasis AI Assistant</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-body text-[11px] text-green-600 font-medium">Online</span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
              <X size={14} className="text-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl font-body text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/70 text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "ai" && (
                    <Sparkles size={12} className="text-primary inline mr-1.5 -mt-0.5" />
                  )}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border/50">
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip size={16} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={handleSend}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                <Send size={14} className="text-primary-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SupportChat;
