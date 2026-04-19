export const REALTIME_STATUS = "disabled" as const;

export const isRealtimeEnabled = REALTIME_STATUS === "enabled";

export const useRealtime = () => ({
  status: REALTIME_STATUS,
  enabled: isRealtimeEnabled,
});