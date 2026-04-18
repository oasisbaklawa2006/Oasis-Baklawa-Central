import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Sparkles, Loader2, Phone, MessageCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "Hello! I'm **Oasis Assistant** — your AI concierge for Oasis Baklawa B2B. Ask me about shelf life, MOQ rules, Starter Packs, or anything else.",
  },
];

interface SupportChatProps {
  open: boolean;
  onClose: () => void;
}

const SupportChat = ({ open, onClose }: SupportChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const logCallback = async (channel: "phone" | "whatsapp") => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action_type: "callback_request",
      module_name: "support_chat",
      actor_id: user?.id ?? null,
      entity_name: channel,
      reason: `Buyer requested ${channel} callback from support chat`,
      risk_level: "normal",
    });
    toast.success(`${channel === "phone" ? "Call" : "WhatsApp"} request logged. Our team will reach out shortly.`);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { id: Date.now(), role: "user", text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantId = Date.now() + 1;
    setMessages((p) => [...p, { id: assistantId, role: "assistant", text: "" }]);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/oasis-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ messages: history }),
        }
      );

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Chat error ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((p) =>
                p.map((m) => (m.id === assistantId ? { ...m, text: acc } : m))
              );
            }
          } catch {}
        }
      }
    } catch (e) {
      setMessages((p) =>
        p.map((m) =>
          m.id === assistantId
            ? { ...m, text: `Sorry — I had trouble responding. ${(e as Error).message}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
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
          style={{ height: "min(560px, calc(100vh - 160px))" }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-border/50">
            <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center">
              <Bot size={18} className="text-card" />
            </div>
            <div className="flex-1">
              <h3 className="font-body font-bold text-foreground text-sm">Oasis Assistant</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-body text-[11px] text-green-600 font-medium">
                  {streaming ? "Thinking…" : "Online · Powered by Gemini"}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
              <X size={14} className="text-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl font-body text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/70 text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" && msg.text === "" ? (
                    <Loader2 size={14} className="animate-spin text-primary" />
                  ) : (
                    <>
                      {msg.role === "assistant" && (
                        <Sparkles size={12} className="text-primary inline mr-1.5 -mt-0.5" />
                      )}
                      {msg.text}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Callback row */}
          <div className="px-4 py-2 border-t border-border/50 flex gap-2">
            <button
              onClick={() => logCallback("phone")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-muted/40 text-foreground text-[11px] font-semibold hover:bg-muted transition"
            >
              <Phone size={12} /> Call Us
            </button>
            <button
              onClick={() => logCallback("whatsapp")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold hover:bg-green-100 transition"
            >
              <MessageCircle size={12} /> WhatsApp
            </button>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border/50">
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={streaming ? "Oasis is replying…" : "Ask about shelf life, MOQ, Starter Packs…"}
                disabled={streaming}
                className="flex-1 bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {streaming ? (
                  <Loader2 size={14} className="text-primary-foreground animate-spin" />
                ) : (
                  <Send size={14} className="text-primary-foreground" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SupportChat;
