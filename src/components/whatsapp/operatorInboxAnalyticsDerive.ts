import { addDays, format, startOfDay, subDays } from "date-fns";
import type { Message, OperatorInboxPacket } from "./operatorInboxTypes";
import {
  inferLocalIntentFromText,
  inferPacketHealth,
  isLastMessageInboundUnanswered,
  packetStitchedPlainText,
  stitchedContentLooksClassified,
  type PacketHealth,
} from "./operatorInboxUtils";

export interface MessageAgingBucketRow {
  bucket: string;
  inbound: number;
  outbound: number;
}

export interface UnansweredDayBin {
  dayKey: string;
  dayLabel: string;
  count: number;
}

export interface ProviderReliabilityRow {
  provider: string;
  delivered: number;
  failed: number;
  pendingOrOther: number;
}

export interface ClassificationBin {
  label: string;
  count: number;
}

export interface FailureSurfaceRow {
  surfaceKey: string;
  provider: string;
  status: string;
  failureReasonSnippet: string | null;
  count: number;
}

export interface DerivedInboxAnalytics {
  /** Shown in UI so operators know scope. */
  scopeLabel: string;
  packetCount: number;
  conversationHealth: Record<PacketHealth, number>;
  operatorWorkload: {
    totalInbound: number;
    totalOutbound: number;
    operatorReplyOutbound: number;
    avgMessagesPerPacket: number;
    uniqueContactIds: number;
  };
  messageAgingHeatmap: MessageAgingBucketRow[];
  unansweredTrend: UnansweredDayBin[];
  providerReliability: ProviderReliabilityRow[];
  /** Local keyword intent + stitched “classified” flag. */
  classificationDistribution: ClassificationBin[];
  persistedLikeClassificationCount: number;
  customerActivityByHour: number[];
  failureSurfaceFromSample: FailureSurfaceRow[];
  kpis: {
    unansweredPackets: number;
    staleUnansweredPackets: number;
    medianPacketIdleHours: number | null;
    inboundToOutboundRatio: number | null;
  };
}

function messageAgeBucketName(ageMs: number): string {
  const h = ageMs / 3600000;
  if (h <= 1) return "≤1h";
  if (h <= 6) return "1–6h";
  if (h <= 24) return "6–24h";
  if (h <= 72) return "1–3d";
  return "3d+";
}

function flattenMessages(packets: OperatorInboxPacket[]): Message[] {
  const out: Message[] = [];
  for (const p of packets) {
    for (const m of p.messages ?? []) out.push(m);
  }
  return out;
}

export function deriveInboxAnalyticsFromPackets(packets: OperatorInboxPacket[]): DerivedInboxAnalytics {
  const now = Date.now();
  const scopeLabel =
    packets.length === 0
      ? "No packets in view — load the inbox or widen filters."
      : `Derived from ${packets.length} open packet(s) currently loaded in the workspace (read-only).`;

  const conversationHealth: Record<PacketHealth, number> = {
    healthy: 0,
    needs_reply: 0,
    stale_open: 0,
    operator_issue: 0,
  };

  let unansweredPackets = 0;
  let staleUnansweredPackets = 0;
  const idleHours: number[] = [];

  for (const p of packets) {
    const h = inferPacketHealth(p.last_message_at, p.messages ?? []);
    conversationHealth[h] += 1;
    if (isLastMessageInboundUnanswered(p.messages ?? [])) {
      unansweredPackets += 1;
      if (h === "stale_open") staleUnansweredPackets += 1;
    }
    const t = new Date(p.last_message_at).getTime();
    if (!Number.isNaN(t)) idleHours.push((now - t) / 3600000);
  }

  idleHours.sort((a, b) => a - b);
  const medianPacketIdleHours =
    idleHours.length === 0 ? null : idleHours.length % 2 === 1
      ? idleHours[(idleHours.length - 1) / 2]!
      : (idleHours[idleHours.length / 2 - 1]! + idleHours[idleHours.length / 2]!) / 2;

  const all = flattenMessages(packets);
  let inbound = 0;
  let outbound = 0;
  let operatorReplyOutbound = 0;
  for (const m of all) {
    if (m.direction === "inbound") inbound += 1;
    else {
      outbound += 1;
      if (m.provider === "operator_reply") operatorReplyOutbound += 1;
    }
  }

  const inboundToOutboundRatio = outbound === 0 ? null : inbound / outbound;

  const contactIds = new Set(packets.map((p) => p.contact_id).filter(Boolean));

  const agingMap = new Map<string, { inbound: number; outbound: number }>();
  const bucketOrder = ["≤1h", "1–6h", "6–24h", "1–3d", "3d+"];
  for (const b of bucketOrder) agingMap.set(b, { inbound: 0, outbound: 0 });

  for (const m of all) {
    if (!m.created_at) continue;
    const age = now - new Date(m.created_at).getTime();
    if (age < 0) continue;
    const name = messageAgeBucketName(age);
    const cell = agingMap.get(name);
    if (!cell) continue;
    if (m.direction === "inbound") cell.inbound += 1;
    else cell.outbound += 1;
  }

  const messageAgingHeatmap: MessageAgingBucketRow[] = bucketOrder.map((bucket) => {
    const v = agingMap.get(bucket)!;
    return { bucket, inbound: v.inbound, outbound: v.outbound };
  });

  const unansweredTrend: UnansweredDayBin[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = startOfDay(subDays(new Date(), i));
    const next = addDays(day, 1);
    const dayKey = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "EEE M/d");
    let count = 0;
    for (const p of packets) {
      if (!isLastMessageInboundUnanswered(p.messages ?? [])) continue;
      const lm = new Date(p.last_message_at);
      if (Number.isNaN(lm.getTime())) continue;
      if (lm >= day && lm < next) count += 1;
    }
    unansweredTrend.push({ dayKey, dayLabel, count });
  }

  const provMap = new Map<string, { delivered: number; failed: number; pendingOrOther: number }>();
  for (const m of all) {
    if (m.direction !== "outbound") continue;
    const key = (m.provider ?? "unknown").trim() || "unknown";
    if (!provMap.has(key)) provMap.set(key, { delivered: 0, failed: 0, pendingOrOther: 0 });
    const row = provMap.get(key)!;
    const st = (m.status ?? "").toLowerCase();
    if (st === "delivered" || st === "sent" || st === "read") row.delivered += 1;
    else if (st === "failed" || st === "error") row.failed += 1;
    else row.pendingOrOther += 1;
  }
  const providerReliability = [...provMap.entries()]
    .map(([provider, v]) => ({ provider, ...v }))
    .sort((a, b) => b.delivered + b.failed + b.pendingOrOther - (a.delivered + a.failed + a.pendingOrOther));

  const intentMap = new Map<string, number>();
  let persistedLikeClassificationCount = 0;
  for (const p of packets) {
    if (stitchedContentLooksClassified(p.stitched_content)) persistedLikeClassificationCount += 1;
    const label = inferLocalIntentFromText(packetStitchedPlainText(p.stitched_content)).label;
    intentMap.set(label, (intentMap.get(label) ?? 0) + 1);
  }
  const classificationDistribution = [...intentMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const customerActivityByHour = Array.from({ length: 24 }, () => 0);
  for (const m of all) {
    if (!m.created_at) continue;
    const d = new Date(m.created_at);
    if (Number.isNaN(d.getTime())) continue;
    customerActivityByHour[d.getHours()] += 1;
  }

  const failMap = new Map<string, FailureSurfaceRow>();
  for (const m of all) {
    if (m.direction !== "outbound") continue;
    const st = (m.status ?? "").toLowerCase();
    if (st !== "failed" && st !== "error") continue;
    const prov = (m.provider ?? "unknown").trim() || "unknown";
    const reason = m.failure_reason?.trim() ? m.failure_reason.trim().slice(0, 120) : null;
    const surfaceKey = `${prov}::${m.status ?? "?"}::${reason ?? ""}`;
    const prev = failMap.get(surfaceKey);
    if (prev) prev.count += 1;
    else
      failMap.set(surfaceKey, {
        surfaceKey,
        provider: prov,
        status: m.status ?? "?",
        failureReasonSnippet: reason,
        count: 1,
      });
  }
  const failureSurfaceFromSample = [...failMap.values()].sort((a, b) => b.count - a.count).slice(0, 12);

  const totalMsgs = all.length;
  const avgMessagesPerPacket = packets.length === 0 ? 0 : totalMsgs / packets.length;

  return {
    scopeLabel,
    packetCount: packets.length,
    conversationHealth,
    operatorWorkload: {
      totalInbound: inbound,
      totalOutbound: outbound,
      operatorReplyOutbound,
      avgMessagesPerPacket,
      uniqueContactIds: contactIds.size,
    },
    messageAgingHeatmap,
    unansweredTrend,
    providerReliability,
    classificationDistribution,
    persistedLikeClassificationCount,
    customerActivityByHour,
    failureSurfaceFromSample,
    kpis: {
      unansweredPackets,
      staleUnansweredPackets,
      medianPacketIdleHours,
      inboundToOutboundRatio,
    },
  };
}
