import { Link } from "react-router-dom";
import { RefreshCw, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalReadOnlyBanner } from "@/components/admin/OperationalReadOnlyBanner";
import { ExecutionQueueBoard } from "@/components/execution/ExecutionQueueBoard";
import { ExecutionQueueDrawer } from "@/components/execution/ExecutionQueueDrawer";
import { useDepartmentExecutionBoard } from "@/hooks/useDepartmentExecutionBoard";
import type { DepartmentBoardId } from "@/lib/execution-boards/departmentBoardConfig";
import { assessQueueSla } from "@/lib/execution-intelligence/slaBreachDetection";

export default function DepartmentExecutionBoard({ boardId }: { boardId: DepartmentBoardId }) {
  const api = useDepartmentExecutionBoard(boardId);
  const { config, loading, error, lanes, selectedId, setSelectedId, selectedItem, drawerEvents, drawerScans, canWrite, refresh } =
    api;

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-lg font-bold tracking-tight">{config.title}</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Execution board
          </Badge>
          {!canWrite ? (
            <Badge variant="secondary" className="text-[10px]">
              Read-only role
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/admin/execution-command-center">Command center</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        </div>
      </header>

      <OperationalReadOnlyBanner
        warnings={
          canWrite
            ? ["Actions use OperationalExecutionService only — all writes emit operational_events."]
            : ["Your role cannot execute queue mutations on this board."]
        }
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <ExecutionQueueBoard lanes={lanes} selectedId={selectedId} onSelect={setSelectedId} />

      <ExecutionQueueDrawer
        open={Boolean(selectedItem)}
        onOpenChange={(o) => !o && setSelectedId(null)}
        item={selectedItem}
        config={config}
        events={drawerEvents}
        scans={drawerScans}
        api={api}
        slaSeverity={slaSeverity}
      />
    </div>
  );
}
