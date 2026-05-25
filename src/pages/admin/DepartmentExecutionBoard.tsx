import { useLocation } from "react-router-dom";
import { ExecutionBoardMobileView } from "@/components/execution/ExecutionBoardMobileView";
import { ExecutionBoardTVView } from "@/components/execution/ExecutionBoardTVView";
import { ExecutionEmptyState } from "@/components/execution/ExecutionEmptyState";
import { ExecutionErrorState } from "@/components/execution/ExecutionErrorState";
import { ExecutionQueueBoard } from "@/components/execution/ExecutionQueueBoard";
import { ExecutionQueueDrawer } from "@/components/execution/ExecutionQueueDrawer";
import { ExecutionResponsiveShell } from "@/components/execution/ExecutionResponsiveShell";
import { ExecutionSkeletonState } from "@/components/execution/ExecutionSkeletonState";
import { useDepartmentExecutionBoard } from "@/hooks/useDepartmentExecutionBoard";
import { useExecutionDisplayMode } from "@/hooks/useExecutionDisplayMode";
import type { DepartmentBoardId } from "@/lib/execution-boards/departmentBoardConfig";
import { assessQueueSla } from "@/lib/execution-intelligence/slaBreachDetection";

export default function DepartmentExecutionBoard({ boardId }: { boardId: DepartmentBoardId }) {
  const { mode, isTv, isMobile } = useExecutionDisplayMode();
  const location = useLocation();
  const tvHref = `${location.pathname}?display=tv`;

  const api = useDepartmentExecutionBoard(boardId);
  const {
    config,
    loading,
    error,
    lanes,
    selectedId,
    setSelectedId,
    selectedItem,
    drawerEvents,
    drawerScans,
    canWrite,
    refresh,
    lastLoadedAt,
    isStale,
    versionConflict,
    lastScanResult,
    actionsDisabled,
  } = api;

  const slaSeverity = selectedItem
    ? assessQueueSla(
        {
          id: selectedItem.id,
          queueType: selectedItem.queueType,
          entityType: selectedItem.entityType,
          entityId: selectedItem.entityId,
          orderId: selectedItem.orderId,
          customerId: selectedItem.customerId,
          title: selectedItem.title,
          state: selectedItem.state,
          ownerDepartment: selectedItem.ownerDepartment,
          assignedTo: selectedItem.assignedTo,
          escalationLevel: selectedItem.escalationLevel,
          blockerCode: selectedItem.blockerCode,
          blockerSummary: selectedItem.blockerSummary,
          slaDueAt: selectedItem.slaDueAt,
          createdAt: selectedItem.createdAt,
          updatedAt: selectedItem.updatedAt,
        },
        new Date().toISOString(),
      ).severity
    : "fresh";

  const totalCards =
    lanes.queue.length +
    lanes.blocked.length +
    lanes.escalated.length +
    lanes.aging.length +
    lanes.unowned.length;

  return (
    <ExecutionResponsiveShell
      title={config.title}
      mode={mode}
      canWrite={canWrite}
      loading={loading}
      error={error}
      lastLoadedAt={lastLoadedAt}
      isStale={isStale}
      versionConflict={versionConflict}
      lanes={lanes}
      onRefresh={refresh}
      tvHref={tvHref}
    >
      {loading && totalCards === 0 ? <ExecutionSkeletonState /> : null}
      {!loading && error && totalCards === 0 ? (
        <ExecutionErrorState message={error} onRetry={refresh} />
      ) : null}
      {!loading && !error && totalCards === 0 ? (
        <ExecutionEmptyState
          title="No queue items"
          description="Open work will appear here when operational queues are populated."
        />
      ) : null}

      {isTv ? (
        <ExecutionBoardTVView lanes={lanes} lastLoadedAt={lastLoadedAt} />
      ) : isMobile ? (
        <ExecutionBoardMobileView lanes={lanes} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <ExecutionQueueBoard lanes={lanes} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      {!isTv ? (
        <ExecutionQueueDrawer
          open={Boolean(selectedItem)}
          onOpenChange={(o) => !o && setSelectedId(null)}
          item={selectedItem}
          config={config}
          events={drawerEvents}
          scans={drawerScans}
          api={api}
          slaSeverity={slaSeverity}
          mobile={isMobile}
          actionsDisabled={actionsDisabled || !canWrite}
          lastScanResult={lastScanResult}
        />
      ) : null}
    </ExecutionResponsiveShell>
  );
}
