import { Navigate } from "react-router-dom";

/**
 * Legacy execution-board URL retained only as a bookmark compatibility path.
 * The former DepartmentExecutionBoard projection read operational_queue_items,
 * which has no proven Dispatch writer. Redirect to the FACT-C3 governed
 * Dispatch Management surface (consignment → carton → DPL) instead of
 * presenting dead data as operational truth.
 */
export default function DispatchExecutionBoard() {
  return <Navigate to="/admin/dispatch-mgmt" replace />;
}
