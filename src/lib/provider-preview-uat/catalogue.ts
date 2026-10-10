/**
 * Governed provider-preview UAT targets (UAT-0122..0131).
 * Software-testable in Chromium where noted; scanner/camera acceptance stays physical.
 */

export type ProviderApp = "ai-studio" | "trace";

export type PhysicalGateKind = "scanner" | "camera" | null;

export type ProviderPreviewTarget = {
  uatId: string;
  app: ProviderApp;
  route: string;
  state: string;
  classification: string;
  persona: string;
  device: "desktop" | "phone" | "scanner";
  repo: string;
  baselineSha: string;
  physicalGate: PhysicalGateKind;
  notes?: string;
};

export const PROVIDER_PREVIEW_SECRET_BY_APP: Record<ProviderApp, string> = {
  "ai-studio": "TEST_AI_STUDIO_PREVIEW_URL",
  trace: "TEST_TRACE_PREVIEW_URL",
};

export const PROVIDER_PREVIEW_TARGETS: ProviderPreviewTarget[] = [
  {
    uatId: "UAT-0122",
    app: "ai-studio",
    route: "/",
    state: "default",
    classification: "ROUTED_COMPONENT",
    persona: "AI_CATALOGUE",
    device: "desktop",
    repo: "oasis-ai-studio",
    baselineSha: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
    physicalGate: null,
  },
  {
    uatId: "UAT-0123",
    app: "ai-studio",
    route: "/media",
    state: "default",
    classification: "ROUTED_COMPONENT",
    persona: "AI_CATALOGUE",
    device: "phone",
    repo: "oasis-ai-studio",
    baselineSha: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
    physicalGate: null,
  },
  {
    uatId: "UAT-0124",
    app: "ai-studio",
    route: "/media/review",
    state: "default",
    classification: "GOVERNANCE_DESK",
    persona: "AI_APPROVER",
    device: "desktop",
    repo: "oasis-ai-studio",
    baselineSha: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
    physicalGate: null,
  },
  {
    uatId: "UAT-0125",
    app: "ai-studio",
    route: "/products/new/fast",
    state: "default",
    classification: "ROUTED_COMPONENT",
    persona: "AI_CATALOGUE",
    device: "desktop",
    repo: "oasis-ai-studio",
    baselineSha: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
    physicalGate: null,
  },
  {
    uatId: "UAT-0126",
    app: "ai-studio",
    route: "/testing/pilot-readiness",
    state: "default",
    classification: "ROUTED_COMPONENT",
    persona: "AI_CATALOGUE",
    device: "desktop",
    repo: "oasis-ai-studio",
    baselineSha: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
    physicalGate: null,
  },
  {
    uatId: "UAT-0127",
    app: "ai-studio",
    route: "/media",
    state: "camera-capture-flow",
    classification: "INTERACTIVE_STATE",
    persona: "AI_CATALOGUE",
    device: "phone",
    repo: "oasis-ai-studio",
    baselineSha: "a373564acac6738a9f450201d8bf2c2b3a7c93a2",
    physicalGate: "camera",
    notes: "Point 41 physical camera UAT — preview deploy only",
  },
  {
    uatId: "UAT-0128",
    app: "trace",
    route: "/",
    state: "scan-home",
    classification: "SCANNER_FLOW",
    persona: "TRACE_SCANNER",
    device: "scanner",
    repo: "oasis-trace",
    baselineSha: "e395b77f115803ab998266fb7459744fd743110a",
    physicalGate: "scanner",
  },
  {
    uatId: "UAT-0129",
    app: "trace",
    route: "/scan",
    state: "gate-scan",
    classification: "SCANNER_FLOW",
    persona: "TRACE_SCANNER",
    device: "scanner",
    repo: "oasis-trace",
    baselineSha: "e395b77f115803ab998266fb7459744fd743110a",
    physicalGate: "scanner",
  },
  {
    uatId: "UAT-0130",
    app: "trace",
    route: "/scan",
    state: "carton-scan",
    classification: "SCANNER_FLOW",
    persona: "TRACE_SCANNER",
    device: "scanner",
    repo: "oasis-trace",
    baselineSha: "e395b77f115803ab998266fb7459744fd743110a",
    physicalGate: "scanner",
  },
  {
    uatId: "UAT-0131",
    app: "trace",
    route: "/scan",
    state: "offline-queue",
    classification: "SCANNER_FLOW",
    persona: "TRACE_SCANNER",
    device: "scanner",
    repo: "oasis-trace",
    baselineSha: "e395b77f115803ab998266fb7459744fd743110a",
    physicalGate: "scanner",
  },
];

export const PROVIDER_PREVIEW_TRANCHE = "provider-preview";

export function targetsForTranche(
  tranche: "ai-studio" | "trace" | "all",
): ProviderPreviewTarget[] {
  if (tranche === "all") return [...PROVIDER_PREVIEW_TARGETS];
  const app = tranche === "ai-studio" ? "ai-studio" : "trace";
  return PROVIDER_PREVIEW_TARGETS.filter((t) => t.app === app);
}
