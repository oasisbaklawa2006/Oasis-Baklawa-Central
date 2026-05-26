# Phase 3J staging validation — Mobile + TV execution UX

## Mobile boards

- [ ] Open each department board on phone-width viewport
- [ ] Stacked cards + lane filter chips work
- [ ] Sticky action bar visible; touch targets ≥ 44px
- [ ] Drawer opens full-screen sheet
- [ ] Scanner panel auto-focuses barcode field
- [ ] Acknowledge / Start / Complete require authority

## TV mode (`?display=tv`)

- [ ] Production, assembly, ready-goods, dispatch boards in TV mode
- [ ] No action toolbar or mutation buttons
- [ ] Large typography and lane sections visible
- [ ] Marquee / pressure strip shows counts only (no customer PII)
- [ ] Last refreshed time visible
- [ ] Exit TV link returns to interactive board

## Stale data / conflicts

- [ ] Wait past stale threshold — banner warns before actions
- [ ] Simulate concurrent update — version conflict message
- [ ] Retry refresh clears stale state
- [ ] No automatic write retries without user tap

## Scanner

- [ ] Enter submits scan when carton capability enabled
- [ ] Duplicate / mismatch warnings display
- [ ] Correlation id shown after successful scan
- [ ] No dispatch completion or stock mutation in network tab

## Gating

- [ ] Routes require `cmd_war_room` or department module keys
- [ ] Non-staff cannot access execution boards

## Playwright

```bash
npm run test:ux-audit
npx playwright test tests/execution-ux-audit.spec.ts -c playwright.ux-audit.config.ts --project=iphone-14-pro
```

Artifacts: `audit-artifacts/screenshots/`, `audit-artifacts/videos/`

## Accessibility

- [ ] Status badges include text labels (not color-only)
- [ ] Action buttons have `aria-label`
- [ ] Internal-only banner announced as `role="status"`
