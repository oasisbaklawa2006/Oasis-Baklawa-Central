import { describe, expect, it } from "vitest";
import {
  createFinanceGovernanceService,
  createInMemoryFinanceEventSink,
} from "@/lib/finance-governance/financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "@/lib/finance-governance/inMemoryFinanceEvidenceStore";
import { FinanceGovernanceError } from "@/lib/finance-governance/financeGovernanceTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import {
  createInMemoryReservationServiceBundle,
  createReservationService,
} from "@/lib/inventory-reservations/reservationService";

const DISPATCH_ROLES = ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const;

const financeInput: FinanceGovernanceInput = {
  orderId: "00000000-0000-4000-8000-000000000201",
  orderValue: 120_000,
  advanceRequired: 40_000,
  advanceVerified: true,
  creditApproved: true,
  openHoldTypes: [],
  reservationReady: true,
  dispatchReadinessGateEligible: true,
  complaintSeverity: "none",
  staleFinanceReview: false,
  manualOverrideCount: 0,
  rejectionCount: 0,
  escalationCount: 0,
};

const reservationInput = {
  orderId: "00000000-0000-4000-8000-000000000010",
  productId: "00000000-0000-4000-8000-000000000020",
  sku: "SKU-A",
  requestedQty: 5,
};

function financeService() {
  const evidence = createInMemoryFinanceEvidenceStore();
  const events = createInMemoryFinanceEventSink();
  return {
    evidence,
    events,
    service: createFinanceGovernanceService({ evidence, events }),
  };
}

describe("Dispatch RBAC — governed finance service boundary", () => {
  it.each(DISPATCH_ROLES)("denies %s finance review with zero evidence/events persisted", async (role) => {
    const { service, evidence, events } = financeService();
    await expect(
      service.startReview(financeInput, {
        correlationId: "dispatch-finance-deny",
        actorUserId: "00000000-0000-4000-8000-000000000099",
        actorRole: role,
      }),
    ).rejects.toThrow(FinanceGovernanceError);

    expect(await evidence.listByOrder(financeInput.orderId)).toHaveLength(0);
    expect(await events.listByOrder(financeInput.orderId)).toHaveLength(0);
  });

  it.each(DISPATCH_ROLES)("denies %s commercial release with zero evidence/events persisted", async (role) => {
    const { service, evidence, events } = financeService();
    await expect(
      service.commercialRelease(financeInput, {
        correlationId: "dispatch-finance-deny",
        actorUserId: "00000000-0000-4000-8000-000000000099",
        actorRole: role,
      }),
    ).rejects.toThrow(FinanceGovernanceError);

    expect(await evidence.listByOrder(financeInput.orderId)).toHaveLength(0);
    expect(await events.listByOrder(financeInput.orderId)).toHaveLength(0);
  });
});

describe("Dispatch RBAC — governed reservation-board service boundary", () => {
  it.each(DISPATCH_ROLES)("denies %s reservation_board create with zero ledger rows", async (role) => {
    const bundle = createInMemoryReservationServiceBundle();
    const service = createReservationService(bundle);

    await expect(
      service.createReservation(reservationInput, {
        correlationId: "dispatch-reservation-deny",
        actorUserId: "00000000-0000-4000-8000-000000000099",
        actorRole: role,
        writeChannel: "reservation_board",
      }),
    ).rejects.toMatchObject({ code: "authority_denied" });

    expect(bundle._store._allReservations()).toHaveLength(0);
    expect(bundle._store._allMovements()).toHaveLength(0);
  });

  it("allows DISPATCH_MANAGER golden_chain_operator reservation create (workflow exception)", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const service = createReservationService(bundle);

    const result = await service.createReservation(reservationInput, {
      correlationId: "dispatch-gco-allow",
      actorUserId: "00000000-0000-4000-8000-000000000099",
      actorRole: "DISPATCH_MANAGER",
      writeChannel: "golden_chain_operator",
    });

    expect(result.reservation.reservationStatus).toBe("pending");
    expect(bundle._store._allReservations()).toHaveLength(1);
  });

  it.each(DISPATCH_ROLES)("denies %s reservation_board reserveInventory after seeded reservation", async (role) => {
    const bundle = createInMemoryReservationServiceBundle();
    const service = createReservationService(bundle);
    const seedCtx = {
      correlationId: "dispatch-reservation-seed",
      actorUserId: "00000000-0000-4000-8000-000000000099",
      actorRole: "SUPER_ADMIN",
      writeChannel: "reservation_board" as const,
    };

    const created = await service.createReservation(reservationInput, seedCtx);
    const reservationCount = bundle._store._allReservations().length;
    const movementCount = bundle._store._allMovements().length;

    const availability = {
      productId: created.reservation.productId,
      sku: created.reservation.sku,
      physicalStock: 100,
      reservedOpen: 0,
      blockedInventory: 0,
      damagedInventory: 0,
      expiredInventory: 0,
      quarantineInventory: 0,
    };

    await expect(
      service.reserveInventory(
        {
          reservationId: created.reservation.id,
          expectedVersion: created.reservation.version,
          reserveQty: 5,
        },
        {
          correlationId: "dispatch-reservation-deny-reserve",
          actorUserId: "00000000-0000-4000-8000-000000000099",
          actorRole: role,
          writeChannel: "reservation_board",
        },
        availability,
      ),
    ).rejects.toMatchObject({ code: "authority_denied" });

    expect(bundle._store._allReservations()).toHaveLength(reservationCount);
    expect(bundle._store._allMovements()).toHaveLength(movementCount);
    const refreshed = await service.getReservation(created.reservation.id);
    expect(refreshed?.reservedQty).toBe(0);
  });
});

/**
 * Central governed service paths fail-closed before persistence. Production
 * PostgREST RLS hardening is certified in
 * tests/dispatch-rbac-rls-characterization.cert.spec.ts after Core #183.
 */
