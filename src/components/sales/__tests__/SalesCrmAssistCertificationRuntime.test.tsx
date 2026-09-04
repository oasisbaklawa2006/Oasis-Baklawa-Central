import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ClientInteractionsTab from "../ClientInteractionsTab";
import SalesCrmAssistPanel from "../crm-lite/SalesCrmAssistPanel";
import SalesCrmLiteWorkspace from "../crm-lite/SalesCrmLiteWorkspace";
import type { CrmLiteCompany } from "@/lib/crm-lite/salesCrmLiteTypes";

const EXEC_ID = "exec-assist";

const companyStub = (id: string, business_name: string): CrmLiteCompany => ({
  id,
  business_name,
  gst_number: null,
  status: "approved",
  wallet_balance: null,
  credit_limit: 0,
  current_balance: 0,
  allow_credit: false,
  created_at: "2026-01-01T00:00:00Z",
  price_tier: null,
  discount_percentage: null,
});

const COMPANY_A = companyStub("co-a", "Alpha Traders");
const COMPANY_B = companyStub("co-b", "Beta Foods");

type EqCall = { column: string; value: unknown };

const { interactionsCapture, createInteractionsMock } = vi.hoisted(() => {
  const capture = { eqCalls: [] as EqCall[], inserted: [] as Record<string, unknown>[] };

  function chainable() {
    const result = { data: [] as unknown[], error: null as null };
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

  function createMock() {
    return {
      from: () => chainable(),
    };
  }

  return { interactionsCapture: capture, createInteractionsMock: createMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createInteractionsMock(),
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

describe("CRM-lite sales assistance certification — executive-scoped reads", () => {
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

    expect(screen.getByTestId("sales-crm-assist-panel")).toBeInTheDocument();
    await waitFor(() => {
      expect(interactionsCapture.eqCalls).toContainEqual({ column: "executive_id", value: EXEC_ID });
    });
  });
});

describe("CRM-lite sales assistance certification — roster deep-link", () => {
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
