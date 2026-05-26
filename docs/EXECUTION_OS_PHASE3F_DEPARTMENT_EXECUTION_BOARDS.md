# Execution OS — Phase 3F: Department execution boards

**Target PR:** `feat(execution): add department execution boards and operational workflow surfaces`  
**Branch:** `cursor/phase-3f-department-execution-boards-6c20`

## Mission

First **operational execution surfaces** for departments: kanban-style boards with authority-gated actions via `OperationalExecutionService`, barcode scan flows, photo metadata notes, and read-only audit timelines.

## Boards

| Board | Route | Module | Queues |
|-------|-------|--------|--------|
| Production | `/admin/execution/production` | production | production_queue |
| Assembly | `/admin/execution/assembly` | production | assembly_queue |
| Ready goods | `/admin/execution/ready-goods` | inventory | inventory_verification, retail_followup |
| Dispatch | `/admin/execution/dispatch` | dispatch | dispatch_queue, scan_exception |
| Third party | `/admin/execution/third-party` | orders | retail_followup (3P filter) |
| Retail | `/admin/execution/retail` | inventory | retail_followup, reservation_verification |
| Complaints | `/admin/execution/complaints` | support | customer_support |

## Architecture

- `useDepartmentExecutionBoard` — SELECT + service/scans only; 45s polling
- `src/components/execution/*` — board UI
- `src/lib/operational-media/` — photo metadata → event metadata
- `src/lib/execution-boards/` — config, lanes, authority

## Out of scope

Stock, dispatch completion, finance approval, notifications, AI automation, customer-facing control, direct UI Supabase writes.
