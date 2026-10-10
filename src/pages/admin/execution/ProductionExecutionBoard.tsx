import { Navigate } from "react-router-dom";

/**
 * Legacy execution-board URL retained only as a bookmark compatibility path.
 * The former DepartmentExecutionBoard projection read operational_queue_items,
 * which has no proven Production writer anywhere in oasis-supabase-core.
 * Redirect to the Point 87 governed PHH surface (production_jobs authority)
 * instead of presenting dead data as operational truth.
 */
export default function ProductionExecutionBoard() {
  return <Navigate to="/operations-controller" replace />;
}
