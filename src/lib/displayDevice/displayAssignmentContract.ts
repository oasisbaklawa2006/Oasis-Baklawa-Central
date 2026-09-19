export type DisplaySurfaceCertification = "canonical" | "preview" | "external_trace";

export type DisplayWebOrigin = "central" | "trace";

export type DisplaySurfaceDefinition = {
  key: string;
  label: string;
  route: string;
  origin: DisplayWebOrigin;
  certification: DisplaySurfaceCertification;
  legacyDepartmentCode?: string;
};

/** Single APK catalog — keep aligned with android-tv DisplaySurfaceRegistry.kt */
export const OASIS_DISPLAY_SURFACES: DisplaySurfaceDefinition[] = [
  { key: "arabic-sweets", label: "Arabic Sweets Line", route: "/tv/arabic-sweets", origin: "central", certification: "canonical", legacyDepartmentCode: "ARABIC_SWEETS" },
  { key: "chocolate", label: "Chocolate Line", route: "/tv/chocolate", origin: "central", certification: "canonical", legacyDepartmentCode: "CHOCOLATES_CONFECTIONERY" },
  { key: "fusion", label: "Fusion Sweets Line", route: "/tv/fusion", origin: "central", certification: "canonical", legacyDepartmentCode: "FUSION_SWEETS" },
  { key: "nuts", label: "Nuts & Dry Fruits Line", route: "/tv/nuts", origin: "central", certification: "canonical", legacyDepartmentCode: "SEASONED_NUTS_MIXES" },
  { key: "bakery", label: "Bakery Line", route: "/tv/bakery", origin: "central", certification: "canonical", legacyDepartmentCode: "BAKERY" },
  { key: "ready-goods", label: "Ready Goods Store TV", route: "/tv/rgs", origin: "central", certification: "canonical", legacyDepartmentCode: "RGS" },
  { key: "third-party", label: "Third Party Goods Store TV", route: "/tv/3pgs", origin: "central", certification: "canonical" },
  { key: "assembly", label: "Assembly TV", route: "/admin/assembly-tv", origin: "central", certification: "preview" },
  { key: "dispatch-central", label: "Dispatch TV (Central)", route: "/admin/dispatch-tv", origin: "central", certification: "preview" },
  { key: "trace-gate", label: "Trace Gate Display", route: "/tv/gate", origin: "trace", certification: "external_trace" },
  { key: "trace-dispatch", label: "Trace Dispatch Display", route: "/tv/dispatch", origin: "trace", certification: "external_trace" },
];

export type DisplayAssignmentV1 = {
  v: 1;
  surfaceKey: string;
  friendlyName?: string;
  location?: string;
  configVersion: number;
  assignedAtEpochMs: number;
};

export function buildDisplayAssignmentPayload(input: {
  surfaceKey: string;
  friendlyName?: string;
  location?: string;
  configVersion?: number;
}): DisplayAssignmentV1 {
  return {
    v: 1,
    surfaceKey: input.surfaceKey,
    friendlyName: input.friendlyName,
    location: input.location,
    configVersion: input.configVersion ?? Date.now(),
    assignedAtEpochMs: Date.now(),
  };
}

export function buildDisplayAssignmentIntentCommand(payload: DisplayAssignmentV1): string {
  const json = JSON.stringify(payload);
  return `adb shell am start -n com.oasisbaklawa.centraltv/.ui.MainActivity --es oasis_display_assignment '${json.replace(/'/g, "'\\''")}'`;
}

export function findDisplaySurface(key: string): DisplaySurfaceDefinition | undefined {
  return OASIS_DISPLAY_SURFACES.find((surface) => surface.key === key);
}

/** Remote config contract (Central Task 4 — not implemented server-side in this PR). */
export const DISPLAY_CONFIG_API_CONTRACT = {
  bootstrapPath: "/v1/devices/{deviceId}/assignment",
  methods: ["GET"],
  auth: "display-device read token (Task 4)",
  failClosed: true,
} as const;
