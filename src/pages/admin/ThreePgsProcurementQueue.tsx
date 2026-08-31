import ThreePgsCommandCentre from "@/pages/admin/ThreePgsCommandCentre";
import ThreePgsProcurementOperator from "@/pages/admin/ThreePgsProcurementOperator";

/**
 * Canonical R4.5 3PGS command surface.
 *
 * The command centre composes canonical read-side truth while the preserved
 * operator queue continues to own all existing governed procurement,
 * reservation, issue/acknowledgement and receipt actions. No mutation authority
 * is duplicated here.
 */
export default function ThreePgsProcurementQueue() {
  return (
    <div className="space-y-8">
      <ThreePgsCommandCentre />
      <div className="border-t border-border pt-4">
        <ThreePgsProcurementOperator />
      </div>
    </div>
  );
}
