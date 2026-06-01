# Phase 24L — Operator Pilot Risk Register

**Scope:** Limited rollout — dispatch, finance, inventory via `/admin/golden-chain-operator`  
**Control baseline:** Phase 24K clean 3-order pilot (SO-2026-000136–138)  
**Review:** Daily during first pilot week; supervisor owns mitigation

| ID | Risk | Likelihood | Impact | Detection | Mitigation | Owner |
|----|------|------------|--------|-----------|------------|-------|
| R1 | **Wrong order selected** — similar SO or customer name | Medium | High | Operator confirms SO on card; supervisor spot audit | Search twice; read company + SO; supervisor checklist §1 | Dispatch lead |
| R2 | **Old route used** — audit boards, order pipeline, dispatch-mgmt | Medium | High | Nav audit; supervisor walk-through | SOP forbids; hide audit nav for operators; train bookmark to wizard | Ops manager |
| R3 | **Payment not cleared** — finance step skipped or bypassed | Low | High | Wizard blocks readiness until finance release | Finance acts only in wizard; daily finance blocker review | Finance head |
| R4 | **Stock unavailable** — reserve/finalize fails | Medium | Medium | Blocker text + balance check | Inventory lead resolves SKU; override reason when policy allows | Store lead |
| R5 | **Scanner mismatch** — gate/carton scan refs wrong | Medium | Medium | Readiness / evidence blockers | Re-scan at gate; fix evidence in wizard prepare step | Dispatch |
| R6 | **User role denied** — reservation or stock action | Medium | Low | Toast + `GOLDEN_CHAIN_RESERVATION_DENIED_MESSAGE` | Hand to store lead or supervisor; no shared passwords | Supervisor |
| R7 | **Order stuck after finalize** — CTA shows Finalize instead of Reserve | Low | Medium | Operator report; SQL lineage vs status | Phase 24K drift normalization; refresh once; eng if recurring | Eng (if repeat) |

---

## Risk detail

### R1 — Wrong order selected

Operators may pick the wrong row from search results when customer names match. Impact: evidence, payment, or stock applied to another SO.

**Mitigation:** Mandatory SO verbal read-back for high-value orders; supervisor daily count reconciliation.

---

### R2 — Old route used

Legacy paths remain in the app for supervisors: dispatch-readiness/completion/finalization (audit), reservation board, stock finalization board, finance-governance (audit), order-management, dispatch-mgmt.

Operators with `shouldHideAdvancedGovernanceNav` do not see `*_audit` items. Execution boards may still appear for roles with `cmd_war_room`.

**Mitigation:** Phase 24L SOP; supervisor audits; do not remove legacy routes in this phase (supervisor investigation only).

---

### R3 — Payment not cleared

Finance release in wizard depends on governed finance bundle. Risk: staff attempt dispatch steps on orders without cleared advance.

**Mitigation:** Wizard derivation order (finance before readiness); finance daily blocker sweep.

---

### R4 — Stock unavailable

Insufficient `inventory_stock_balances` blocks reserve or finalize.

**Mitigation:** Pre-check balances; escalate SKU substitution per inventory policy.

---

### R5 — Scanner mismatch

Prepare-evidence step expects gate/carton scan references aligned with physical scans.

**Mitigation:** Rescan; do not override scan refs without supervisor.

---

### R6 — User role denied

`canReserveStockInGoldenChainWizard` limits reservation create/reserve to authorized roles on `golden_chain_operator` channel. Store-only users may need dispatch-assisted reserve depending on role matrix.

**Mitigation:** Map pilot users to roles with tested access; document handoffs in SOP.

---

### R7 — Order stuck after finalize

Historical bug: UI stuck on **Finalize dispatch** after successful finalize. Phase 24K added reload normalization and optimistic advance to **Reserve stock**.

**Mitigation:** Single refresh; if persistent, supervisor logs SO + screenshot for eng.

---

## Rollout gates

| Gate | Status (24L) |
|------|----------------|
| 24K wizard UAT 3/3 orders | Met |
| Operator SOP published | This pack |
| Supervisor checklist published | This pack |
| Nav: wizard visible to dispatch/finance/inventory | Met (24L nav fix) |
| Nav: audit boards hidden from operators | Met (24A policy) |
| Company-wide rollout | **Not approved** |

---

## Escalation

| Severity | Example | Action |
|----------|---------|--------|
| P0 | Wrong order dispatched / stock deducted | Stop pilot lane; supervisor + eng |
| P1 | Multiple orders stuck same stage | Pause new orders in lane; daily checklist |
| P2 | Single role denial | Reassign step; fix role map |

---

*Phase 24L — 2026-06-01*
