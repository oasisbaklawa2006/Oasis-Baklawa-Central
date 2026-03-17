import { Search, Bell, User, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logoOpen from "@/assets/logo-open.png";
import NotificationsPanel from "./NotificationsPanel";
import SearchOverlay from "./SearchOverlay";
import { supabase } from "@/integrations/supabase/client";

const TopNavBar = () => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/splash");
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card shadow-nav flex items-center justify-between px-6">
        <img src={logoOpen} alt="Oasis Baklawa" className="w-[105px] sm:w-[120px] object-contain" />
        <div className="flex items-center gap-5">
          <button onClick={() => setShowSearch(true)} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Search">
            <Search size={20} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-full hover:bg-muted transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={20} className="text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </button>
          <button onClick={() => navigate("/account")} className="w-9 h-9 rounded-full bg-primary flex items-center justify-center" aria-label="My Account">
            <User size={18} className="text-primary-foreground" />
          </button>
          <button onClick={handleSignOut} className="p-2 rounded-full hover:bg-destructive/10 transition-colors" aria-label="Sign Out">
            <LogOut size={18} className="text-muted-foreground" />
          </button>
        </div>
      </header>
      <NotificationsPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
      <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
};

export default TopNavBar;
