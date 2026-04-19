export const REALTIME_STATUS: "enabled" | "disabled" = "disabled";

export const isRealtimeEnabled = false;

export const useRealtime = () => ({
  status: REALTIME_STATUS,
  enabled: isRealtimeEnabled,
});