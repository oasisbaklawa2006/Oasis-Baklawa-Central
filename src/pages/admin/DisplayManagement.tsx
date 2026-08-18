import { useNavigate, NavLink } from "react-router-dom";
import { useState } from "react";
import { Monitor, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { lazy, Suspense } from "react";
import { APPVERSE_TV_SURFACES } from "@/lib/appverse/tvSurfaces";

const AssemblyTV = lazy(() => import("@/pages/admin/AssemblyTV"));
const DispatchTV = lazy(() => import("@/pages/admin/DispatchTV"));
const ReadyGoodsTV = lazy(() => import("@/pages/admin/ReadyGoodsTV"));

const Spin = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 size={20} className="animate-spin text-primary" />
  </div>
);

// Derived from the single tvSurfaces.ts registry rather than a second
// hardcoded list, so a taxonomy change (e.g. folding a role into another
// TV) only needs updating in one place. Assembly and Dispatch are excluded
// here since they're already shown as embedded preview tabs above.
const FACTORY_TVS = APPVERSE_TV_SURFACES.filter(
  (surface) => surface.key !== "assembly" && surface.key !== "dispatch",
).map((surface) => ({ to: surface.route, label: surface.label }));

const DisplayManagement = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("assembly");

  return (
    <div className="p-4 sm:p-6 max-w-full space-y-5">
      <div className="flex items-center gap-2">
        <Monitor size={20} className="text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-display tracking-tight text-foreground">
            Device & Display Management
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Operations TV walls and factory line displays — embedded previews and direct launch links.
          </p>
        </div>
      </div>

      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Operations TV Walls</h2>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="assembly" className="flex-1 gap-1">
              Assembly TV
              <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600">(Preview)</span>
            </TabsTrigger>
            <TabsTrigger value="dispatch" className="flex-1 gap-1">
              Dispatch TV
              <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600">(Preview)</span>
            </TabsTrigger>
            <TabsTrigger value="rgs" className="flex-1">RGS TV</TabsTrigger>
          </TabsList>
          <Suspense fallback={<Spin />}>
            <TabsContent value="assembly" className="mt-3"><AssemblyTV /></TabsContent>
            <TabsContent value="dispatch" className="mt-3"><DispatchTV /></TabsContent>
            <TabsContent value="rgs" className="mt-3"><ReadyGoodsTV /></TabsContent>
          </Suspense>
        </Tabs>
      </section>

      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Factory Line TVs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {FACTORY_TVS.map((tv) => (
            <button
              key={tv.to}
              onClick={() => navigate(tv.to)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <Monitor size={14} className="text-primary shrink-0" />
              <span className="text-sm text-foreground">{tv.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DisplayManagement;
