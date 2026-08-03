import type { AppVerseGrantedModule, AppVerseModuleKey } from "./roleAccess";

export type AppVerseWave1Key =
  | "orders-finance"
  | "operations-production"
  | "whatsapp-support";

export type AppVerseWave1Area = {
  key: AppVerseWave1Key;
  label: string;
  description: string;
  landingPath: string;
  moduleKeys: AppVerseModuleKey[];
  primaryAction: string;
};

export const APPVERSE_WAVE1_AREAS: AppVerseWave1Area[] = [
  {
    key: "orders-finance",
    label: "Orders & Finance",
    description: "Commercial release, payment attention, order exceptions and finance-controlled progression.",
    landingPath: "/admin/order-management",
    moduleKeys: ["orders", "finance", "accounts", "finance_audit"],
    primaryAction: "Open order and finance work",
  },
  {
    key: "operations-production",
    label: "Operations & Production",
    description: "Execution queues, production demand, inventory blockers, ready goods and dispatch preparation.",
    landingPath: "/admin/execution-command-center",
    moduleKeys: ["cmd_war_room", "production", "inventory", "packing", "dispatch"],
    primaryAction: "Open operations command",
  },
  {
    key: "whatsapp-support",
    label: "WhatsApp & Support",
    description: "Inbound business communication, customer cases, exceptions and accountable follow-up.",
    landingPath: "/admin/operator-inbox",
    moduleKeys: ["support", "exceptions", "clients", "orders"],
    primaryAction: "Open customer attention",
  },
];

export function getVisibleWave1Areas(allowedModules: readonly AppVerseGrantedModule[]) {
  if (allowedModules.includes("*")) return APPVERSE_WAVE1_AREAS;
  return APPVERSE_WAVE1_AREAS.filter((area) =>
    area.moduleKeys.some((moduleKey) => allowedModules.includes(moduleKey)),
  );
}
