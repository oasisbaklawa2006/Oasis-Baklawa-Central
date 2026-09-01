import ThreePgsCommandCentre from "./ThreePgsCommandCentre";
import ThreePgsProcurementQueue from "./ThreePgsProcurementQueue";

/**
 * R4.5 route-level composition at the existing canonical 3PGS route.
 *
 * The manager command centre is read-only. The existing procurement queue
 * remains the canonical governed operator implementation and continues to own
 * all mutation calls through Core RPCs.
 */
export default function ThreePgsProcurementQueueComposition() {
  return (
    <div className="space-y-8">
      <ThreePgsCommandCentre />
      <div className="border-t border-border pt-4">
        <ThreePgsProcurementQueue />
      </div>
    </div>
  );
}
