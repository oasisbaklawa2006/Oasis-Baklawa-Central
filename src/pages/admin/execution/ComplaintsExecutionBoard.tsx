import { Navigate } from "react-router-dom";

/** Keep legacy bookmarks on the Support queue, where Core supplies the complaint handoff. */
export default function ComplaintsExecutionBoard() {
  return <Navigate to="/admin/support" replace />;
}
