/**
 * Machine-readable census of Central realtime / live-refresh surfaces (Point23).
 * Transport audit only — does not assert runtime enablement (realtime globally disabled).
 */
export const CENTRAL_REALTIME_CENSUS = {
  baseSha: "64a107dfc167be76673a3d18f177a72472dcb241",
  globalKillSwitch: {
    file: "src/hooks/useRealtime.ts",
    enabled: false,
  },
  postgresChangesSubscriptions: [
    { file: "src/hooks/useAdminRealtimeToasts.ts", channel: "admin-global-toasts", scope: "global_staff", tables: ["orders", "b2b_applications"] },
    { file: "src/hooks/useApplicationBadge.ts", channel: "admin-b2b-applications", scope: "global_staff", tables: ["b2b_applications"] },
    { file: "src/components/TopNavBar.tsx", channel: "central:notifications:user:{userId}", scope: "user", tables: ["notifications"], migrated: "useScopedRealtimeSubscription" },
    { file: "src/components/NotificationsPanel.tsx", channel: "outbox-live-{userId}", scope: "user (client filter)", tables: ["notification_outbox"] },
    { file: "src/pages/admin/CMDWarRoom.tsx", channels: ["warroom-orders-live", "warroom-companies-live", "warroom-items-live"], scope: "global_staff", tables: ["orders", "companies", "order_items"] },
    { file: "src/pages/admin/AdminDashboard.tsx", channel: "governance-rt", scope: "global_staff", tables: ["orders", "b2b_applications", "audit_logs", "factory_inventory"] },
    { file: "src/pages/admin/OrderManagement.tsx", channel: "order-mgmt-rt", scope: "global_staff", tables: ["orders"] },
    { file: "src/pages/admin/CentralOrderPool.tsx", channel: "central-order-pool", scope: "global_staff", tables: ["suggested_orders"] },
    { file: "src/pages/admin/AdminPricing.tsx", channel: "admin-pricing-sync", scope: "global_staff", tables: ["products"], issue: "patch mode — partial payload merge" },
    { file: "src/components/warroom/RawIntelligenceTab.tsx", channel: "warroom-raw-intel", scope: "global_staff", tables: ["debug_webhooks"] },
    { file: "src/components/WhatsAppInbox.tsx", channel: "whatsapp-inbox-packets", scope: "global_staff", tables: ["whatsapp_message_packets"] },
    { file: "src/hooks/useStableSubscription.ts", channel: "stable-{tableName}", scope: "global_staff", tables: ["parameterized"] },
  ],
  pollingSurfaces: [
    { file: "src/hooks/useDepartmentExecutionBoard.ts", intervalMs: 45_000 },
    { file: "src/pages/admin/DispatchTV.tsx", intervalMs: 30_000 },
    { file: "src/pages/admin/AssemblyTV.tsx", intervalMs: 30_000 },
    { file: "src/pages/admin/ReadyGoodsTV.tsx", intervalMs: 30_000 },
    { file: "src/pages/admin/ThreePgsTV.tsx", intervalMs: 30_000 },
    { file: "src/components/FactoryTVModule.tsx", intervalMs: 30_000 },
    { file: "src/pages/admin/AdminDepartment.tsx", intervalMs: 15_000 },
    { file: "src/pages/admin/OperationsController.tsx", intervalMs: 15_000 },
    { file: "src/components/PanicAlertBanner.tsx", intervalMs: 15_000 },
    { file: "src/components/whatsapp/Wa3ClarificationQueueStrip.tsx", intervalMs: 30_000 },
  ],
  separation: {
    point20: "operational-events/ is event truth read-model — not realtime transport",
    point23: "src/lib/realtime/ is Central subscription standard — snapshot first, scoped delta second",
    point24: "retry/backoff for integrations — foreign prerequisite; controller exposes degraded/unavailable + polling fallback only",
  },
} as const;
