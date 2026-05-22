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
  packetStitchedPlainText,
} from "./operatorInboxUtils";
import { OperatorInboxIntentDot, OperatorInboxPacketHealthBadge } from "./OperatorInboxReadOnlyPanels";

function sidebarAgeLabel(age: ReturnType<typeof packetAgeBucket>): string {
  switch (age) {
    case "fresh":
      return "<15m";
    case "active":
      return "<2h";
    case "aging":
      return "<24h";
    default:
      return "24h+";
  }
}

function SidebarPacketMeta({ packet }: { packet: OperatorInboxPacket }) {
  const msgs = packet.messages ?? [];
  const inbound = msgs.filter((m) => m.direction === "inbound").length;
  const outbound = msgs.filter((m) => m.direction === "outbound").length;
  const age = packetAgeBucket(packet.last_message_at);
  const health = inferPacketHealth(packet.last_message_at, msgs);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
        {packet.status}
      </Badge>
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
        in {inbound} · out {outbound}
      </Badge>
      <Badge variant="outline" className="border-teal-200 bg-teal-50 px-1.5 py-0 text-[10px] font-normal text-teal-900">
        age {sidebarAgeLabel(age)}
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
}

export function OperatorInboxPacketRow({ packet, selected, pinned, onSelect, onPin, rowId }: OperatorInboxPacketRowProps) {
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
        "cursor-pointer border-b border-gray-200 p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2",
        selected ? "border-l-4 border-l-green-500 bg-green-50" : cn("border-l-4", operatorInboxIntentRowBorderClass(intent.tone), "hover:bg-gray-50"),
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-gray-900">{packet.customer_name}</p>
            <OperatorInboxIntentDot tone={intent.tone} label={intent.label} />
          </div>
          <p className="truncate text-xs text-gray-500">{packet.phone_number}</p>
          <SidebarPacketMeta packet={packet} />
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

      <p className="mb-2 line-clamp-2 text-sm text-gray-600">{operatorInboxPacketPreviewSummary(packet)}</p>

      <div className="flex items-center justify-between">
        <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
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
