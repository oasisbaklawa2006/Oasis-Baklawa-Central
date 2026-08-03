export type AppVerseAppKey = "central" | "ai-studio" | "trace" | "buyer";

export type AppVerseAppDefinition = {
  key: AppVerseAppKey;
  label: string;
  description: string;
  surface: "internal" | "customer";
  status: "active" | "integration" | "customer";
  defaultPath?: string;
};

export const APPVERSE_APPS: AppVerseAppDefinition[] = [
  {
    key: "central",
    label: "Central",
    description: "Operational command, sales, finance, production, dispatch and governance.",
    surface: "internal",
    status: "active",
    defaultPath: "/admin",
  },
  {
    key: "ai-studio",
    label: "AI Studio",
    description: "Product truth, catalogue enrichment, media preparation and governed AI workflows.",
    surface: "internal",
    status: "integration",
  },
  {
    key: "trace",
    label: "Trace",
    description: "Physical traceability, scan evidence, carton flow and handover verification.",
    surface: "internal",
    status: "integration",
  },
  {
    key: "buyer",
    label: "Buyer App",
    description: "Customer-facing B2B catalogue, ordering, documents, tracking and account experience.",
    surface: "customer",
    status: "customer",
  },
];

export function getAppVerseApp(key: AppVerseAppKey) {
  return APPVERSE_APPS.find((app) => app.key === key);
}

export function getInternalApps() {
  return APPVERSE_APPS.filter((app) => app.surface === "internal");
}
