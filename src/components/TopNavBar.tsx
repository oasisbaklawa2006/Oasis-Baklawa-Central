import { Search, Bell, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logoOpen from "@/assets/logo-open.png";
import NotificationsPanel from "./NotificationsPanel";

const TopNavBar = () => {
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card shadow-nav flex items-center justify-between px-6">
        <img src={logoOpen} alt="Oasis Baklawa" className="h-14 w-auto" />
        <div className="flex items-center gap-5">
          <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Search">
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
          <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center" aria-label="My Account">
            <User size={18} className="text-primary-foreground" />
          </button>
        </div>
      </header>
      <NotificationsPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
    </>
  );
};

export default TopNavBar;
