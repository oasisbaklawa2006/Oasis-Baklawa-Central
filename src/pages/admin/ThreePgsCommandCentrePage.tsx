import ThreePgsCommandCentre from "./ThreePgsCommandCentre";
import ThreePgsProcurementQueue from "./ThreePgsProcurementQueue";

/**
 * R4.5 route-level composition only.
 *
 * The existing procurement queue remains the governed operator implementation
 * at its canonical path. This page adds the manager-facing read-only command
 * centre without copying or replacing any mutation authority.
 */
export default function ThreePgsCommandCentrePage() {
  return (
    <div className="space-y-8">
      <ThreePgsCommandCentre />
      <div className="border-t border-border pt-4">
        <ThreePgsProcurementQueue />
      </div>
    </div>
  );
}
