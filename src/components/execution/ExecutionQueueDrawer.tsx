import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { DepartmentBoardConfig } from "@/lib/execution-boards/departmentBoardConfig";
import type { useDepartmentExecutionBoard } from "@/hooks/useDepartmentExecutionBoard";
import { extractPhotosFromEvents } from "@/lib/operational-media";
import { ExecutionActionBar } from "./ExecutionActionBar";
import { ExecutionBlockerPanel } from "./ExecutionBlockerPanel";
import { ExecutionDependencyTree } from "./ExecutionDependencyTree";
import { ExecutionEventTimeline } from "./ExecutionEventTimeline";
import { ExecutionOwnershipPanel } from "./ExecutionOwnershipPanel";
import { ExecutionPhotoPanel } from "./ExecutionPhotoPanel";
import { ExecutionSlaBadge } from "./ExecutionSlaBadge";

type BoardApi = ReturnType<typeof useDepartmentExecutionBoard>;

export function ExecutionQueueDrawer({
  open,
  onOpenChange,
  item,
  config,
  events,
  scans,
  api,
  slaSeverity,
  mobile,
  actionsDisabled,
  lastScanResult,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MappedQueueItem | null;
  config: DepartmentBoardConfig;
  events: OperationalStoreEventRecord[];
  scans: OperationalScanRecord[];
  api: BoardApi;
  slaSeverity: string;
  mobile?: boolean;
  actionsDisabled?: boolean;
  lastScanResult?: {
    correlationId?: string;
    eventId?: string;
    verificationStatus?: string;
    mismatchReason?: string | null;
  } | null;
}) {
  const photos = extractPhotosFromEvents(events);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`flex w-full flex-col overflow-y-auto ${mobile ? "h-[100dvh] max-w-full sm:max-w-full" : "sm:max-w-lg"}`}
      >
        <SheetHeader>
          <SheetTitle>{item?.title ?? "Queue item"}</SheetTitle>
          <SheetDescription className="flex flex-wrap gap-2">
            {item ? (
              <>
                <ExecutionSlaBadge severity={slaSeverity} />
                <span className="text-xs">v{item.version}</span>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        {item ? (
          <div className="mt-4 space-y-4">
            <ExecutionOwnershipPanel item={item} />
            <ExecutionBlockerPanel item={item} />
            <ExecutionDependencyTree item={item} />
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase">Scan history</h4>
              <ul className="text-xs">
                {scans.map((s) => (
                  <li key={s.id}>
                    {s.scanType} · {s.verificationStatus} · {s.barcodeValue}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase">Audit timeline</h4>
              <ExecutionEventTimeline events={events} />
            </section>
            {photos.length > 0 ? (
              <section className="text-xs">
                <h4 className="mb-2 font-semibold uppercase">Photo metadata</h4>
                {photos.map((p, i) => (
                  <p key={i}>{p.caption ?? p.imageReference}</p>
                ))}
              </section>
            ) : null}
            <ExecutionPhotoPanel
              disabled={!api.canWrite}
              onAttach={(ref, cap) => void api.attachPhoto(item, ref, cap)}
            />
            <ExecutionActionBar
              item={item}
              config={config}
              api={api}
              disabled={actionsDisabled ?? !api.canWrite}
              lastScanResult={lastScanResult}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
