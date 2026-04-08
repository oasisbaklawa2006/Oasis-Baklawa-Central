import TopNavBar from "@/components/TopNavBar";
import ThirdPartyDemandSection from "@/components/rgs/ThirdPartyDemandSection";
import ThirdPartyProcurementSection from "@/components/rgs/ThirdPartyProcurementSection";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, Zap } from "lucide-react";

export default function ThirdPartyStore() {
  return (
    <div className="min-h-screen bg-background pb-safe">
      <TopNavBar />
      <div className="pt-20 px-4 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">3rd Party Store (3PCS)</h1>
          <Badge variant="outline" className="text-xs">External Procurement</Badge>
        </div>

        <Tabs defaultValue="assembly_support" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="assembly_support" className="flex-1">
              <Zap size={14} className="mr-1" /> Urgent Assembly Support
            </TabsTrigger>
            <TabsTrigger value="general" className="flex-1">
              <Package size={14} className="mr-1" /> General Procurement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assembly_support">
            <ThirdPartyDemandSection />
          </TabsContent>

          <TabsContent value="general">
            <ThirdPartyProcurementSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
