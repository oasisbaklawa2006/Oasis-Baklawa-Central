import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PlayCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationalExecution } from "@/hooks/useOperationalExecution";

/**
 * Internal preview for authority-gated persistent queue writes.
 * Route: /admin/queue-execution-preview (cmd_war_room + role-gated writes).
 */
export default function QueueExecutionPreview() {
  const { loading, error, items, canWrite, refresh, runWrite } = useOperationalExecution();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PlayCircle className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Queue execution preview</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Persistent store
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Internal execution surface
          </CardTitle>
          <CardDescription className="text-xs">
            Writes use the operational execution service only (no direct table mutation). Production operators
            should use department boards in a later phase.{" "}
            <Link to="/admin/live-work-queues" className="underline">
              Live work queues
            </Link>{" "}
            remain read-only feeds.
          </CardDescription>
        </CardHeader>
        {!canWrite ? (
          <CardContent className="text-xs text-muted-foreground">
            Read-only for your role. SUPER_ADMIN and OPERATIONS_MANAGER may run preview actions.
          </CardContent>
        ) : null}
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{item.title}</CardTitle>
                <CardDescription className="text-xs">
                  {item.queueType} · {item.state} · v{item.version}
                </CardDescription>
              </CardHeader>
              {canWrite ? (
                <CardContent className="flex flex-wrap gap-2">
                  {item.state === "pending" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={loading}
                      onClick={() =>
                        void runWrite((svc, ctx) =>
                          svc.acknowledgeQueueItem(
                            { queueItemId: item.id, expectedVersion: item.version },
                            ctx,
                          ),
                        )
                      }
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                  {item.state === "acknowledged" || item.state === "pending" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={loading}
                      onClick={() =>
                        void runWrite((svc, ctx) =>
                          svc.assignQueueItem(
                            {
                              queueItemId: item.id,
                              expectedVersion: item.version,
                              toUserId: null,
                              reason: "Preview assign",
                            },
                            ctx,
                          ),
                        )
                      }
                    >
                      Assign (unassigned)
                    </Button>
                  ) : null}
                  {item.state === "assigned" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={loading}
                      onClick={() =>
                        void runWrite((svc, ctx) =>
                          svc.startQueueItem(
                            { queueItemId: item.id, expectedVersion: item.version },
                            ctx,
                          ),
                        )
                      }
                    >
                      Start
                    </Button>
                  ) : null}
                  {item.state === "in_progress" ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading}
                        onClick={() =>
                          void runWrite((svc, ctx) =>
                            svc.blockQueueItem(
                              {
                                queueItemId: item.id,
                                expectedVersion: item.version,
                                reason: "Preview block",
                              },
                              ctx,
                            ),
                          )
                        }
                      >
                        Block
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={loading}
                        onClick={() =>
                          void runWrite((svc, ctx) =>
                            svc.completeQueueItem(
                              { queueItemId: item.id, expectedVersion: item.version },
                              ctx,
                            ),
                          )
                        }
                      >
                        Complete
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() =>
                      void runWrite((svc, ctx) =>
                        svc.addOperationalNote(
                          { queueItemId: item.id, note: "Preview note from execution surface" },
                          ctx,
                        ),
                      )
                    }
                  >
                    Note
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          </li>
        ))}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open persistent queue items.</p>
        ) : null}
      </ul>
    </div>
  );
}
