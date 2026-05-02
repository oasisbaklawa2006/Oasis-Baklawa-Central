import { lazy, Suspense, useState } from "react";
import TopNavBar from "@/components/TopNavBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const AssemblyManagement = lazy(() => import("@/pages/admin/AssemblyManagement"));
const ReadyGoodsStore = lazy(() => import("@/pages/admin/ReadyGoodsStore"));
const DispatchManagement = lazy(() => import("@/pages/admin/DispatchManagement"));
const AdminInventory = lazy(() => import("@/pages/admin/AdminInventory"));
const OrderManagement = lazy(() => import("@/pages/admin/OrderManagement"));

const Spin = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 size={20} className="animate-spin text-primary" />
  </div>
);

const AdminProduction = () => {
  const [tab, setTab] = useState("queue");
  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <div className="px-4 sm:px-6 py-4 max-w-full">
        <h1 className="text-xl sm:text-2xl font-display tracking-tight text-foreground mb-4">
          Production Management
        </h1>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="queue" className="flex-1 min-w-[120px]">Production Queue</TabsTrigger>
            <TabsTrigger value="routing" className="flex-1 min-w-[120px]">Material Routing</TabsTrigger>
            <TabsTrigger value="ready" className="flex-1 min-w-[120px]">Ready Goods</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1 min-w-[120px]">Physical Inventory</TabsTrigger>
            <TabsTrigger value="dispatch" className="flex-1 min-w-[120px]">Dispatch</TabsTrigger>
          </TabsList>
          <Suspense fallback={<Spin />}>
            <TabsContent value="queue" className="mt-4"><OrderManagement /></TabsContent>
            <TabsContent value="routing" className="mt-4"><AssemblyManagement /></TabsContent>
            <TabsContent value="ready" className="mt-4"><ReadyGoodsStore /></TabsContent>
            <TabsContent value="inventory" className="mt-4"><AdminInventory /></TabsContent>
            <TabsContent value="dispatch" className="mt-4"><DispatchManagement /></TabsContent>
          </Suspense>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminProduction;
