import { Navigate } from "react-router-dom";

/**
 * Legacy execution-board URL retained only as a bookmark compatibility path.
 * The former DepartmentExecutionBoard projection read operational_queue_items,
 * which has no proven retail queue writer. Redirect to the governed reservation
 * board instead of presenting dead data as operational truth.
 */
export default function RetailExecutionBoard() {
  return <Navigate to="/admin/reservation-board" replace />;
}
