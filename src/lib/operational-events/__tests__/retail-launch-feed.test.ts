import { describe, expect, it } from "vitest";
import { buildRetailLaunchOperationalFeed, filterRetailLaunchTimelineEvents, type RetailLaunchReservationInput } from "@/lib/operational-events/retailLaunchFeed";
import { RetailLaunchOperationalEventKind } from "@/lib/operational-events/types";

const EM_DASH = "\u2014";

function baseReservation(overrides: Partial<RetailLaunchReservationInput>): RetailLaunchReservationInput {
  return {
    id: "res-1",
    customerName: "A",
    phone: "1",
    storeName: "S",
    productLabel: "P",
    qtyDisplay: "2",
    pickupDisplay: "",
    notes: "",
    status: "draft_only",
    ...overrides,
  };
}

describe("buildRetailLaunchOperationalFeed", () => {
  it("emits reservation draft with null occurredAt (projection-only)", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [baseReservation({ pickupDisplay: "" })],
      factoryFollowups: [],
      labelPreviews: [],
      nowMs: 0,
    });
    const draft = events.find((e) => e.kind === RetailLaunchOperationalEventKind.RESERVATION_DRAFT);
    expect(draft?.occurredAt).toBeNull();
    expect(draft?.id).toBe("retail-launch:res:res-1:draft");
  });

  it("does not emit pickup_expected when pickup datetime is missing (empty)", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [baseReservation({ pickupDisplay: "" })],
      factoryFollowups: [],
      labelPreviews: [],
      nowMs: 0,
    });
    expect(events.some((e) => e.kind === RetailLaunchOperationalEventKind.PICKUP_EXPECTED)).toBe(false);
    expect(events.some((e) => e.kind === RetailLaunchOperationalEventKind.PICKUP_OVERDUE)).toBe(false);
  });

  it("does not emit pickup_expected for em dash placeholder", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [baseReservation({ pickupDisplay: EM_DASH })],
      factoryFollowups: [],
      labelPreviews: [],
      nowMs: 0,
    });
    expect(events.some((e) => e.kind === RetailLaunchOperationalEventKind.PICKUP_EXPECTED)).toBe(false);
  });

  it("does not emit pickup_expected for non-parseable pickup text", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [baseReservation({ pickupDisplay: "n/a" })],
      factoryFollowups: [],
      labelPreviews: [],
      nowMs: 0,
    });
    expect(events.some((e) => e.kind === RetailLaunchOperationalEventKind.PICKUP_EXPECTED)).toBe(false);
    expect(events.some((e) => e.kind === RetailLaunchOperationalEventKind.PICKUP_OVERDUE)).toBe(false);
  });

  it("emits pickup_expected when pickup is a valid parseable datetime", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [baseReservation({ pickupDisplay: "2099-01-01T00:00:00.000Z" })],
      factoryFollowups: [],
      labelPreviews: [],
      nowMs: 0,
    });
    expect(events.some((e) => e.kind === RetailLaunchOperationalEventKind.PICKUP_EXPECTED)).toBe(true);
  });

  it("does not put stock quantities on events (qty is display text only in detail)", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [baseReservation({ pickupDisplay: "n/a", qtyDisplay: "operator-entered" })],
      factoryFollowups: [],
      labelPreviews: [],
      nowMs: 0,
    });
    const draft = events.find((e) => e.kind === RetailLaunchOperationalEventKind.RESERVATION_DRAFT);
    expect(draft?.detail).toContain("operator-entered");
    expect(draft?.detail).toContain("Qty (text)");
  });

  it("filters channels deterministically", () => {
    const events = buildRetailLaunchOperationalFeed({
      reservations: [
        {
          id: "r1",
          customerName: "X",
          phone: "",
          storeName: "Y",
          productLabel: "Z",
          qtyDisplay: "1",
          pickupDisplay: "2099-01-01T00:00",
          notes: "",
          status: "draft_only",
        },
      ],
      factoryFollowups: [],
      labelPreviews: [{ id: "l1", labelKind: "reservation", context: "r1" }],
      nowMs: 0,
    });
    const labels = filterRetailLaunchTimelineEvents(events, "label");
    expect(labels.every((e) => e.kind === RetailLaunchOperationalEventKind.LABEL_PREVIEW_GENERATED)).toBe(true);
    const pickups = filterRetailLaunchTimelineEvents(events, "pickup");
    expect(pickups.length).toBeGreaterThan(0);
  });
});
