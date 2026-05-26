# Phase 3J — Mobile + TV execution UX

Factory-ready responsive shells for department execution boards without new business mutations.

## Components (`src/components/execution/`)

- `ExecutionResponsiveShell` — header, internal banner, network state, panic strip
- `ExecutionBoardMobileView` — stacked cards, lane chips, sticky actions via drawer
- `ExecutionBoardTVView` — read-only `?display=tv` lanes, large type, marquee
- `ExecutionScannerActionPanel` — autofocus, Enter submit, scan warnings
- `ExecutionTouchActionButton` / `ExecutionOperatorConfirmDialog`
- Network, empty, error, skeleton states

## Hook extensions

`useDepartmentExecutionBoard` — `lastLoadedAt`, `isStale`, `versionConflict`, `lastScanResult`, `actionsDisabled`

`useExecutionDisplayMode` — `display=tv` query + mobile breakpoint

## Playwright

- `tests/execution-ux-audit.spec.ts`
- Routes added to `tests/ux-audit.spec.ts`
