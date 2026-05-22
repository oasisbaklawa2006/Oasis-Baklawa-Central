import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { deriveInboxAnalyticsFromPackets } from "./operatorInboxAnalyticsDerive";
import type { OperatorInboxObservabilitySnapshot } from "./useOperatorInboxObservability";
import type { AnalyticsSupplementSnapshot } from "./useOperatorInboxAnalyticsSupplement";
import type { PacketHealth } from "./operatorInboxUtils";

function BarList({ rows, valueKey }: { rows: { label: string; value: number }[]; valueKey: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5" aria-label={valueKey}>
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-[11px] text-gray-800">
          <span className="w-24 shrink-0 truncate font-medium text-gray-600" title={r.label}>
            {r.label}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100" role="presentation">
            <div
              className="h-2 rounded-full bg-emerald-600 motion-reduce:transition-none"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums text-gray-500">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function HeatCell({ n, max }: { n: number; max: number }) {
  const intensity = max <= 0 ? 0 : Math.min(1, n / max);
  return (
    <div
      className={cn(
        "flex h-8 items-center justify-center rounded border border-gray-100 text-[10px] font-medium tabular-nums",
        intensity > 0.66
          ? "bg-emerald-600 text-white"
          : intensity > 0.33
            ? "bg-emerald-300 text-emerald-950"
            : "bg-gray-50 text-gray-500",
      )}
      title={`Count ${n}`}
    >
      {n}
    </div>
  );
}

const HEALTH_ORDER: PacketHealth[] = ["healthy", "needs_reply", "stale_open", "operator_issue"];

export function OperatorInboxAnalyticsLayer({
  packets,
  isRealtimeSyncing,
  observabilitySnapshot,
  supplementSnapshot,
  supplementLoading,
}: {
  packets: OperatorInboxPacket[];
  isRealtimeSyncing: boolean;
  observabilitySnapshot: OperatorInboxObservabilitySnapshot;
  supplementSnapshot: AnalyticsSupplementSnapshot;
  supplementLoading: boolean;
}) {
  const d = useMemo(() => deriveInboxAnalyticsFromPackets(packets), [packets]);

  const healthRows = HEALTH_ORDER.map((h) => ({
    label: h.replace("_", " "),
    value: d.conversationHealth[h],
  }));

  const classRows = d.classificationDistribution.map((x) => ({ label: x.label, value: x.count }));

  const maxHeat = Math.max(
    1,
    ...d.messageAgingHeatmap.flatMap((r) => [r.inbound, r.outbound]),
    ...d.customerActivityByHour,
  );

  const maxUnanswered = Math.max(1, ...d.unansweredTrend.map((x) => x.count));

  const obsErrCount = observabilitySnapshot.partialErrors.length + supplementSnapshot.partialErrors.length;

  return (
    <details className="group border-b border-slate-200 bg-slate-50/95 open:bg-slate-50">
      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>Read-only analytics layer (C2B.3)</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-normal normal-case text-slate-700">
            {d.packetCount} pkts · soft-fail safe
          </span>
          {supplementLoading ? (
            <span className="text-[10px] font-normal normal-case text-slate-500">Background metrics…</span>
          ) : null}
        </span>
      </summary>
      <div className="border-t border-slate-200/80 px-3 pb-3 pt-2">
        <p className="mb-3 text-[11px] leading-snug text-slate-600">{d.scopeLabel}</p>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              isRealtimeSyncing ? "bg-amber-100 text-amber-900" : "bg-slate-200/80 text-slate-800",
            )}
            role="status"
          >
            {isRealtimeSyncing ? "Realtime sync in progress" : "Realtime idle"}
          </span>
          {observabilitySnapshot.lastUpdated ? (
            <span>Observability updated {new Date(observabilitySnapshot.lastUpdated).toLocaleTimeString()}</span>
          ) : null}
          {supplementSnapshot.lastUpdated ? (
            <span>Supplement updated {new Date(supplementSnapshot.lastUpdated).toLocaleTimeString()}</span>
          ) : null}
          {obsErrCount > 0 ? (
            <span className="text-amber-800">{obsErrCount} partial metric error(s) — inbox unaffected.</span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm"
            aria-label="Conversation health"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Conversation health</h3>
            <BarList rows={healthRows} valueKey="health" />
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm"
            aria-label="Operator workload"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Operator workload</h3>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-800">
              <dt className="text-slate-500">Inbound msgs</dt>
              <dd className="text-right tabular-nums">{d.operatorWorkload.totalInbound}</dd>
              <dt className="text-slate-500">Outbound msgs</dt>
              <dd className="text-right tabular-nums">{d.operatorWorkload.totalOutbound}</dd>
              <dt className="text-slate-500">Op. replies</dt>
              <dd className="text-right tabular-nums">{d.operatorWorkload.operatorReplyOutbound}</dd>
              <dt className="text-slate-500">Avg msgs / pkt</dt>
              <dd className="text-right tabular-nums">{d.operatorWorkload.avgMessagesPerPacket.toFixed(1)}</dd>
              <dt className="text-slate-500">Contacts</dt>
              <dd className="text-right tabular-nums">{d.operatorWorkload.uniqueContactIds}</dd>
            </dl>
            {supplementSnapshot.messagesLast24h != null && supplementSnapshot.messagesPrev24h != null ? (
              <p className="mt-2 text-[10px] leading-snug text-slate-600">
                Global volume (all packets): last 24h <strong>{supplementSnapshot.messagesLast24h}</strong> vs prior
                24h <strong>{supplementSnapshot.messagesPrev24h}</strong>.
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">Global 24h volume unavailable (soft-fail).</p>
            )}
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm md:col-span-2 xl:col-span-1"
            aria-label="Operational KPIs"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Operational KPIs</h3>
            <ul className="space-y-1 text-[11px] text-slate-800">
              <li>
                Unanswered packets (loaded): <strong>{d.kpis.unansweredPackets}</strong>
              </li>
              <li>
                Stale + unanswered: <strong>{d.kpis.staleUnansweredPackets}</strong>
              </li>
              <li>
                Median packet idle:{" "}
                <strong>
                  {d.kpis.medianPacketIdleHours != null ? `${d.kpis.medianPacketIdleHours.toFixed(1)}h` : "—"}
                </strong>
              </li>
              <li>
                Inbound ÷ outbound:{" "}
                <strong>
                  {d.kpis.inboundToOutboundRatio != null ? d.kpis.inboundToOutboundRatio.toFixed(2) : "—"}
                </strong>
              </li>
              <li>
                Persisted-like stitch flags: <strong>{d.persistedLikeClassificationCount}</strong> / {d.packetCount}
              </li>
            </ul>
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm md:col-span-2"
            aria-label="Message aging heatmap"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Message aging (loaded sample)
            </h3>
            <div className="mb-1 grid grid-cols-[minmax(0,4rem)_1fr_1fr] gap-1 text-[10px] font-medium text-slate-500">
              <span>Age</span>
              <span className="text-center">In</span>
              <span className="text-center">Out</span>
            </div>
            {d.messageAgingHeatmap.map((row) => (
              <div key={row.bucket} className="grid grid-cols-[minmax(0,4rem)_1fr_1fr] gap-1">
                <span className="py-1 text-[10px] text-slate-600">{row.bucket}</span>
                <HeatCell n={row.inbound} max={maxHeat} />
                <HeatCell n={row.outbound} max={maxHeat} />
              </div>
            ))}
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm"
            aria-label="Unanswered trend"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Unanswered trend (7d)
            </h3>
            <div className="flex h-24 items-end gap-1">
              {d.unansweredTrend.map((day) => (
                <div key={day.dayKey} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[2.5rem] rounded-t bg-amber-500/90"
                    style={{ height: `${(day.count / maxUnanswered) * 100}%`, minHeight: day.count ? 4 : 0 }}
                    title={`${day.dayLabel}: ${day.count}`}
                  />
                  <span className="truncate text-[9px] text-slate-500">{day.dayLabel}</span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm"
            aria-label="Provider reliability"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Provider reliability (outbound, loaded)
            </h3>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[10px] text-slate-800">
              {d.providerReliability.slice(0, 10).map((p) => {
                const tot = p.delivered + p.failed + p.pendingOrOther;
                const ok = tot ? p.delivered / tot : 0;
                return (
                  <li key={p.provider} className="flex flex-col gap-0.5 border-b border-gray-50 pb-1">
                    <div className="flex justify-between gap-2 font-medium">
                      <span className="truncate">{p.provider}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{(ok * 100).toFixed(0)}% ok</span>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                      <span>ok {p.delivered}</span>
                      <span>fail {p.failed}</span>
                      <span>other {p.pendingOrOther}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm"
            aria-label="Classification distribution"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Classification / intent (local)
            </h3>
            <BarList rows={classRows} valueKey="classification" />
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm md:col-span-2 xl:col-span-3"
            aria-label="Customer activity timeline"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Customer activity by hour (loaded messages)
            </h3>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {d.customerActivityByHour.map((n, h) => (
                <HeatCell key={h} n={n} max={maxHeat} />
              ))}
            </div>
            <p className="mt-1 text-[9px] text-slate-500">24 cells = local hour of day for message timestamps.</p>
          </section>

          <section
            className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm md:col-span-2"
            aria-label="Failure surface mapping"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Failure surface (loaded + global sample)
            </h3>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto text-[10px] text-slate-800">
              {d.failureSurfaceFromSample.map((r) => (
                <li key={r.surfaceKey} className="rounded border border-red-100 bg-red-50/60 px-2 py-1">
                  <span className="font-semibold text-red-900">
                    {r.provider} · {r.status}
                  </span>
                  <span className="ml-2 tabular-nums text-red-800">×{r.count}</span>
                  {r.failureReasonSnippet ? (
                    <p className="mt-0.5 truncate text-red-800/90" title={r.failureReasonSnippet ?? ""}>
                      {r.failureReasonSnippet}
                    </p>
                  ) : null}
                </li>
              ))}
              {supplementSnapshot.globalFailedOutboundSample.slice(0, 8).map((row, i) => (
                <li
                  key={`g-${i}-${row.provider}-${row.status}`}
                  className="rounded border border-amber-100 bg-amber-50/50 px-2 py-1 text-amber-950"
                >
                  <span className="font-medium">Global sample</span> · {row.provider ?? "?"} · {row.status ?? "?"}
                  {row.failure_reason ? (
                    <p className="mt-0.5 truncate text-amber-900/90" title={row.failure_reason}>
                      {row.failure_reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </details>
  );
}
