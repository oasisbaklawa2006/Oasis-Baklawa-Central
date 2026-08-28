import { Navigate } from "react-router-dom";

/**
 * Legacy execution-board URL retained only as a bookmark compatibility path.
 * The former DepartmentExecutionBoard projection read operational_queue_items,
 * which has no proven 3PGS writer. Redirect to the live governed 3PGS queue
 * instead of presenting dead data as operational truth.
 */
export default function ThirdPartyExecutionBoard() {
  return <Navigate to="/admin/3pgs-procurement-queue" replace />;
}
