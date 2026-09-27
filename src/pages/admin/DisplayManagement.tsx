import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Monitor, Loader2, Tv, Copy, Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { lazy, Suspense } from "react";
import { APPVERSE_TV_SURFACES } from "@/lib/appverse/tvSurfaces";
import {
  OASIS_DISPLAY_SURFACES,
  buildDisplayAssignmentIntentCommand,
  buildDisplayAssignmentPayload,
} from "@/lib/displayDevice/displayAssignmentContract";
import { assignDisplayDevice } from "@/lib/displayDevice/displayDeviceAdmin";

const AssemblyTV = lazy(() => import("@/pages/admin/AssemblyTV"));
const DispatchTV = lazy(() => import("@/pages/admin/DispatchTV"));
const ReadyGoodsTV = lazy(() => import("@/pages/admin/ReadyGoodsTV"));

const Spin = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 size={20} className="animate-spin text-primary" />
  </div>
);

const FACTORY_TVS = APPVERSE_TV_SURFACES.filter(
  (surface) => surface.key !== "assembly" && surface.key !== "dispatch",
).map((surface) => ({ to: surface.route, label: surface.label }));

const DisplayManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState("assembly");
  const [enrollCode, setEnrollCode] = useState(searchParams.get("enrollCode") ?? "");
  const [deviceId, setDeviceId] = useState(searchParams.get("deviceId") ?? "");
  const [surfaceKey, setSurfaceKey] = useState("ready-goods");
  const [friendlyName, setFriendlyName] = useState("");
  const [location, setLocation] = useState("");
  const [copied, setCopied] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);

  const assignmentPayload = useMemo(
    () => buildDisplayAssignmentPayload({ surfaceKey, friendlyName: friendlyName || undefined, location: location || undefined }),
    [surfaceKey, friendlyName, location],
  );

  const provisioningCommand = useMemo(
    () => buildDisplayAssignmentIntentCommand(assignmentPayload),
    [assignmentPayload],
  );

  const copyCommand = async () => {
    await navigator.clipboard.writeText(provisioningCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const assignRemotely = async () => {
    if (!deviceId.trim() || !enrollCode.trim()) {
      setRemoteStatus("Device ID and enrollment code are required for remote assignment.");
      return;
    }
    setAssigning(true);
    setRemoteStatus(null);
    try {
      await assignDisplayDevice({
        deviceId,
        enrollmentCode: enrollCode,
        surfaceKey,
        friendlyName: friendlyName || undefined,
        location: location || undefined,
      });
      setRemoteStatus("Remote assignment saved. The TV will pick it up on its next config refresh.");
    } catch (error) {
      setRemoteStatus(error instanceof Error ? error.message : "Remote assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-full space-y-5">
      <div className="flex items-center gap-2">
        <Monitor size={20} className="text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-display tracking-tight text-foreground">
            Device & Display Management
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Operations TV walls, Oasis Display APK enrollment, and governed surface assignment.
          </p>
        </div>
      </div>

      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Tv size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Oasis Display APK — TV enrollment</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          TVs show an enrollment code on first launch. Assign a governed read-only surface remotely; the ADB command remains an explicit fallback for commissioning and recovery.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground">Enrollment code (from TV)</label>
            <Input value={enrollCode} onChange={(e) => setEnrollCode(e.target.value.toUpperCase())} placeholder="AB12CD34" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Device ID (optional cross-check)</label>
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="tv-..." />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Assigned surface</label>
            <select
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={surfaceKey}
              onChange={(e) => setSurfaceKey(e.target.value)}
            >
              {OASIS_DISPLAY_SURFACES.map((surface) => (
                <option key={surface.key} value={surface.key}>
                  {surface.label}
                  {surface.certification === "preview" ? " (Preview — not production-certified)" : ""}
                  {surface.origin === "trace" ? " [Trace origin]" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Friendly name</label>
            <Input value={friendlyName} onChange={(e) => setFriendlyName(e.target.value)} placeholder="FACTORY-RGS-TV-01" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] text-muted-foreground">Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ready Goods Store — Wall 1" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void assignRemotely()}
            disabled={assigning || !deviceId.trim() || !enrollCode.trim()}
          >
            {assigning ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
            Assign remotely
          </Button>
          {remoteStatus ? (
            <p className="text-[11px] text-muted-foreground self-center">{remoteStatus}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[11px] font-semibold text-foreground mb-2">Provisioning fallback (ADB)</p>
          <pre className="text-[10px] whitespace-pre-wrap break-all font-mono text-muted-foreground">{provisioningCommand}</pre>
          <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => void copyCommand()}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy command"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Remote assignment API: `{`GET ${"{bootstrap}"}/v1/devices/{deviceId}/assignment`}` — Task 4 Central dependency. PREVIEW surfaces load in the shell but must not be certified as production-ready.
        </p>
      </section>

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
