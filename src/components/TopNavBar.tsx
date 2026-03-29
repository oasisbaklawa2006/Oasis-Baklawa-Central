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

  // Fetch unread notification count
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

    // Subscribe to changes
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
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card shadow-nav flex items-center justify-between px-6">
        <img src={logoOpen} alt="Oasis Baklawa" className="h-8 sm:h-9 object-contain" />
        <div className="flex items-center gap-3">
          {/* Language Toggle Pill */}
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="relative flex items-center h-8 w-[68px] rounded-full border border-border bg-muted/60 p-0.5 transition-colors hover:border-primary/40"
            aria-label="Toggle language"
          >
            <span
              className={`absolute top-0.5 h-7 w-8 rounded-full bg-primary shadow-sm transition-transform duration-200 ${
                lang === "hi" ? "translate-x-[34px]" : "translate-x-0.5"
              }`}
            />
            <span className={`relative z-10 flex-1 text-center text-[11px] font-bold transition-colors ${lang === "en" ? "text-primary-foreground" : "text-muted-foreground"}`}>EN</span>
            <span className={`relative z-10 flex-1 text-center text-[11px] font-bold transition-colors ${lang === "hi" ? "text-primary-foreground" : "text-muted-foreground"}`}>HI</span>
          </button>

          {/* Currency Toggle Pill */}
          <button
            onClick={() => setCurrency(currency === "INR" ? "USD" : "INR")}
            className="relative flex items-center h-8 w-[68px] rounded-full border border-border bg-muted/60 p-0.5 transition-colors hover:border-primary/40"
            aria-label="Toggle currency"
          >
            <span
              className={`absolute top-0.5 h-7 w-8 rounded-full bg-primary shadow-sm transition-transform duration-200 ${
                currency === "USD" ? "translate-x-[34px]" : "translate-x-0.5"
              }`}
            />
            <span className={`relative z-10 flex-1 text-center text-[11px] font-bold transition-colors ${currency === "INR" ? "text-primary-foreground" : "text-muted-foreground"}`}>₹</span>
            <span className={`relative z-10 flex-1 text-center text-[11px] font-bold transition-colors ${currency === "USD" ? "text-primary-foreground" : "text-muted-foreground"}`}>$</span>
          </button>

          <button onClick={() => setShowSearch(true)} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Search">
            <Search size={20} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-full hover:bg-muted transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={20} className="text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
          {/* Avatar dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center"
              aria-label="My Account"
            >
              <User size={18} className="text-primary-foreground" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-12 w-44 bg-card rounded-xl shadow-card border border-border py-1 z-50">
                <button
                  onClick={() => { setShowMenu(false); navigate("/account"); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-ui text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <User size={14} /> {t("nav.myAccount")}
                </button>
                <div className="border-t border-border mx-2" />
                <button
                  onClick={() => { setShowMenu(false); handleSignOut(); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-ui text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2"
                >
                  <LogOut size={14} /> {t("nav.signOut")}
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
