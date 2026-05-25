import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ExecutionDisplayMode } from "@/lib/execution-ux/executionUxConstants";

const MOBILE_MQ = "(max-width: 767px)";

export function useExecutionDisplayMode(): {
  mode: ExecutionDisplayMode;
  isTv: boolean;
  isMobile: boolean;
  isDesktop: boolean;
} {
  const [searchParams] = useSearchParams();
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return useMemo(() => {
    const tvParam = searchParams.get("display") === "tv";
    const isTv = tvParam;
    const isMobile = !isTv && narrow;
    const mode: ExecutionDisplayMode = isTv ? "tv" : isMobile ? "mobile" : "desktop";
    return { mode, isTv, isMobile, isDesktop: mode === "desktop" };
  }, [searchParams, narrow]);
}
