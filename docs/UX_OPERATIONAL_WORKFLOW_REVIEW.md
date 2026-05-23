# Oasis Central — Operational UX workflow review

**Purpose:** Map **role-based workflows** to UX friction (clicks, cognitive load, mobile pain, dangerous actions). This document is **process + UX** only; it does not change backend behavior.  
**Screenshot refs:** Add from `audit-artifacts/screenshots/` or short Loom-style captures when triaging.

### Per-workflow fields

- **Workflow steps** — happy path only unless noted  
- **Screenshot refs** — optional paths  
- **Bottlenecks** — where users stall  
- **Cognitive overload** — too many decisions at once  
- **Excessive clicks** — rough count TBD per audit  
- **Missing confirmations** — destructive or irreversible actions  
- **Mobile pain points** — thumb reach, tables, keyboard  
- **Dangerous actions** — easy mis-taps  
- **Recommended simplifications** — UX-only mitigations  

---

## Order placement

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Catalogue → cart → checkout / submit | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Progressive disclosure; sticky cart summary |

---

## Push to floor

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Admin pool / ops → push / assign | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm modal copy; undo snackbar pattern |

---

## Production allocation

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Production / assembly views | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Role-specific dashboards; reduce parallel tables |

---

## Dispatch packing

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Dispatch / packing / labels | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Scan-first layout; large touch targets on floor tablets |

---

## Finance verification

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Finance board → verify / reject / credit | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Split “read” vs “act” modes; explicit reject reason UX |

---

## WhatsApp routing

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Route / assign / template replies | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Inbox density presets; safe-send double confirm |

---

## Operator inbox

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Thread → context → reply / tag | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Collapsible metadata; quick actions row |

---

## Approvals

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Pending list → detail → approve/deny | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Mobile card list instead of wide table |

---

## Complaint / ticket flow

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Support / exceptions / notifications | TBD | TBD | TBD | TBD | TBD | TBD | TBD | SLA chips; timeline-first layout |

---

## Related docs

- Failure states: `docs/UX_FAILURE_STATE_LIBRARY.md`
- Regression policy: `docs/UX_REGRESSION_POLICY.md`
- Triage board: `docs/UX_TRIAGE_MASTER_BOARD.md`
