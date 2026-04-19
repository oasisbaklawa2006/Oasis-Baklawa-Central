export const REALTIME_STATUS: "enabled" | "disabled" = "disabled";

export const isRealtimeEnabled = REALTIME_STATUS === "enabled";

export const useRealtime = () => ({
  status: REALTIME_STATUS,
  enabled: isRealtimeEnabled,
});