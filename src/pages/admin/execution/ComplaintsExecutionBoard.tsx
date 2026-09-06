import { Navigate } from "react-router-dom";

/**
 * Legacy execution-board URL retained only as a bookmark compatibility path.
 * The former DepartmentExecutionBoard projection read operational_queue_items,
 * which has no proven customer-support queue writer. Redirect to the governed
 * support surface (support_tickets authority) instead of dead projection data.
 */
export default function ComplaintsExecutionBoard() {
  return <Navigate to="/admin/support" replace />;
}
