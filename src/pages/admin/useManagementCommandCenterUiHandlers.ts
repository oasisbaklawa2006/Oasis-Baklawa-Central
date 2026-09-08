import { useCallback, type ChangeEvent } from "react";
import type { ComplianceException } from "@/lib/management-reporting";
import type { ManagementCommandCenterFilters } from "@/hooks/useManagementCommandCenter";

type UiHandlerArgs = {
  setEanSearchInput: (value: string) => void;
  setExceptionCategory: (value: ComplianceException["category"] | "all") => void;
  setExceptionSeverity: (value: ComplianceException["severity"] | "all") => void;
  setFilters: (
    value:
      | ManagementCommandCenterFilters
      | ((current: ManagementCommandCenterFilters) => ManagementCommandCenterFilters),
  ) => void;
  setPeriodPreset: (preset: "this_month" | "last_month" | "last_3_months") => void;
  refresh: () => Promise<void>;
  handleTallyExport: () => Promise<void>;
  handleVerifyLastExport: () => Promise<void>;
};

/** Named event handlers for Management Command Center (Codacy void-expression line hygiene). */
export function useManagementCommandCenterUiHandlers({
  setEanSearchInput,
  setExceptionCategory,
  setExceptionSeverity,
  setFilters,
  setPeriodPreset,
  refresh,
  handleTallyExport,
  handleVerifyLastExport,
}: UiHandlerArgs) {
  const handleEanSearchChange = useCallback(function onEanSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setEanSearchInput(event.target.value);
  }, [setEanSearchInput]);

  const handleExceptionCategoryChange = useCallback(function onExceptionCategoryChange(value: string) {
    setExceptionCategory(value as ComplianceException["category"] | "all");
  }, [setExceptionCategory]);

  const handleExceptionSeverityChange = useCallback(function onExceptionSeverityChange(value: string) {
    setExceptionSeverity(value as ComplianceException["severity"] | "all");
  }, [setExceptionSeverity]);

  const handleTallyCompanyChange = useCallback(function onTallyCompanyChange(value: string) {
    setFilters((current) => ({
      ...current,
      tallyCompanyId: value === "all" ? null : value,
    }));
  }, [setFilters]);

  const handleEanPagePrevious = useCallback(function onEanPagePrevious() {
    setFilters((current) => ({ ...current, eanPage: Math.max(0, current.eanPage - 1) }));
  }, [setFilters]);

  const handleEanPageNext = useCallback(function onEanPageNext() {
    setFilters((current) => ({ ...current, eanPage: current.eanPage + 1 }));
  }, [setFilters]);

  const handleRefreshClick = useCallback(function onRefreshClick() {
    void refresh();
  }, [refresh]);

  const handleThisMonthClick = useCallback(function onThisMonthClick() {
    setPeriodPreset("this_month");
  }, [setPeriodPreset]);

  const handleLastMonthClick = useCallback(function onLastMonthClick() {
    setPeriodPreset("last_month");
  }, [setPeriodPreset]);

  const handleLastThreeMonthsClick = useCallback(function onLastThreeMonthsClick() {
    setPeriodPreset("last_3_months");
  }, [setPeriodPreset]);

  const handleTallyExportClick = useCallback(function onTallyExportClick() {
    void handleTallyExport();
  }, [handleTallyExport]);

  const handleVerifyLastExportClick = useCallback(function onVerifyLastExportClick() {
    void handleVerifyLastExport();
  }, [handleVerifyLastExport]);

  return {
    handleEanSearchChange,
    handleExceptionCategoryChange,
    handleExceptionSeverityChange,
    handleTallyCompanyChange,
    handleEanPagePrevious,
    handleEanPageNext,
    handleRefreshClick,
    handleThisMonthClick,
    handleLastMonthClick,
    handleLastThreeMonthsClick,
    handleTallyExportClick,
    handleVerifyLastExportClick,
  };
}

export function createDebounceCleanup(handle: number) {
  return function clearDebounceTimer() {
    window.clearTimeout(handle);
  };
}
