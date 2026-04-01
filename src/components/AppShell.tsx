import { useState, useEffect } from "react";
import TopNavBar from "./TopNavBar";
import BottomNavBar from "./BottomNavBar";
import FloatingActions from "./FloatingActions";
import SystemAlertBanner from "./SystemAlertBanner";
import BackButton from "./BackButton";
import { AlertTriangle, X } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

const ImpersonationBanner = () => {
  const [client, setClient] = useState<{ company_id: string; business_name: string } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("impersonated_client");
    if (raw) {
      try { setClient(JSON.parse(raw)); } catch { setClient(null); }
    }
  }, []);

  if (!client) return null;

  const handleExit = () => {
    localStorage.removeItem("impersonated_client");
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-3 text-sm font-bold shadow-lg">
      <AlertTriangle size={16} />
      <span>ORDERING ON BEHALF OF: {client.business_name}</span>
      <button
        onClick={handleExit}
        className="ml-4 px-3 py-1 bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-black/80"
      >
        <X size={12} /> Exit Impersonation
      </button>
    </div>
  );
};

const AppShell = ({ children }: AppShellProps) => {
  const [hasImpersonation, setHasImpersonation] = useState(false);

  useEffect(() => {
    setHasImpersonation(!!localStorage.getItem("impersonated_client"));
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ImpersonationBanner />
      <SystemAlertBanner />
      <TopNavBar />
      <main className={`${hasImpersonation ? "pt-[88px]" : "pt-14"} min-h-screen flex-1`}>
        <BackButton />
        {children}
      </main>
      <FloatingActions />
      <BottomNavBar />
    </div>
  );
};

export default AppShell;
