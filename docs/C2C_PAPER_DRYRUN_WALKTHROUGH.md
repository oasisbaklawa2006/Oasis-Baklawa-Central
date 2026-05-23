# C2C — Paper dry-run walkthrough

**No runtime execution occurred during this walkthrough.**  
This document is a **desk / tabletop narrative** only. It does not start workers, call Edge, or touch databases.

---

## Scenario (paper)

An **operator** receives a **packet** in the inbox UI. The system **classifies** intent and **suggests** a route. A **dry-run proposal** is generated. An **audit event** is recorded on paper. A **replay ID** is attached on paper. **Rollback** is prepared on paper. The **queue remains disabled**. **No real send** occurs.

---

## Step 1 — Operator receives packet

| Dimension | Content |
|-----------|---------|
| Intended future action | Load open packets from DB (read path). |
| Required evidence | Screenshot or query plan of SELECT only (future real run). |
| Required observability | `packet_list_load_ms` (future). |
| Replay implications | Read-only; replay safe but wasteful. |
| Rollback implications | N/A for read. |
| Freeze state | **Production write freeze ACTIVE**; **staging execution NOT authorized**. |
| Still forbidden | Any outbound provider call; any queue enqueue. |

---

## Step 2 — Packet classified (suggest)

| Dimension | Content |
|-----------|---------|
| Intended future action | Edge or client calls classify; **suggestion** returned, not persisted routing. |
| Required evidence | JSON body of suggestion + correlation id (future). |
| Required observability | Span `classify.suggest` (future). |
| Replay implications | Replayed classify should be idempotent or cheap (design target). |
| Rollback implications | Discard suggestion state in UI. |
| Freeze state | **No execute authority** for routing. |
| Still forbidden | Auto-write routing to DB without GO. |

---

## Step 3 — Route suggested

| Dimension | Content |
|-----------|---------|
| Intended future action | Return routing **decision** object to UI only. |
| Required evidence | Same as classify + version id of packet (future). |
| Required observability | Span `route.suggest`. |
| Replay implications | Duplicate suggestion acceptable if read-only. |
| Rollback implications | Clear UI state. |
| Freeze state | **Staging execution freeze** — no worker applies route. |
| Still forbidden | Persisted route without locks and audit. |

---

## Step 4 — Dry-run proposal generated (paper)

| Dimension | Content |
|-----------|---------|
| Intended future action | Build `C2CDryRunOperatorActionProposal`-shaped record **on paper**. |
| Required evidence | Printed JSON matching `src/types/c2cDryRunContracts.ts` shape. |
| Required observability | Paper field: “would emit `dryrun_received`”. |
| Replay implications | Same idempotency key → same logical proposal id (design). |
| Rollback implications | Mark paper state `aborted`. |
| Freeze state | **`ENABLE_DRY_RUN_EXECUTION: false`** in repo constants. |
| Still forbidden | Calling `send-whatsapp` or any provider. |

---

## Step 5 — Audit event recorded (paper)

| Dimension | Content |
|-----------|---------|
| Intended future action | Append audit row in real system (future). |
| Required evidence | Paper row: `audit_sim_id`, `correlation_id`, `eventType=intent_recorded`. |
| Required observability | “Would write structured log line” on paper. |
| Replay implications | Replayed audit append must dedupe by hash (design). |
| Rollback implications | Append `rollback_marked` row; never delete (design). |
| Freeze state | No DB write in this tabletop. |
| Still forbidden | Silent delete of audit. |

---

## Step 6 — Replay ID attached (paper)

| Dimension | Content |
|-----------|---------|
| Intended future action | Attach `replay_nonce` with TTL in real request (future). |
| Required evidence | Paper shows nonce + expiry time. |
| Required observability | Log `replay.accepted` or `replay.rejected`. |
| Replay implications | Core of test matrix. |
| Rollback implications | Nonce expiry → reject replay. |
| Freeze state | No HTTP traffic in tabletop. |
| Still forbidden | Accepting requests without TTL. |

---

## Step 7 — Rollback prepared (paper)

| Dimension | Content |
|-----------|---------|
| Intended future action | Document kill switch owner and steps (real drill later). |
| Required evidence | Paper checklist signed by Ops (future: real drill log). |
| Required observability | “Would page if rollback SLO missed” on paper. |
| Replay implications | Rollback request must be idempotent (design). |
| Rollback implications | Practice only on paper here. |
| Freeze state | **All execution flags remain false.** |
| Still forbidden | “We’ll figure out rollback during incident.” |

---

## Step 8 — Queue remains disabled

| Dimension | Content |
|-----------|---------|
| Intended future action | `QUEUE` / worker stays off until GO. |
| Required evidence | Paper: `depth=0`, `state=disabled`, matches `C2C_EXECUTION_FLAGS`. |
| Required observability | Gauge `queue_depth` = 0 (future). |
| Replay implications | No queue → no queue replay class. |
| Rollback implications | N/A. |
| Freeze state | **`ENABLE_QUEUE_PROCESSING: false`**. |
| Still forbidden | Browser outbox processing for pilot class. |

---

## Step 9 — NO real send occurs

| Dimension | Content |
|-----------|---------|
| Intended future action | **None** — terminal step of paper run. |
| Required evidence | Paper attestation: “zero provider API calls.” |
| Required observability | Egress log empty (future). |
| Replay implications | N/A without send. |
| Rollback implications | N/A. |
| Freeze state | **`ENABLE_REAL_SENDS: false`**, **`ENABLE_STAGING_SENDS: false`**. |
| Still forbidden | Any “hello world” message to a real handset without sandbox charter. |

---

## Explicit statement

**No runtime execution occurred during this walkthrough.**  
When repeating this exercise, do **not** connect laptops to staging APIs unless the **pre-pilot GO** is complete.

---

## Cross-links

- `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`  
- `C2C_FIRST_STAGING_DRYRUN_PILOT.md`  
- `C2C_EXECUTION_FREEZE_MANIFEST.md`
