import { describe, expect, it } from "vitest";
import {
  DEPARTMENT_QUEUE_ROUTING,
  blockedPrerequisiteLanes,
  buildQueueIdempotencyKey,
  canonicalReadableLanes,
  isTerminalQueueStatus,
  laneByKey,
  laneByLegacyBoard,
} from "../departmentQueueRoutingContract";

describe("departmentQueueRoutingContract (Point86)", () => {
  it("census covers every legacy department execution board", () => {
    const boardIds = [
      "production",
      "assembly",
      "ready-goods",
      "dispatch",
      "third-party",
      "retail",
      "complaints",
    ];
    for (const boardId of boardIds) {
      expect(laneByLegacyBoard(boardId), `missing lane for ${boardId}`).toBeDefined();
    }
  });

  it("has no duplicate lane keys", () => {
    const keys = DEPARTMENT_QUEUE_ROUTING.map((lane) => lane.laneKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks production, assembly, dispatch and 3PGS as legacy redirect with Core producer", () => {
    for (const key of ["production", "assembly", "dispatch", "third_party"]) {
      const lane = laneByKey(key);
      expect(lane?.disposition).toBe("LEGACY_REDIRECT");
      expect(lane?.coreProducerAuthority).toBeTruthy();
    }
  });

  it("fails closed on retail and complaints auto-creation prerequisites", () => {
    const blocked = blockedPrerequisiteLanes();
    expect(blocked.map((l) => l.laneKey).sort()).toEqual(["complaints", "retail"]);
    for (const lane of blocked) {
      expect(lane.coreProducerAuthority).toBeNull();
      expect(lane.blockedPrerequisite).toMatch(/Core/);
    }
  });

  it("builds deterministic idempotency keys from source row id", () => {
    const lane = laneByKey("production")!;
    expect(buildQueueIdempotencyKey(lane, "job-abc")).toBe("production_job:job-abc");
    expect(buildQueueIdempotencyKey(lane, "job-abc")).toBe(buildQueueIdempotencyKey(lane, "job-abc"));
  });

  it("treats terminal statuses as closed — stale work must not reappear", () => {
    const production = laneByKey("production")!;
    expect(isTerminalQueueStatus(production, "completed")).toBe(true);
    expect(isTerminalQueueStatus(production, "pending")).toBe(false);
    const dispatch = laneByKey("dispatch")!;
    expect(isTerminalQueueStatus(dispatch, "gate_released")).toBe(true);
    expect(isTerminalQueueStatus(dispatch, "packing")).toBe(false);
  });

  it("separates Point86 queue routing from Point87/88 execution actions", () => {
    for (const lane of DEPARTMENT_QUEUE_ROUTING) {
      expect(lane.canonicalRoute).toBeTruthy();
      expect(lane.lifecycleStatusField).toBeTruthy();
      expect(lane.priorityProvenance).toBeTruthy();
      // Point86 is read/routing only — producer authority is Core-side or absent
      expect(
        lane.coreProducerAuthority === null ||
          lane.coreProducerAuthority.includes("oasis-supabase-core") ||
          lane.coreProducerAuthority.includes("governed"),
      ).toBe(true);
    }
  });

  it("readable lanes exclude blocked prerequisites", () => {
    const readable = canonicalReadableLanes();
    expect(readable.some((l) => l.laneKey === "retail")).toBe(false);
    expect(readable.some((l) => l.laneKey === "complaints")).toBe(false);
    expect(readable.some((l) => l.laneKey === "production")).toBe(true);
  });

  it("uses canonical Core relations only — no operational_queue_items", () => {
    for (const lane of DEPARTMENT_QUEUE_ROUTING) {
      expect(lane.canonicalRelation).not.toBe("operational_queue_items");
    }
  });
});
