import ThreePgsCommandCentre from "./ThreePgsCommandCentre";
import ThreePgsProcurementOperator from "./ThreePgsProcurementOperator";

export { RECEIVING_CORRELATION_STORAGE_KEY } from "./ThreePgsProcurementOperator";

/**
 * R4.5 route-level composition at the existing canonical 3PGS path.
 *
 * The manager-facing command centre is read-only. The existing operator
 * implementation is preserved byte-for-byte in ThreePgsProcurementOperator,
 * so all mutations continue through the already-governed Core RPC paths.
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
