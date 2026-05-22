import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Clock, Pin } from "lucide-react";
import type { MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import {
  inferLocalIntentFromText,
  inferPacketHealth,
  operatorInboxIntentRowBorderClass,
  operatorInboxPacketPreviewSummary,
  packetAgeBucket,
  packetSlaUiMeta,
  packetStitchedPlainText,
} from "./operatorInboxUtils";
import { OperatorInboxIntentDot, OperatorInboxPacketHealthBadge } from "./OperatorInboxReadOnlyPanels";

function SidebarPacketMeta({ packet, compact }: { packet: OperatorInboxPacket; compact: boolean }) {
  const msgs = packet.messages ?? [];
  const inbound = msgs.filter((m) => m.direction === "inbound").length;
  const outbound = msgs.filter((m) => m.direction === "outbound").length;
  const age = packetAgeBucket(packet.last_message_at);
  const sla = packetSlaUiMeta(age);
  const health = inferPacketHealth(packet.last_message_at, msgs);
  return (
    <div className={cn("flex flex-wrap items-center gap-1", compact ? "mt-0.5" : "mt-1")}>
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
        {packet.status}
      </Badge>
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
        in {inbound} · out {outbound}
      </Badge>
      <Badge
        variant="outline"
        className="border-teal-200 bg-teal-50 px-1.5 py-0 text-[10px] font-normal text-teal-900"
        title={`SLA bucket: ${sla.title} (${sla.range} since last activity)`}
      >
        SLA {sla.title}
      </Badge>
      <OperatorInboxPacketHealthBadge health={health} />
    </div>
  );
}

export interface OperatorInboxPacketRowProps {
  packet: OperatorInboxPacket;
  selected: boolean;
  pinned: boolean;
  onSelect: (packet: OperatorInboxPacket) => void;
  onPin: (id: string, e: MouseEvent) => void;
  /** Optional id for keyboard aria-activedescendant */
  rowId?: string;
  /** Denser layout for virtualized list */
  compact?: boolean;
}

export function OperatorInboxPacketRow({
  packet,
  selected,
  pinned,
  onSelect,
  onPin,
  rowId,
  compact = false,
}: OperatorInboxPacketRowProps) {
  const stitchedText = packetStitchedPlainText(packet.stitched_content);
  const intent = inferLocalIntentFromText(stitchedText);
  return (
    <div
      id={rowId}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => onSelect(packet)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(packet);
        }
      }}
      className={cn(
        "cursor-pointer border-b border-gray-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2",
        compact ? "p-2.5" : "p-4",
        selected ? "border-l-4 border-l-green-500 bg-green-50" : cn("border-l-4", operatorInboxIntentRowBorderClass(intent.tone), "hover:bg-gray-50"),
      )}
    >
      <div className={cn("flex items-start justify-between gap-2", compact ? "mb-1" : "mb-2")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("truncate font-semibold text-gray-900", compact && "text-sm")}>{packet.customer_name}</p>
            <OperatorInboxIntentDot tone={intent.tone} label={intent.label} />
          </div>
          <p className="truncate text-xs text-gray-500">{packet.phone_number}</p>
          <SidebarPacketMeta packet={packet} compact={compact} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={cn(
              "min-h-11 min-w-11 rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 md:min-h-9 md:min-w-9",
              pinned && "text-amber-700",
            )}
            title={pinned ? "Unpin" : "Pin (local)"}
            aria-pressed={pinned}
            onClick={(e) => onPin(packet.id, e)}
          >
            <Pin className={cn("h-4 w-4", pinned && "fill-amber-200")} aria-hidden />
          </button>
          <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
        </div>
      </div>

      <p className={cn("text-gray-600", compact ? "mb-1 line-clamp-1 text-xs" : "mb-2 line-clamp-2 text-sm")}>
        {operatorInboxPacketPreviewSummary(packet)}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-block rounded bg-green-100 font-medium text-green-800",
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
          )}
        >
          {packet.fragment_count} fragments
        </span>
        <span className="flex items-center text-xs text-gray-500">
          <Clock className="mr-1 h-3 w-3" aria-hidden />
          {formatDistanceToNow(new Date(packet.last_message_at), {
            addSuffix: true,
          })}
        </span>
      </div>
    </div>
  );
}
