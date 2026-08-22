import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, PackageSearch, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for `b2b_3pgs_packing_material_catalogue` and
// `inventory_reservations`, pending regenerated project-wide Supabase
// definitions -- same escape hatch pattern as ReadyGoodsStore.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const catalogueDb = supabase as unknown as { from: (relation: string) => any };

type CatalogueItem = {
  product_id: string;
  sku: string;
  product_name: string | null;
  description: string | null;
  image_url: string | null;
  pack_size: string | null;
  uom: string | null;
  available_qty: number;
  reserved_qty: number;
  availability_status: "available" | "unavailable";
  lead_time_expected_at: string | null;
};

type Booking = {
  id: string;
  sku: string;
  requested_qty: number;
  reserved_qty: number;
  reservation_status: string;
  source_department: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * Central issue #368 Phase 4B: internal 3PGS packing-material catalogue and
 * booking screen for authorised managers/staff -- NOT the 3PGS store
 * execution screen (ThirdPartyStore.tsx) and NOT a catalogue of every item
 * 3PGS holds. Scoped to `b2b_3pgs_packing_material_catalogue`, which already
 * excludes bought-out/third-party finished goods (item_class =
 * sourced_ready_product). Booking calls the governed
 * `book_3pgs_packing_material_requisition` RPC, which itself wraps the
 * canonical `reserve_rgs_stock` authority -- no parallel stock ledger.
 */
export default function ThirdPartyPackingMaterialCatalogue() {
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [bookingItem, setBookingItem] = useState<CatalogueItem | null>(null);
  const [bookingQty, setBookingQty] = useState("");
  const [bookingDept, setBookingDept] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: catalogue, error: catalogueError }, { data: recentBookings, error: bookingsError }] =
        await Promise.all([
          catalogueDb
            .from("b2b_3pgs_packing_material_catalogue")
            .select("*")
            .order("product_name", { ascending: true }),
          catalogueDb
            .from("inventory_reservations")
            .select("id, sku, requested_qty, reserved_qty, reservation_status, source_department, notes, created_at")
            .like("reservation_number", "INT-3PGS:%")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
      if (catalogueError) throw catalogueError;
      if (bookingsError) throw bookingsError;
      setItems((catalogue ?? []) as CatalogueItem[]);
      setBookings((recentBookings ?? []) as Booking[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the packing-material catalogue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.sku.toLowerCase().includes(q) || (item.product_name ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const openBookingDialog = (item: CatalogueItem) => {
    setBookingItem(item);
    setBookingQty("");
    setBookingDept("");
    setBookingNote("");
  };

  const submitBooking = async () => {
    if (!bookingItem) return;
    const qty = Number(bookingQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity to book.");
      return;
    }
    if (!bookingDept.trim()) {
      toast.error("Requesting department is required.");
      return;
    }
    setSubmitting(true);
    try {
      const correlationId = `ui-${bookingItem.product_id}-${crypto.randomUUID()}`;
      const { error: rpcError } = await rgsGovernedRpc.rpc("book_3pgs_packing_material_requisition", {
        p_product_id: bookingItem.product_id,
        p_sku: bookingItem.sku,
        p_requested_qty: qty,
        p_requesting_department: bookingDept.trim(),
        p_correlation_id: correlationId,
        p_purpose_note: bookingNote.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success(`Booking submitted for ${bookingItem.sku}.`);
      setBookingItem(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit the booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <PackageSearch className="h-6 w-6" />
            3PGS Packing Material — Booking
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse and book packing/assembly material held at 3PGS. This is not the 3PGS store execution
            screen and does not list bought-out third-party finished goods.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4" />
            Catalogue
          </CardTitle>
          <Input
            placeholder="Search SKU or name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Pack / UOM</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lead time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={`${item.product_id}-${item.sku}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name ?? item.sku}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : null}
                      <div>
                        <div className="font-medium">{item.product_name ?? item.sku}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-xs">
                    {[item.pack_size, item.uom].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">{item.available_qty}</TableCell>
                  <TableCell>
                    <Badge variant={item.availability_status === "available" ? "default" : "secondary"}>
                      {item.availability_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.lead_time_expected_at
                      ? new Date(item.lead_time_expected_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => openBookingDialog(item)}>
                      Book
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No packing-material items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-xs">{booking.sku}</TableCell>
                  <TableCell>{booking.source_department ?? "—"}</TableCell>
                  <TableCell className="text-right">{booking.requested_qty}</TableCell>
                  <TableCell className="text-right">{booking.reserved_qty}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{booking.reservation_status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{booking.notes ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {booking.created_at ? new Date(booking.created_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && bookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No bookings yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={bookingItem !== null} onOpenChange={(open) => !open && setBookingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book {bookingItem?.product_name ?? bookingItem?.sku}</DialogTitle>
            <DialogDescription>
              Available: {bookingItem?.available_qty ?? 0}. This reserves stock through the canonical
              inventory authority -- it does not create a parallel ledger entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="booking-qty">Quantity</Label>
              <Input
                id="booking-qty"
                type="number"
                min={1}
                value={bookingQty}
                onChange={(event) => setBookingQty(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-dept">Requesting department</Label>
              <Input
                id="booking-dept"
                value={bookingDept}
                onChange={(event) => setBookingDept(event.target.value)}
                placeholder="e.g. Packing & Assembly"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-note">Purpose (optional)</Label>
              <Textarea
                id="booking-note"
                value={bookingNote}
                onChange={(event) => setBookingNote(event.target.value)}
                placeholder="What is this booking for?"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Booking as {user?.email ?? "you"}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingItem(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitBooking()} disabled={submitting}>
              {submitting ? "Booking..." : "Confirm booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
