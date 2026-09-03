import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ClientInteractionsTab from "../ClientInteractionsTab";
import SalesCrmAssistPanel from "../crm-lite/SalesCrmAssistPanel";
import SalesCrmLiteWorkspace from "../crm-lite/SalesCrmLiteWorkspace";

const EXEC_ID = "exec-74";
const COMPANY_A = { id: "co-a", business_name: "Alpha Traders" };
const COMPANY_B = { id: "co-b", business_name: "Beta Foods" };

type EqCall = { column: string; value: unknown };

const { interactionsCapture, createInteractionsMock } = vi.hoisted(() => {
  const capture = { eqCalls: [] as EqCall[], inserted: [] as Record<string, unknown>[] };

  function chainable(resolveData: unknown[] = []) {
    const result = { data: resolveData, error: null as null };
    const promise = Promise.resolve(result);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "in", "order", "limit", "not", "gte", "lte", "eq", "update"]) {
      builder[method] = (...args: unknown[]) => {
        if (method === "eq" && typeof args[0] === "string") {
          capture.eqCalls.push({ column: args[0], value: args[1] });
        }
        return builder;
      };
    }
    builder.then = promise.then.bind(promise);
    builder.catch = promise.catch.bind(promise);
    builder.finally = promise.finally.bind(promise);
    builder.insert = (row: Record<string, unknown>) => {
      capture.inserted.push(row);
      return Promise.resolve({ error: null });
    };
    return builder;
  }

  function createMock(c: typeof capture) {
    return {
      from: (table: string) => {
        if (table === "client_interactions") return chainable();
        return chainable();
      },
    };
  }

  return { interactionsCapture: capture, createInteractionsMock: createMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createInteractionsMock(interactionsCapture),
}));

vi.mock("@/lib/order-authority/creditWalletAuthorityClient", () => ({
  resolveCreditBinding: vi.fn(async () => ({ piId: "pi-1", commercialVersionId: "cv-1" })),
}));

vi.mock("@/components/CreditRequestModal", () => ({
  default: () => null,
}));

beforeEach(() => {
  interactionsCapture.eqCalls.length = 0;
  interactionsCapture.inserted.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Point 74 runtime — executive-scoped interaction reads", () => {
  it("scopes assist timeline fetch to the logged-in executive", async () => {
    render(
      <ClientInteractionsTab
        companies={[COMPANY_A, COMPANY_B]}
        userId={EXEC_ID}
        scopeExecutiveId={EXEC_ID}
      />,
    );

    await waitFor(() => {
      expect(interactionsCapture.eqCalls).toContainEqual({ column: "executive_id", value: EXEC_ID });
    });
  });

  it("wires assist panel to scope reads to the sales executive user id", async () => {
    render(
      <SalesCrmAssistPanel companies={[COMPANY_A]} userId={EXEC_ID} focusCompanyId={COMPANY_A.id} />,
    );

    expect(screen.getByTestId("sales-crm-assist-panel")).toHaveAttribute("data-point", "74");
    await waitFor(() => {
      expect(interactionsCapture.eqCalls).toContainEqual({ column: "executive_id", value: EXEC_ID });
    });
  });
});

describe("Point 74 runtime — assist panel and roster deep-link", () => {
  it("shows focused client banner when roster Open assist preselects a company", () => {
    render(
      <SalesCrmAssistPanel companies={[COMPANY_A, COMPANY_B]} userId={EXEC_ID} focusCompanyId={COMPANY_A.id} />,
    );

    expect(screen.getByText(/CRM-lite sales assistance/i)).toBeInTheDocument();
    expect(screen.getByText(/Assisting: Alpha Traders/i)).toBeInTheDocument();
  });

  it("opens Assist tab with roster client focus when assistFocusCompanyId is set", async () => {
    render(
      <SalesCrmLiteWorkspace userId={EXEC_ID} companies={[COMPANY_A, COMPANY_B]} assistFocusCompanyId={COMPANY_B.id} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^assist$/i })).toHaveAttribute("data-state", "active");
      expect(screen.getByText(/Assisting: Beta Foods/i)).toBeInTheDocument();
    });
  });
});
