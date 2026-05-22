import { useVirtualizer } from "@tanstack/react-virtual";
import { forwardRef, useImperativeHandle, type MouseEvent, type RefObject } from "react";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { OperatorInboxPacketRow } from "./OperatorInboxPacketRow";

const ESTIMATE_ROW = 140;

export type OperatorInboxVirtualizedPacketListHandle = {
  scrollToIndex: (index: number) => void;
};

type OperatorInboxVirtualizedPacketListProps = {
  scrollRef: RefObject<HTMLDivElement | null>;
  orderedPackets: OperatorInboxPacket[];
  selectedPacketId: string | null;
  pinnedIds: string[];
  onSelect: (p: OperatorInboxPacket) => void;
  onPin: (id: string, e: MouseEvent) => void;
};

export const OperatorInboxVirtualizedPacketList = forwardRef<
  OperatorInboxVirtualizedPacketListHandle,
  OperatorInboxVirtualizedPacketListProps
>(function OperatorInboxVirtualizedPacketList(
  { scrollRef, orderedPackets, selectedPacketId, pinnedIds, onSelect, onPin },
  ref,
) {
  const virtualizer = useVirtualizer({
    count: orderedPackets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATE_ROW,
    overscan: 10,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number) => {
        if (index < 0 || index >= orderedPackets.length) return;
        virtualizer.scrollToIndex(index, { align: "auto" });
      },
    }),
    [virtualizer, orderedPackets.length],
  );

  const items = virtualizer.getVirtualItems();

  return (
    <div
      className="relative w-full"
      style={{
        height: `${virtualizer.getTotalSize()}px`,
      }}
    >
      {items.map((vi) => {
        const packet = orderedPackets[vi.index];
        if (!packet) return null;
        return (
          <div
            key={packet.id}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <OperatorInboxPacketRow
              packet={packet}
              selected={selectedPacketId === packet.id}
              pinned={pinnedIds.includes(packet.id)}
              onSelect={onSelect}
              onPin={onPin}
              rowId={`packet-row-${packet.id}`}
            />
          </div>
        );
      })}
    </div>
  );
});
