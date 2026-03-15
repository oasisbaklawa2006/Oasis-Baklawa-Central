import TopNavBar from "./TopNavBar";
import BottomNavBar from "./BottomNavBar";
import FloatingActions from "./FloatingActions";

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <main className="pt-16 pb-[72px] min-h-screen">
        {children}
      </main>
      <FloatingActions />
      <BottomNavBar />
    </div>
  );
};

export default AppShell;
