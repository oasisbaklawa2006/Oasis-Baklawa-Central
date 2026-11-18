import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import App from "../App";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "operator-1", email: "operator@example.com" },
    loading: false, role: "ADMIN", companyId: null, profileReady: true,
    hasAppliedB2B: false, profileStatus: "active", isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AdminLayout.tsx", () => ({
  default: () => <div data-testid="admin-layout"><Outlet /></div>,
}));

// Preserve the actual App.tsx route and OperatorInbox component. Mock only
// network-backed children, so the mounted-route path is verified.
vi.mock("@/hooks/useWhatsAppPermissions", () => ({
  useWhatsAppPermissions: () => ({
    loading: false,
    has: (permission: string) => permission === "wa.intake.read" || permission === "wa.intake.triage",
  }),
}));
vi.mock("@/components/whatsapp/OperatorInboxSourceHandoff", () => ({
  OperatorInboxSourceHandoff: () => <div data-testid="source-packet-handoff">Governed lookup</div>,
}));
vi.mock("@/components/whatsapp/workQueue/WhatsAppWorkQueue", () => ({
  WhatsAppWorkQueue: () => <div data-testid="department-work-queue">Queue</div>,
}));
vi.mock("@/components/WhatsAppInbox", () => ({
  default: () => <div data-testid="packet-console">Packet console</div>,
}));
vi.mock("@/components/whatsapp/OperatorInboxWorkspacePersistenceGate", () => ({
  OperatorInboxWorkspacePersistenceGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/integrations/supabase/client", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};
  query.select = () => query;
  query.eq = () => query;
  query.in = () => query;
  query.not = () => query;
  query.order = () => query;
  query.limit = () => query;
  query.maybeSingle = () => Promise.resolve({ data: null, error: null });
  query.then = (resolve: (value: { data: unknown[]; error: null }) => void) => {
    resolve({ data: [], error: null });
  };
  return {
    supabase: {
      from: () => query,
      rpc: (name: string) => Promise.resolve({ data: name === "get_user_role" ? "ADMIN" : null, error: null }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App production Operator Inbox route", () => {
  it("mounts source-to-packet handoff on real /admin/operator-inbox for a read-and-triage operator", async () => {
    window.history.pushState({}, "", "/admin/operator-inbox");
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("source-packet-handoff")).toBeInTheDocument(),
      { timeout: 15000 });
    expect(window.location.pathname).toBe("/admin/operator-inbox");
  }, 30000);

  it("keeps the governed packet deep link in the real route", async () => {
    window.history.pushState({}, "", "/admin/operator-inbox?packet=00000000-0000-4000-8000-000000000001");
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("packet-console")).toBeInTheDocument(),
      { timeout: 15000 });
    expect(screen.queryByTestId("source-packet-handoff")).not.toBeInTheDocument();
  }, 30000);
});
