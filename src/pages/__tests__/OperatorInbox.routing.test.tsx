import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

let permissions = new Set<string>(["wa.intake.read", "wa.intake.triage"]);
let permissionsLoading = false;

vi.mock("@/hooks/useWhatsAppPermissions", () => ({
  useWhatsAppPermissions: () => ({ loading: permissionsLoading, has: (key: string) => permissions.has(key) }),
}));
vi.mock("@/components/WhatsAppInbox", () => ({ default: () => <div data-testid="full-console">console</div> }));
vi.mock("@/components/whatsapp/OperatorInboxWorkspacePersistenceGate", () => ({
  OperatorInboxWorkspacePersistenceGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/whatsapp/workQueue/WhatsAppWorkQueue", () => ({
  WhatsAppWorkQueue: ({ canViewAllConversations }: { canViewAllConversations: boolean }) => (
    <div data-testid="work-queue" data-can-view-all={String(canViewAllConversations)}>
      queue
    </div>
  ),
}));

import OperatorInbox from "@/pages/OperatorInbox";

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/operator-inbox" element={<OperatorInbox />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  permissions = new Set(["wa.intake.read", "wa.intake.triage"]);
  permissionsLoading = false;
});

describe("OperatorInbox routing", () => {
  it("defaults to the work queue", () => {
    renderAt("/admin/operator-inbox");
    expect(screen.getByTestId("work-queue")).toBeInTheDocument();
    expect(screen.queryByTestId("full-console")).not.toBeInTheDocument();
  });

  it("keeps existing ?packet= deep links on the full console, for any reader", () => {
    renderAt("/admin/operator-inbox?packet=abc");
    expect(screen.getByTestId("full-console")).toBeInTheDocument();
    expect(screen.getByText("Back to work queue")).toBeInTheDocument();
  });

  it("allows All Conversations for assigners and closers", () => {
    permissions = new Set(["wa.intake.read", "wa.intake.assign"]);
    renderAt("/admin/operator-inbox?view=all");
    expect(screen.getByTestId("full-console")).toBeInTheDocument();
  });

  it("sends frontline staff who ask for All Conversations back to the queue", () => {
    renderAt("/admin/operator-inbox?view=all");
    expect(screen.getByTestId("work-queue")).toBeInTheDocument();
    expect(screen.queryByTestId("full-console")).not.toBeInTheDocument();
  });

  it("tells the queue whether the viewer may open All Conversations", () => {
    permissions = new Set(["wa.intake.read", "wa.intake.close"]);
    renderAt("/admin/operator-inbox");
    expect(screen.getByTestId("work-queue")).toHaveAttribute("data-can-view-all", "true");
  });
});
