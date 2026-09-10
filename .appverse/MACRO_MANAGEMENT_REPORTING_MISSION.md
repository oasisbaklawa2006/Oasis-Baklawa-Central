# MACRO MANAGEMENT / REPORTING / COMPLIANCE COMPLETION

Authority: Central #437, #553, #554. This is a product-completion tranche, not a point-audit tranche.

## Mission
Complete the management/finance-control surfaces that a production Appverse needs but which are not adequately represented by raw point closure: executive operational dashboard, financial/collections analytics, governed accounting/Tally export, EAN governance and compliance visibility. Reuse canonical Core/Central facts; never create a parallel finance or inventory ledger.

## Required outcome
### Executive / management command center
- current sales/orders/production/dispatch/collections position
- historical comparisons: same day last week/month/year and configurable comparison windows
- best seller/client/salesperson and trend views
- delay/SLA/exception/risk views
- profitability/recovery/credit-exposure views only where authoritative source facts exist
- forecast indicators clearly distinguished from observed facts
- drill-down to canonical source records with provenance

### Finance reporting / collections
- recoverable vs recovered, ageing buckets, customer exposure, wallet/credit, payment state, disputed/held amounts
- no derived figure may silently override Core Finance truth
- adapter-ready binding to Core Macro Finance #255; fail closed or label unavailable until production-certified contracts exist

### Accounting / Tally handoff
- governed export from canonical financial projections for agreed voucher-compatible/Tally-style formatting
- deterministic period/company filters, source identifiers, debit/credit semantics and audit metadata
- export must not mutate canonical accounting/payment records
- deterministic regeneration and export evidence/history

### EAN / regulatory control visibility
- EAN registry/search/duplicate prevention UI against canonical source where available
- surface legal/FSSAI/label/compliance readiness and missing-data blockers without inventing approvals
- management exception queue for missing/duplicate/non-conforming records

### Reporting governance
- company/role scoped; management/finance-only sensitive metrics
- bounded queries/pagination, no unrestricted cross-company data
- explicit observed vs forecast vs unavailable semantics
- export/audit provenance and deterministic calculation tests
- responsive PC/mobile management views; TV only if existing read-only authority supports it

## Execution rules
1. Census current main and reuse existing dashboards/reports rather than duplicate them.
2. Absorb useful existing reporting/finance/admin code from open Central branches only when semantically sound.
3. Build missing runtime/UI/reporting; do not stop at a gap report.
4. Core #255 may still be in development: bind through a narrow adapter/contract and fail closed where production authority is not yet available. Do not invent backend truth.
5. Keep this PR free of Core migrations and module-specific operational mutations owned by CRM/OPS macros.
6. Batch defects and review findings. No micro PRs.
7. Run unit/typecheck/build/browser role tests/export determinism/scanners on exact head.

## Exit
A management/finance user has one governed command center for operational and financial oversight, can produce deterministic accounting/Tally-style exports and review EAN/compliance exceptions, with every metric traceable to canonical source authority and explicit upstream blockers where Core #255 is not yet production-certified.