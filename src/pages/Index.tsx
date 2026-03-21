import AppShell from "@/components/AppShell";
import AIOrderUpload from "@/components/home/AIOrderUpload";
import SmartReorder from "@/components/home/SmartReorder";
import BestSellers from "@/components/home/BestSellers";
import PromoBanner from "@/components/home/PromoBanner";

const Index = () => {
  return (
    <AppShell>
      <div className="px-5 py-6 space-y-7 max-w-3xl mx-auto">
        {/* Greeting */}
        <div className="pt-2">
          <p className="font-body text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="font-display text-2xl md:text-3xl tracking-wide text-foreground mt-1">
            Oasis Baklawa
          </h1>
        </div>

        <AIOrderUpload />
        <SmartReorder />
        <BestSellers />
        <PromoBanner />
      </div>
    </AppShell>
  );
};

export default Index;
