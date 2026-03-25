import TopNavBar from "./TopNavBar";
import BottomNavBar from "./BottomNavBar";
import FloatingActions from "./FloatingActions";
import SystemAlertBanner from "./SystemAlertBanner";
import BackButton from "./BackButton";

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemAlertBanner />
      <TopNavBar />
      <main className="pt-24 pb-[72px] min-h-screen flex-1">
        <BackButton />
        {children}
      </main>
      <FloatingActions />
      <BottomNavBar />
    </div>
  );
};

export default AppShell;
