import { Badge } from "@/components/ui/badge";
import type { BoardReservationIndicator } from "@/lib/inventory-reservations/reservationProjection";

const STYLES: Record<BoardReservationIndicator, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  none: { label: "", variant: "outline" },
  reserved: { label: "Reserved", variant: "default" },
  partial: { label: "Partial reserve", variant: "secondary" },
  blocked: { label: "Reserve blocked", variant: "destructive" },
  shortage: { label: "Reserve shortage", variant: "destructive" },
  expired: { label: "Reserve expired", variant: "outline" },
};

export function ExecutionReservationBadge({ indicator }: { indicator: BoardReservationIndicator }) {
  if (indicator === "none") return null;
  const cfg = STYLES[indicator];
  return (
    <Badge variant={cfg.variant} className="text-[10px]" aria-label={`Inventory ${cfg.label}`}>
      {cfg.label}
    </Badge>
  );
}
