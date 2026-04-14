import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import announcementFallback from "@/assets/hero-luxury.jpg";

const PRIORITY_ORDER = ["critical", "offer", "launch", "greeting"];
const SESSION_KEY = "oasis_announcement_shown";
const DISMISS_TODAY_KEY = "oasis_ann_dismiss_date";

interface Announcement {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  video_url: string | null;
  priority: string;
  display_duration: number;
  trigger_delay: number;
  cta_text: string | null;
  cta_link: string | null;
}

const PremiumAnnouncementOverlay = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const trackedRef = useRef(false);

  const trackEvent = useCallback(async (annId: string, counter: string) => {
    try {
      await supabase.rpc("increment_announcement_counter", {
        ann_id: annId,
        counter_name: counter,
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;

    // BUYER-ONLY: Only show on buyer dashboard/home routes, never on admin
    const isBuyerRoute = ["/dashboard", "/home", "/catalogue"].some(r => location.pathname.startsWith(r)) || location.pathname === "/";
    if (!isBuyerRoute || location.pathname.startsWith("/admin")) return;
    // Session check
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // "Don't show today" check
    const dismissDate = localStorage.getItem(DISMISS_TODAY_KEY);
    if (dismissDate === new Date().toISOString().slice(0, 10)) return;

    const fetchAnnouncement = async () => {
      const { data } = await supabase
        .from("premium_announcements")
        .select("id, title, subtitle, image_url, video_url, priority, display_duration, trigger_delay, cta_text, cta_link")
        .eq("is_active", true)
        .lte("start_date", new Date().toISOString())
        .order("priority", { ascending: true });

      if (!data || data.length === 0) return;

      // Sort by priority hierarchy
      const sorted = [...data].sort(
        (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
      );
      const top = sorted[0];

      // Trigger delay
      setTimeout(() => {
        setAnnouncement(top);
        setCountdown(top.display_duration);
        setVisible(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }, (top.trigger_delay ?? 10) * 1000);
    };

    fetchAnnouncement();
  }, [user]);

  // Countdown timer
  useEffect(() => {
    if (!visible || !announcement) return;

    // Track view
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackEvent(announcement.id, "view");
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          trackEvent(announcement.id, "completion");
          setVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [visible, announcement, trackEvent]);

  const handleSkip = () => {
    clearInterval(timerRef.current);
    if (announcement) trackEvent(announcement.id, "skip");
    if (dontShowToday) {
      localStorage.setItem(DISMISS_TODAY_KEY, new Date().toISOString().slice(0, 10));
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && announcement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative w-[90vw] max-w-lg bg-card rounded-2xl overflow-hidden border border-border"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}
          >
            {/* Media */}
            {announcement.video_url && !videoFailed ? (
              <video
                src={announcement.video_url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full aspect-[16/10] object-cover"
                onError={() => setVideoFailed(true)}
                poster={announcement.image_url || announcementFallback}
              />
            ) : announcement.image_url ? (
              <img
                src={announcement.image_url}
                alt={announcement.title}
                className="w-full aspect-[16/10] object-cover"
              />
            ) : (
              <img
                src={announcementFallback}
                alt="Oasis Baklawa"
                className="w-full aspect-[16/10] object-cover"
              />
            )}

            {/* Content */}
            <div className="p-6 space-y-3 text-center">
              <h2
                className="font-display text-xl tracking-wide text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {announcement.title}
              </h2>
              {announcement.subtitle && (
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {announcement.subtitle}
                </p>
              )}

              {announcement.cta_text && announcement.cta_link && (
                <a
                  href={announcement.cta_link}
                  className="inline-block mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: "linear-gradient(135deg, #c58b07, #d4a843)",
                    color: "#fff",
                  }}
                >
                  {announcement.cta_text}
                </a>
              )}
            </div>

            {/* Footer controls */}
            <div className="px-6 pb-5 space-y-3">
              {/* Countdown */}
              <div className="flex items-center justify-center gap-2">
                <div
                  className="text-xs font-semibold tracking-wider"
                  style={{ color: "#c58b07" }}
                >
                  Ad ends in {countdown}s
                </div>
                <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#c58b07" }}
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{
                      duration: announcement.display_duration,
                      ease: "linear",
                    }}
                  />
                </div>
              </div>

              {/* Skip button */}
              <button
                onClick={handleSkip}
                className="w-full py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all border"
                style={{
                  borderColor: "#c58b07",
                  color: "#c58b07",
                }}
              >
                Continue to Dashboard
              </button>

              {/* Don't show today */}
              <label className="flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowToday}
                  onChange={(e) => setDontShowToday(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#c58b07]"
                />
                <span className="text-[10px] text-muted-foreground">
                  Do not show again today
                </span>
              </label>
            </div>

            {/* Close X */}
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumAnnouncementOverlay;
