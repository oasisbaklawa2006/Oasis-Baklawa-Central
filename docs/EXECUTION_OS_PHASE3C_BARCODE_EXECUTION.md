# Execution OS — Phase 3C: Barcode execution + scan verification

**Target PR:** `feat(execution): add barcode execution and scan verification engine`  
**Branch:** `cursor/phase-3c-barcode-execution-6c20`  
**Depends on:** PR #105, #106, #107 merged; `20260525230000_execution_os_phase3a3d_foundation.sql` + `20260526010000_execution_os_phase3c_barcode_execution.sql` validated in staging

## Mission

Audited physical-execution traceability: immutable scan evidence, barcode verification, mismatch/duplicate detection, gate and handoff verification foundations, operational event linkage — **without** stock, dispatch completion, finance, or customer exposure.

## Scan model

Table: `operational_scan_records` (append-only)

| Field | Purpose |
|-------|---------|
| `scan_type` | order, carton, department_handoff, ready_goods_intake, dispatch_gate, assembly_handoff |
| `verification_type` | identity_match, gate_check, handoff_check, intake_check |
| `verification_status` | scanned, verified, mismatch, duplicate, rejected, escalated |
| `correlation_id` / `idempotency_key` | Trace + replay safety |

## Service API (`src/lib/barcode-execution/`)

| Method | Authority | Notes |
|--------|-----------|-------|
| `verifyOrderBarcode` | `scan:verify` | Expected barcode required |
| `verifyCartonBarcode` | `scan:verify` | |
| `verifyDepartmentHandoff` | `scan:handoff` | |
| `verifyReadyGoodsIntake` | `scan:verify` | |
| `verifyDispatchGateScan` | `scan:gate` | Foundation only — no gate release |
| `verifyAssemblyHandoff` | `scan:handoff` | |
| `rejectScan` | `scan:reject` | Typed reason required |
| `escalateScan` | `scan:escalate` | Typed reason required |
| `attachPhotoEvidenceMetadata` | `scan:verify` | `photo_evidence_url` on record |

Every action: **insert scan** + **append operational_event** (visibility `internal`).

## Event types (Phase 3C)

`scan_recorded`, `scan_verified`, `scan_mismatch`, `scan_duplicate`, `gate_scan_verified`, `gate_scan_rejected`, `department_handoff_verified`, `department_handoff_failed`

## Preview UI

`/admin/barcode-execution-preview` — `cmd_war_room` module; writes limited to operations/dispatch/production roles (see `useBarcodeExecution`).

## Out of scope

Stock deduction/reservation, dispatch completion, invoices, payments, customer timeline, notifications, Edge/packages, hidden automation.
