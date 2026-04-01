import { Search, Bell, User, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoOpen from "@/assets/logo-open.png";
import NotificationsPanel from "./NotificationsPanel";
import SearchOverlay from "./SearchOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";

const TopNavBar = () => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/splash");
  };

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel("notif-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        fetchUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-card/90 backdrop-blur-md flex items-center justify-between px-5 border-b border-border/60">
        <img src={logoOpen} alt="Oasis Baklawa" className="h-7 sm:h-8 object-contain" />
        <div className="flex items-center gap-2.5">
          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="relative flex items-center h-7 w-[60px] rounded-full border border-primary/25 bg-background p-0.5 transition-colors hover:border-primary/50"
            aria-label="Toggle language"
          >
            <span
              className={`absolute top-0.5 h-6 w-7 rounded-full bg-primary/15 border border-primary/30 transition-transform duration-200 ${
                lang === "hi" ? "translate-x-[29px]" : "translate-x-0.5"
              }`}
            />
            <span className={`relative z-10 flex-1 text-center text-[10px] font-medium transition-colors ${lang === "en" ? "text-primary" : "text-muted-foreground"}`}>EN</span>
            <span className={`relative z-10 flex-1 text-center text-[10px] font-medium transition-colors ${lang === "hi" ? "text-primary" : "text-muted-foreground"}`}>HI</span>
          </button>

          {/* Currency Toggle */}
          <button
            onClick={() => setCurrency(currency === "INR" ? "USD" : "INR")}
            className="relative flex items-center h-7 w-[60px] rounded-full border border-primary/25 bg-background p-0.5 transition-colors hover:border-primary/50"
            aria-label="Toggle currency"
          >
            <span
              className={`absolute top-0.5 h-6 w-7 rounded-full bg-primary/15 border border-primary/30 transition-transform duration-200 ${
                currency === "USD" ? "translate-x-[29px]" : "translate-x-0.5"
              }`}
            />
            <span className={`relative z-10 flex-1 text-center text-[10px] font-medium transition-colors ${currency === "INR" ? "text-primary" : "text-muted-foreground"}`}>₹</span>
            <span className={`relative z-10 flex-1 text-center text-[10px] font-medium transition-colors ${currency === "USD" ? "text-primary" : "text-muted-foreground"}`}>$</span>
          </button>

          <button onClick={() => setShowSearch(true)} className="p-2 rounded-full hover:bg-primary/5 transition-colors" aria-label="Search">
            <Search size={18} className="text-muted-foreground" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-full hover:bg-primary/5 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-muted-foreground" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
            )}
          </button>
          {/* Avatar dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center"
              aria-label="My Account"
            >
              <User size={15} className="text-primary" strokeWidth={1.5} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-11 w-44 bg-card rounded-xl shadow-card border border-border py-1 z-50">
                <button
                  onClick={() => { setShowMenu(false); navigate("/account"); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-ui text-foreground hover:bg-primary/5 transition-colors flex items-center gap-2"
                >
                  <User size={13} strokeWidth={1.5} /> {t("nav.myAccount")}
                </button>
                <div className="border-t border-border mx-3" />
                <button
                  onClick={() => { setShowMenu(false); handleSignOut(); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-ui text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2"
                >
                  <LogOut size={13} strokeWidth={1.5} /> {t("nav.signOut")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <NotificationsPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
      <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
};

export default TopNavBar;
