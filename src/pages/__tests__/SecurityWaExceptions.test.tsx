import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SecurityWaExceptions from "@/pages/SecurityWaExceptions";
import { CLOSURE_ITEMS } from "@/lib/wa-governance/waExceptionClosure";
import { freshDb, makeClient, type FakeDb } from "@/test/waExceptionFake";

const h = vi.hoisted(() => ({ role: "SUPER_ADMIN" as string | null, session: true }));
let db: FakeDb;

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: h.role, user: { id: "operator-1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: new Proxy(
    {},
    {
      get: (_t, prop) => {
        const client = (globalThis as unknown as { __waClient: Record<string, unknown> }).__waClient;
        return client[prop as string];
      },
    },
  ),
}));

const short = (id: string) => id.slice(0, 8);
const resolveCalls = () => db.calls.filter((c) => c.name === "whatsapp_resolve_reconciliation_exception");
const item = (n: number) => screen.getByTestId(`wa-item-${short(CLOSURE_ITEMS[n].exceptionId)}`);

function renderPage() {
  return render(
    <MemoryRouter>
      <SecurityWaExceptions />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  h.role = "SUPER_ADMIN";
  db = freshDb();
  (globalThis as unknown as { __waClient: unknown }).__waClient = makeClient(db);
});

describe("SecurityWaExceptions page", () => {
  it("is unavailable to non-super-admin roles and never calls the database", async () => {
    h.role = "SALES_EXECUTIVE";
    renderPage();
    expect(await screen.findByText(/limited to authorised super-admin/i)).toBeInTheDocument();
    expect(db.calls).toHaveLength(0);
  });

  it("sends a session without a user to sign-in", async () => {
    (globalThis as unknown as { __waClient: Record<string, unknown> }).__waClient = {
      ...makeClient(db),
      auth: { getSession: async () => ({ data: { session: null }, error: null }), mfa: {} },
    };
    renderPage();
    expect(await screen.findByTestId("wa-session-expired")).toBeInTheDocument();
  });

  it("shows exactly the five validated exceptions with evidence and the proposed resolution", async () => {
    renderPage();
    await screen.findByTestId("wa-aal2-ok");
    for (let n = 0; n < 5; n++) {
      const card = await waitFor(() => {
        const el = item(n);
        expect(within(el).getByText("Open")).toBeInTheDocument();
        return el;
      });
      expect(within(card).getByTestId("wa-resolution").textContent).toContain(CLOSURE_ITEMS[n].resolution);
      expect(within(card).getByTestId("wa-checks").textContent).toMatch(/PASS/);
      expect(within(card).getByTestId("wa-checks").textContent).not.toMatch(/FAIL/);
    }
    expect(screen.getAllByText(/Review and close/i)).toHaveLength(5);
  });

  it("is locked without AAL2 and points to the authenticator page; no closing is possible", async () => {
    db.aal = "aal1";
    renderPage();
    const locked = await screen.findByTestId("wa-not-aal2");
    expect(locked.textContent).toMatch(/Closing is locked/);
    expect(within(locked).getByRole("link", { name: /verify authenticator/i })).toHaveAttribute("href", "/security/mfa");
    await waitFor(() => expect(within(item(0)).getByText("Open")).toBeInTheDocument());
    for (const button of screen.getAllByRole("button", { name: /review and close/i })) expect(button).toBeDisabled();
    expect(resolveCalls()).toHaveLength(0);
  });

  it("is locked without wa.intake.close even at AAL2", async () => {
    db.canClose = false;
    renderPage();
    expect((await screen.findByTestId("wa-not-aal2")).textContent).toMatch(/wa\.intake\.close: no/);
    await waitFor(() => expect(within(item(0)).getByText("Open")).toBeInTheDocument());
    for (const button of screen.getAllByRole("button", { name: /review and close/i })) expect(button).toBeDisabled();
  });

  it("reports unreadable session checks as unknown, not denied, and stays locked", async () => {
    db.failProofReads = true;
    renderPage();
    const locked = await screen.findByTestId("wa-not-aal2");
    expect(locked.textContent).toMatch(/could not be read/i);
    expect(locked.textContent).toMatch(/unknown/i);
  });

  it("requires explicit confirmation: nothing is closed until the operator confirms that exact record, and Cancel closes nothing", async () => {
    renderPage();
    await screen.findByTestId("wa-aal2-ok");
    await waitFor(() => expect(within(item(0)).getByText("Open")).toBeInTheDocument());

    fireEvent.click(within(item(0)).getByRole("button", { name: /review and close/i }));
    expect(within(item(0)).getByTestId("wa-confirm").textContent).toContain(short(CLOSURE_ITEMS[0].exceptionId));
    expect(resolveCalls()).toHaveLength(0);

    fireEvent.click(within(item(0)).getByRole("button", { name: /cancel/i }));
    expect(within(item(0)).queryByTestId("wa-confirm")).not.toBeInTheDocument();
    expect(resolveCalls()).toHaveLength(0);

    fireEvent.click(within(item(0)).getByRole("button", { name: /review and close/i }));
    fireEvent.click(within(item(0)).getByRole("button", { name: /confirm: close this exception/i }));
    await waitFor(() => expect(within(item(0)).getByTestId("wa-resolved-info")).toBeInTheDocument());

    expect(resolveCalls()).toEqual([
      { name: "whatsapp_resolve_reconciliation_exception", args: { p_exception_id: CLOSURE_ITEMS[0].exceptionId, p_resolution: CLOSURE_ITEMS[0].resolution } },
    ]);
    expect(within(item(0)).getByTestId("wa-resolved-info").textContent).toMatch(/\(you\)/);
    expect(within(item(0)).getByTestId("wa-resolved-info").textContent).toMatch(/Resolution text matches/);
    // only that one record changed
    for (let n = 1; n < 5; n++) expect(db.exceptions[CLOSURE_ITEMS[n].exceptionId].resolved_at).toBeNull();
    expect(screen.getByTestId("wa-message").textContent).toMatch(/Closed and verified/);
  });

  it("shows a complete audit ledger with the read-back verification and lets the operator copy it", async () => {
    const write = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
    renderPage();
    await screen.findByTestId("wa-aal2-ok");
    await waitFor(() => expect(within(item(4)).getByText("Open")).toBeInTheDocument());
    fireEvent.click(within(item(4)).getByRole("button", { name: /review and close/i }));
    fireEvent.click(within(item(4)).getByRole("button", { name: /confirm: close this exception/i }));
    await waitFor(() => expect(screen.getByTestId("wa-ledger").textContent).toMatch(/READBACK_VERIFIED/));
    const ledger = screen.getByTestId("wa-ledger").textContent ?? "";
    for (const step of ["REVALIDATED", "CLOSE_REQUESTED", "CLOSED", "READBACK_VERIFIED"]) expect(ledger).toContain(step);
    fireEvent.click(screen.getByRole("button", { name: /copy ledger/i }));
    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(String(write.mock.calls[0]?.[0])).toContain(CLOSURE_ITEMS[4].exceptionId);
  });

  it("revalidates at confirmation time: if the evidence changed after the page loaded, nothing is closed", async () => {
    renderPage();
    await screen.findByTestId("wa-aal2-ok");
    await waitFor(() => expect(within(item(1)).getByText("Open")).toBeInTheDocument());
    fireEvent.click(within(item(1)).getByRole("button", { name: /review and close/i }));
    db.messages[CLOSURE_ITEMS[1].packetId] = 5; // the "empty" duplicate packet now holds messages
    fireEvent.click(within(item(1)).getByRole("button", { name: /confirm: close this exception/i }));
    await waitFor(() => expect(screen.getByTestId("wa-message").textContent).toMatch(/Not closed \(REVALIDATION_FAILED\)/));
    expect(resolveCalls()).toHaveLength(0);
    expect(db.exceptions[CLOSURE_ITEMS[1].exceptionId].resolved_at).toBeNull();
    // and the card now shows the failing check, with closing disabled
    await waitFor(() => expect(within(item(1)).getByTestId("wa-checks").textContent).toMatch(/FAIL/));
    expect(within(item(1)).getByRole("button", { name: /review and close/i })).toBeDisabled();
  });

  it("reports an attribution mismatch from the read-back as a failure, not a success", async () => {
    db.attributeTo = "someone-else";
    renderPage();
    await screen.findByTestId("wa-aal2-ok");
    await waitFor(() => expect(within(item(0)).getByText("Open")).toBeInTheDocument());
    fireEvent.click(within(item(0)).getByRole("button", { name: /review and close/i }));
    fireEvent.click(within(item(0)).getByRole("button", { name: /confirm: close this exception/i }));
    await waitFor(() => expect(screen.getByTestId("wa-message").textContent).toMatch(/READBACK_MISMATCH/));
    expect(screen.getByTestId("wa-ledger").textContent).toMatch(/FAILED/);
  });

  it("shows already-resolved exceptions as closed with attribution and offers no action", async () => {
    Object.assign(db.exceptions[CLOSURE_ITEMS[2].exceptionId], { resolved_at: "2026-10-24T07:00:00Z", resolved_by: "operator-1", resolution: CLOSURE_ITEMS[2].resolution });
    renderPage();
    await waitFor(() => expect(within(item(2)).getByText("Closed")).toBeInTheDocument());
    expect(within(item(2)).queryByRole("button", { name: /review and close/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("wa-aal2-ok").textContent).toMatch(/1 of 5 closed/);
  });

  it("never performs a direct table write", async () => {
    renderPage();
    await screen.findByTestId("wa-aal2-ok");
    await waitFor(() => expect(within(item(3)).getByText("Open")).toBeInTheDocument());
    fireEvent.click(within(item(3)).getByRole("button", { name: /review and close/i }));
    fireEvent.click(within(item(3)).getByRole("button", { name: /confirm: close this exception/i }));
    await waitFor(() => expect(within(item(3)).getByText("Closed")).toBeInTheDocument());
    expect(db.writes).toEqual([]);
  });
});
