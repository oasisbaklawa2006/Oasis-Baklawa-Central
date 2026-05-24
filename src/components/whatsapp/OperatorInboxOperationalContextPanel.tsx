import { Link } from "react-router-dom";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import type { OperatorInboxPacket } from "@/components/whatsapp/operatorInboxTypes";
import {
  extractDraftOrderHints,
  inferPacketHealth,
  packetAgeBucket,
  packetSlaUiMeta,
} from "@/components/whatsapp/operatorInboxUtils";
import type { OperationalEventRecord } from "@/lib/operational-events/types";

interface Props {
  packet: OperatorInboxPacket;
  events: OperationalEventRecord[];
}

/**
 * Read-only operational context beside the conversation (no workflow side effects).
 */
export function OperatorInboxOperationalContextPanel({ packet, events }: Props) {
  const messages = packet.messages ?? [];
  const hints = extractDraftOrderHints(messages, 6);
  const health = inferPacketHealth(packet.last_message_at, messages);
  const age = packetAgeBucket(packet.last_message_at);
  const sla = packetSlaUiMeta(age);

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm"
      aria-labelledby="operator-inbox-op-ctx-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id="operator-inbox-op-ctx-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Operational context
        </h3>
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
          Packet {packet.id.slice(0, 8)}…
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-600">
        Thread health · <span className="font-medium text-slate-900">{health}</span>
        {" · "}
        Idle · <span className="font-medium text-slate-900">{sla.title}</span> ({sla.range})
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Packet status · <span className="font-mono text-slate-900">{packet.status}</span>
      </p>
      <div className="mt-2 rounded-md border border-dashed border-slate-200 bg-slate-50/80 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Text-only order hints</p>
        {hints.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-500">No hints extracted.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-700">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-slate-500">
          Not linked to live orders automatically — match in Orders / Order trace when needed.
        </p>
      </div>
      <div className="mt-3">
        <OperationalTimeline
          events={events}
          ariaLabel="WhatsApp operational timeline for this packet"
          className="max-h-[min(55vh,28rem)] overflow-y-auto overscroll-y-contain pr-1"
        />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        For finance / dispatch / approvals, open{" "}
        <Link className="font-medium text-primary underline-offset-2 hover:underline" to="/admin/orders">
          Orders
        </Link>{" "}
        and use order trace from there.
      </p>
    </section>
  );
}
