import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GIFTING_ENQUIRY_STATUSES,
  GiftingQueueError,
  defaultGiftingQueueClient,
  listGiftingEnquiries,
  setGiftingEnquiryStatus,
  type GiftingEnquiry,
  type GiftingEnquiryStatus,
  type GiftingQueueRpcClient,
} from "@/lib/giftingEnquiries/queue";

type Props = { client?: GiftingQueueRpcClient };

const STATUS_LABEL: Record<GiftingEnquiryStatus, string> = {
  received: "Received",
  triaged: "Triaged",
  closed: "Closed",
  spam: "Spam",
};

const errorKind = (error: unknown) =>
  error instanceof GiftingQueueError ? error.kind : "unavailable";

const PAGE_SIZE = 50;

export default function AdminGiftingEnquiries({ client }: Props = {}) {
  const rpc = client ?? defaultGiftingQueueClient();
  const [filter, setFilter] = useState<GiftingEnquiryStatus | null>("received");
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [rows, setRows] = useState<GiftingEnquiry[] | null>(null);
  const [failure, setFailure] = useState<"forbidden" | "unavailable" | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  // One effect owns loading. It reads the *current* filter/offset when it starts, and the cleanup
  // invalidates the request so a slower, obsolete response can never replace the visible view.
  useEffect(() => {
    let current = true;
    setRows(null);
    setFailure(null);
    listGiftingEnquiries(rpc, { status: filter, limit: PAGE_SIZE, offset })
      .then((result) => {
        if (current) setRows(result);
      })
      .catch((error) => {
        if (current)
          setFailure(
            errorKind(error) === "forbidden" ? "forbidden" : "unavailable",
          );
      });
    return () => {
      current = false;
    };
  }, [rpc, filter, offset, reloadKey]);

  const selectFilter = (next: GiftingEnquiryStatus | null) => {
    setFilter(next);
    setOffset(0);
  };
  const reload = () => setReloadKey((key) => key + 1);

  const change = async (row: GiftingEnquiry, status: GiftingEnquiryStatus) => {
    setBusyId(row.id);
    try {
      await setGiftingEnquiryStatus(rpc, row.id, status);
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
      reload(); // reloads whatever view is active now, not the one captured when the change began
    } catch (error) {
      toast.error(
        errorKind(error) === "forbidden"
          ? "You are not allowed to change enquiries."
          : "The change could not be saved. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Gifting enquiries</CardTitle>
          <CardDescription>
            Contact, corporate, wedding and partnership enquiries received from
            the Gifting website. Contains personal data: administrators only.
            Marketing-only sign-ups never appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter by status"
          >
            <Button
              size="sm"
              variant={filter === null ? "default" : "outline"}
              aria-pressed={filter === null}
              onClick={() => selectFilter(null)}
            >
              All
            </Button>
            {GIFTING_ENQUIRY_STATUSES.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={filter === status ? "default" : "outline"}
                aria-pressed={filter === status}
                onClick={() => selectFilter(status)}
              >
                {STATUS_LABEL[status]}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={reload}
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {failure === "forbidden" ? (
            <p role="alert" className="text-sm text-muted-foreground">
              Only administrators can view Gifting enquiries.
            </p>
          ) : failure === "unavailable" ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>The enquiry queue is unavailable right now.</p>
              <Button size="sm" variant="outline" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : rows === null ? (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Loading enquiries…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No enquiries in this view.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(row.firstReceivedAt).toLocaleString()}
                      {row.receiptCount > 1
                        ? ` · ${row.receiptCount} deliveries`
                        : ""}
                    </TableCell>
                    <TableCell className="capitalize">{row.kind}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{row.name ?? "—"}</div>
                      {row.company ? <div>{row.company}</div> : null}
                      {row.email ? <div>{row.email}</div> : null}
                      {row.phone ? <div>{row.phone}</div> : null}
                      <Badge
                        variant={row.marketingConsent ? "default" : "outline"}
                        className="mt-1"
                      >
                        {row.marketingConsent
                          ? "Marketing consent"
                          : "No marketing consent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm whitespace-pre-wrap text-sm">
                      {row.message ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {GIFTING_ENQUIRY_STATUSES.filter(
                          (status) => status !== row.status,
                        ).map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant="outline"
                            disabled={busyId !== null}
                            onClick={() => void change(row, status)}
                            aria-label={`Mark ${STATUS_LABEL[status].toLowerCase()}: ${row.name ?? row.id}`}
                          >
                            {STATUS_LABEL[status]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {rows !== null &&
          failure === null &&
          (offset > 0 || rows.length === PAGE_SIZE) ? (
            <div
              className="flex items-center gap-2"
              role="navigation"
              aria-label="Pagination"
            >
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {rows.length === 0
                  ? `Page ${offset / PAGE_SIZE + 1}`
                  : `Showing ${offset + 1}–${offset + rows.length}`}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={rows.length < PAGE_SIZE}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
