# UX audit — Playwright (mobile-first)

**Target:** https://cursor-central-vercel.vercel.app  
**Generated:** 2026-05-23T17:14:42.970Z  
**Tooling:** @playwright/test, Chromium emulation (see `playwright.ux-audit.config.ts`; default `playwright.config.ts` is for CI smoke tests).  
**Artifacts:** screenshots under `audit-artifacts/screenshots/`; **videos** (one full journey per viewport): `audit-artifacts/videos/*.webm`; raw JSON under `audit-artifacts/raw/`.

## Executive summary

Automated crawl across discovered internal routes plus the static route manifest from `src/App.tsx`, repeated for **four** viewports (iPhone 14 Pro 390×844, iPhone SE 375×667, iPad 768×1024, desktop 1440×900). Each successfully loaded page captured a **full-page screenshot** (path in raw JSON as `screenshotPath`; omitted when navigation failed before commit). Console warnings/errors and failed XHR/document responses (4xx/5xx) are recorded for loaded pages. Heuristics (overflow, tap targets, `alt`, unnamed buttons, tables) are **skipped** when `checksSkipped` is true so stale DOM from a prior route is never attributed. Auth-protected pages typically redirect to login — screenshots still document that behavior.

## Overall score (heuristic)

**9.5 / 10** — automated deduction for console noise, failed requests, overflow, and accessibility heuristics; not a substitute for human design QA.

## Critical blockers

- _(none detected by automated thresholds)_

## High severity UX / reliability issues

- _(none above noise threshold)_

## Medium polish issues

- iphone-14-pro: /privacy — 7 tap targets < 44px
- iphone-14-pro: /shipping — 7 tap targets < 44px
- iphone-14-pro: /terms — 6 tap targets < 44px
- iphone-se: /privacy — 7 tap targets < 44px
- iphone-se: /shipping — 7 tap targets < 44px
- iphone-se: /terms — 6 tap targets < 44px
- ipad: /privacy — 7 tap targets < 44px
- ipad: /shipping — 7 tap targets < 44px
- ipad: /terms — 6 tap targets < 44px

## Mobile-specific issues

Issues weighted on **iphone-14-pro** and **iphone-se** projects: tap targets < 44px, horizontal overflow, long vertical scroll without sticky nav patterns (not auto-detected). See raw JSON.

## Desktop-specific issues

**desktop** project: overflow and table width issues; tap-target rule less relevant.

## Accessibility issues (heuristic)

- Images missing `alt` (count per page in raw JSON)
- Visible `<button>` without text or `aria-label`
- Full WCAG audit not performed — add axe-core / manual screen reader pass for 10/10 readiness.

## Console / network errors

Aggregated in `audit-artifacts/raw/raw-<project>.json` per page under `consoleErrors`, `consoleWarnings`, `failedRequests`.

## Video walkthrough (full app journey)

| Viewport | File |
|----------|------|
| iphone-14-pro | `audit-artifacts/videos/ux-audit-Mobile-first-full-UX-audit-all-viewports--iphone-14-pro.webm` (3.3 MB) |
| iphone-se | `audit-artifacts/videos/ux-audit-Mobile-first-full-UX-audit-all-viewports--iphone-se.webm` (2.7 MB) |
| ipad | `audit-artifacts/videos/ux-audit-Mobile-first-full-UX-audit-all-viewports--ipad.webm` (2.9 MB) |
| desktop | `audit-artifacts/videos/ux-audit-Mobile-first-full-UX-audit-all-viewports--desktop.webm` (1.8 MB) |

| Viewport | Route | Screenshot file |
|----------|-------|-----------------|
| iphone-14-pro | `/` | `audit-artifacts/screenshots/iphone-14-pro__root.png` |
| iphone-14-pro | `/account` | `audit-artifacts/screenshots/iphone-14-pro__account.png` |
| iphone-14-pro | `/account/addresses` | `audit-artifacts/screenshots/iphone-14-pro__account_addresses.png` |
| iphone-14-pro | `/account/logistics` | `audit-artifacts/screenshots/iphone-14-pro__account_logistics.png` |
| iphone-14-pro | `/account/users` | `audit-artifacts/screenshots/iphone-14-pro__account_users.png` |
| iphone-14-pro | `/admin` | `audit-artifacts/screenshots/iphone-14-pro__admin.png` |
| iphone-14-pro | `/admin/3pcs-store` | `audit-artifacts/screenshots/iphone-14-pro__admin_3pcs-store.png` |
| iphone-14-pro | `/admin/accounts-release` | `audit-artifacts/screenshots/iphone-14-pro__admin_accounts-release.png` |
| iphone-14-pro | `/admin/announcements` | `audit-artifacts/screenshots/iphone-14-pro__admin_announcements.png` |
| iphone-14-pro | `/admin/approvals` | `audit-artifacts/screenshots/iphone-14-pro__admin_approvals.png` |
| iphone-14-pro | `/admin/assembly-tasks` | `audit-artifacts/screenshots/iphone-14-pro__admin_assembly-tasks.png` |
| iphone-14-pro | `/admin/assembly-tv` | `audit-artifacts/screenshots/iphone-14-pro__admin_assembly-tv.png` |
| iphone-14-pro | `/admin/audit` | `audit-artifacts/screenshots/iphone-14-pro__admin_audit.png` |
| iphone-14-pro | `/admin/central-pool` | `audit-artifacts/screenshots/iphone-14-pro__admin_central-pool.png` |
| iphone-14-pro | `/admin/clients` | `audit-artifacts/screenshots/iphone-14-pro__admin_clients.png` |
| iphone-14-pro | `/admin/cmd-war-room` | `audit-artifacts/screenshots/iphone-14-pro__admin_cmd-war-room.png` |
| iphone-14-pro | `/admin/currency` | `audit-artifacts/screenshots/iphone-14-pro__admin_currency.png` |
| iphone-14-pro | `/admin/department` | `audit-artifacts/screenshots/iphone-14-pro__admin_department.png` |
| iphone-14-pro | `/admin/dispatch` | `audit-artifacts/screenshots/iphone-14-pro__admin_dispatch.png` |
| iphone-14-pro | `/admin/dispatch-mgmt` | `audit-artifacts/screenshots/iphone-14-pro__admin_dispatch-mgmt.png` |
| iphone-14-pro | `/admin/dispatch-tv` | `audit-artifacts/screenshots/iphone-14-pro__admin_dispatch-tv.png` |
| iphone-14-pro | `/admin/display-management` | `audit-artifacts/screenshots/iphone-14-pro__admin_display-management.png` |
| iphone-14-pro | `/admin/exceptions` | `audit-artifacts/screenshots/iphone-14-pro__admin_exceptions.png` |
| iphone-14-pro | `/admin/finance` | `audit-artifacts/screenshots/iphone-14-pro__admin_finance.png` |
| iphone-14-pro | `/admin/finance-board` | `audit-artifacts/screenshots/iphone-14-pro__admin_finance-board.png` |
| iphone-14-pro | `/admin/heartbeat` | `audit-artifacts/screenshots/iphone-14-pro__admin_heartbeat.png` |
| iphone-14-pro | `/admin/inventory` | `audit-artifacts/screenshots/iphone-14-pro__admin_inventory.png` |
| iphone-14-pro | `/admin/logistics` | `audit-artifacts/screenshots/iphone-14-pro__admin_logistics.png` |
| iphone-14-pro | `/admin/merchandising` | `audit-artifacts/screenshots/iphone-14-pro__admin_merchandising.png` |
| iphone-14-pro | `/admin/moq` | `audit-artifacts/screenshots/iphone-14-pro__admin_moq.png` |
| iphone-14-pro | `/admin/notifications` | `audit-artifacts/screenshots/iphone-14-pro__admin_notifications.png` |
| iphone-14-pro | `/admin/operations` | `audit-artifacts/screenshots/iphone-14-pro__admin_operations.png` |
| iphone-14-pro | `/admin/operator-inbox` | `audit-artifacts/screenshots/iphone-14-pro__admin_operator-inbox.png` |
| iphone-14-pro | `/admin/order-management` | `audit-artifacts/screenshots/iphone-14-pro__admin_order-management.png` |
| iphone-14-pro | `/admin/orders` | `audit-artifacts/screenshots/iphone-14-pro__admin_orders.png` |
| iphone-14-pro | `/admin/packing-dispatch` | `audit-artifacts/screenshots/iphone-14-pro__admin_packing-dispatch.png` |
| iphone-14-pro | `/admin/pricing` | `audit-artifacts/screenshots/iphone-14-pro__admin_pricing.png` |
| iphone-14-pro | `/admin/production` | `audit-artifacts/screenshots/iphone-14-pro__admin_production.png` |
| iphone-14-pro | `/admin/products` | `audit-artifacts/screenshots/iphone-14-pro__admin_products.png` |
| iphone-14-pro | `/admin/ready-goods` | `audit-artifacts/screenshots/iphone-14-pro__admin_ready-goods.png` |
| iphone-14-pro | `/admin/rgs-tv` | `audit-artifacts/screenshots/iphone-14-pro__admin_rgs-tv.png` |
| iphone-14-pro | `/admin/sales-hub` | `audit-artifacts/screenshots/iphone-14-pro__admin_sales-hub.png` |
| iphone-14-pro | `/admin/settings` | `audit-artifacts/screenshots/iphone-14-pro__admin_settings.png` |
| iphone-14-pro | `/admin/support` | `audit-artifacts/screenshots/iphone-14-pro__admin_support.png` |
| iphone-14-pro | `/admin/target-vs-actual` | `audit-artifacts/screenshots/iphone-14-pro__admin_target-vs-actual.png` |
| iphone-14-pro | `/admin/users` | `audit-artifacts/screenshots/iphone-14-pro__admin_users.png` |
| iphone-14-pro | `/admin/verification` | `audit-artifacts/screenshots/iphone-14-pro__admin_verification.png` |
| iphone-14-pro | `/admin/whatsapp` | `audit-artifacts/screenshots/iphone-14-pro__admin_whatsapp.png` |
| iphone-14-pro | `/approval-pending` | `audit-artifacts/screenshots/iphone-14-pro__approval-pending.png` |
| iphone-14-pro | `/buyer-portal` | `audit-artifacts/screenshots/iphone-14-pro__buyer-portal.png` |
| iphone-14-pro | `/cart` | `audit-artifacts/screenshots/iphone-14-pro__cart.png` |
| iphone-14-pro | `/catalogue` | `audit-artifacts/screenshots/iphone-14-pro__catalogue.png` |
| iphone-14-pro | `/dashboard` | `audit-artifacts/screenshots/iphone-14-pro__dashboard.png` |
| iphone-14-pro | `/documents` | `audit-artifacts/screenshots/iphone-14-pro__documents.png` |
| iphone-14-pro | `/faq` | `audit-artifacts/screenshots/iphone-14-pro__faq.png` |
| iphone-14-pro | `/favorites` | `audit-artifacts/screenshots/iphone-14-pro__favorites.png` |
| iphone-14-pro | `/home` | `audit-artifacts/screenshots/iphone-14-pro__home.png` |
| iphone-14-pro | `/intro` | `audit-artifacts/screenshots/iphone-14-pro__intro.png` |
| iphone-14-pro | `/login` | `audit-artifacts/screenshots/iphone-14-pro__login.png` |
| iphone-14-pro | `/onboarding` | `audit-artifacts/screenshots/iphone-14-pro__onboarding.png` |
| iphone-14-pro | `/operations-controller` | `audit-artifacts/screenshots/iphone-14-pro__operations-controller.png` |
| iphone-14-pro | `/orders` | `audit-artifacts/screenshots/iphone-14-pro__orders.png` |
| iphone-14-pro | `/orders/1` | `audit-artifacts/screenshots/iphone-14-pro__orders_1.png` |
| iphone-14-pro | `/privacy` | `audit-artifacts/screenshots/iphone-14-pro__privacy.png` |
| iphone-14-pro | `/product/1` | `audit-artifacts/screenshots/iphone-14-pro__product_1.png` |
| iphone-14-pro | `/quick-order` | `audit-artifacts/screenshots/iphone-14-pro__quick-order.png` |
| iphone-14-pro | `/register` | `audit-artifacts/screenshots/iphone-14-pro__register.png` |
| iphone-14-pro | `/reset-password` | `audit-artifacts/screenshots/iphone-14-pro__reset-password.png` |
| iphone-14-pro | `/sales/dashboard` | `audit-artifacts/screenshots/iphone-14-pro__sales_dashboard.png` |
| iphone-14-pro | `/security-gate` | `audit-artifacts/screenshots/iphone-14-pro__security-gate.png` |
| iphone-14-pro | `/shipping` | `audit-artifacts/screenshots/iphone-14-pro__shipping.png` |
| iphone-14-pro | `/splash` | `audit-artifacts/screenshots/iphone-14-pro__splash.png` |
| iphone-14-pro | `/terms` | `audit-artifacts/screenshots/iphone-14-pro__terms.png` |
| iphone-14-pro | `/track` | `audit-artifacts/screenshots/iphone-14-pro__track.png` |
| iphone-14-pro | `/tv/arabic-sweets` | `audit-artifacts/screenshots/iphone-14-pro__tv_arabic-sweets.png` |
| iphone-14-pro | `/tv/bakery` | `audit-artifacts/screenshots/iphone-14-pro__tv_bakery.png` |
| iphone-14-pro | `/tv/chocolate` | `audit-artifacts/screenshots/iphone-14-pro__tv_chocolate.png` |
| iphone-14-pro | `/tv/dragees` | `audit-artifacts/screenshots/iphone-14-pro__tv_dragees.png` |
| iphone-14-pro | `/tv/fusion` | `audit-artifacts/screenshots/iphone-14-pro__tv_fusion.png` |
| iphone-14-pro | `/tv/nuts` | `audit-artifacts/screenshots/iphone-14-pro__tv_nuts.png` |
| iphone-14-pro | `/welcome` | `audit-artifacts/screenshots/iphone-14-pro__welcome.png` |
| iphone-se | `/` | `audit-artifacts/screenshots/iphone-se__root.png` |
| iphone-se | `/account` | `audit-artifacts/screenshots/iphone-se__account.png` |
| iphone-se | `/account/addresses` | `audit-artifacts/screenshots/iphone-se__account_addresses.png` |
| iphone-se | `/account/logistics` | `audit-artifacts/screenshots/iphone-se__account_logistics.png` |
| iphone-se | `/account/users` | `audit-artifacts/screenshots/iphone-se__account_users.png` |
| iphone-se | `/admin` | `audit-artifacts/screenshots/iphone-se__admin.png` |
| iphone-se | `/admin/3pcs-store` | `audit-artifacts/screenshots/iphone-se__admin_3pcs-store.png` |
| iphone-se | `/admin/accounts-release` | `audit-artifacts/screenshots/iphone-se__admin_accounts-release.png` |
| iphone-se | `/admin/announcements` | `audit-artifacts/screenshots/iphone-se__admin_announcements.png` |
| iphone-se | `/admin/approvals` | `audit-artifacts/screenshots/iphone-se__admin_approvals.png` |
| iphone-se | `/admin/assembly-tasks` | `audit-artifacts/screenshots/iphone-se__admin_assembly-tasks.png` |
| iphone-se | `/admin/assembly-tv` | `audit-artifacts/screenshots/iphone-se__admin_assembly-tv.png` |
| iphone-se | `/admin/audit` | `audit-artifacts/screenshots/iphone-se__admin_audit.png` |
| iphone-se | `/admin/central-pool` | `audit-artifacts/screenshots/iphone-se__admin_central-pool.png` |
| iphone-se | `/admin/clients` | `audit-artifacts/screenshots/iphone-se__admin_clients.png` |
| iphone-se | `/admin/cmd-war-room` | `audit-artifacts/screenshots/iphone-se__admin_cmd-war-room.png` |
| iphone-se | `/admin/currency` | `audit-artifacts/screenshots/iphone-se__admin_currency.png` |
| iphone-se | `/admin/department` | `audit-artifacts/screenshots/iphone-se__admin_department.png` |
| iphone-se | `/admin/dispatch` | `audit-artifacts/screenshots/iphone-se__admin_dispatch.png` |
| iphone-se | `/admin/dispatch-mgmt` | `audit-artifacts/screenshots/iphone-se__admin_dispatch-mgmt.png` |
| iphone-se | `/admin/dispatch-tv` | `audit-artifacts/screenshots/iphone-se__admin_dispatch-tv.png` |
| iphone-se | `/admin/display-management` | `audit-artifacts/screenshots/iphone-se__admin_display-management.png` |
| iphone-se | `/admin/exceptions` | `audit-artifacts/screenshots/iphone-se__admin_exceptions.png` |
| iphone-se | `/admin/finance` | `audit-artifacts/screenshots/iphone-se__admin_finance.png` |
| iphone-se | `/admin/finance-board` | `audit-artifacts/screenshots/iphone-se__admin_finance-board.png` |
| iphone-se | `/admin/heartbeat` | `audit-artifacts/screenshots/iphone-se__admin_heartbeat.png` |
| iphone-se | `/admin/inventory` | `audit-artifacts/screenshots/iphone-se__admin_inventory.png` |
| iphone-se | `/admin/logistics` | `audit-artifacts/screenshots/iphone-se__admin_logistics.png` |
| iphone-se | `/admin/merchandising` | `audit-artifacts/screenshots/iphone-se__admin_merchandising.png` |
| iphone-se | `/admin/moq` | `audit-artifacts/screenshots/iphone-se__admin_moq.png` |
| iphone-se | `/admin/notifications` | `audit-artifacts/screenshots/iphone-se__admin_notifications.png` |
| iphone-se | `/admin/operations` | `audit-artifacts/screenshots/iphone-se__admin_operations.png` |
| iphone-se | `/admin/operator-inbox` | `audit-artifacts/screenshots/iphone-se__admin_operator-inbox.png` |
| iphone-se | `/admin/order-management` | `audit-artifacts/screenshots/iphone-se__admin_order-management.png` |
| iphone-se | `/admin/orders` | `audit-artifacts/screenshots/iphone-se__admin_orders.png` |
| iphone-se | `/admin/packing-dispatch` | `audit-artifacts/screenshots/iphone-se__admin_packing-dispatch.png` |
| iphone-se | `/admin/pricing` | `audit-artifacts/screenshots/iphone-se__admin_pricing.png` |
| iphone-se | `/admin/production` | `audit-artifacts/screenshots/iphone-se__admin_production.png` |
| iphone-se | `/admin/products` | `audit-artifacts/screenshots/iphone-se__admin_products.png` |
| iphone-se | `/admin/ready-goods` | `audit-artifacts/screenshots/iphone-se__admin_ready-goods.png` |
| iphone-se | `/admin/rgs-tv` | `audit-artifacts/screenshots/iphone-se__admin_rgs-tv.png` |
| iphone-se | `/admin/sales-hub` | `audit-artifacts/screenshots/iphone-se__admin_sales-hub.png` |
| iphone-se | `/admin/settings` | `audit-artifacts/screenshots/iphone-se__admin_settings.png` |
| iphone-se | `/admin/support` | `audit-artifacts/screenshots/iphone-se__admin_support.png` |
| iphone-se | `/admin/target-vs-actual` | `audit-artifacts/screenshots/iphone-se__admin_target-vs-actual.png` |
| iphone-se | `/admin/users` | `audit-artifacts/screenshots/iphone-se__admin_users.png` |
| iphone-se | `/admin/verification` | `audit-artifacts/screenshots/iphone-se__admin_verification.png` |
| iphone-se | `/admin/whatsapp` | `audit-artifacts/screenshots/iphone-se__admin_whatsapp.png` |
| iphone-se | `/approval-pending` | `audit-artifacts/screenshots/iphone-se__approval-pending.png` |
| iphone-se | `/buyer-portal` | `audit-artifacts/screenshots/iphone-se__buyer-portal.png` |
| iphone-se | `/cart` | `audit-artifacts/screenshots/iphone-se__cart.png` |
| iphone-se | `/catalogue` | `audit-artifacts/screenshots/iphone-se__catalogue.png` |
| iphone-se | `/dashboard` | `audit-artifacts/screenshots/iphone-se__dashboard.png` |
| iphone-se | `/documents` | `audit-artifacts/screenshots/iphone-se__documents.png` |
| iphone-se | `/faq` | `audit-artifacts/screenshots/iphone-se__faq.png` |
| iphone-se | `/favorites` | `audit-artifacts/screenshots/iphone-se__favorites.png` |
| iphone-se | `/home` | `audit-artifacts/screenshots/iphone-se__home.png` |
| iphone-se | `/intro` | `audit-artifacts/screenshots/iphone-se__intro.png` |
| iphone-se | `/login` | `audit-artifacts/screenshots/iphone-se__login.png` |
| iphone-se | `/onboarding` | `audit-artifacts/screenshots/iphone-se__onboarding.png` |
| iphone-se | `/operations-controller` | `audit-artifacts/screenshots/iphone-se__operations-controller.png` |
| iphone-se | `/orders` | `audit-artifacts/screenshots/iphone-se__orders.png` |
| iphone-se | `/orders/1` | `audit-artifacts/screenshots/iphone-se__orders_1.png` |
| iphone-se | `/privacy` | `audit-artifacts/screenshots/iphone-se__privacy.png` |
| iphone-se | `/product/1` | `audit-artifacts/screenshots/iphone-se__product_1.png` |
| iphone-se | `/quick-order` | `audit-artifacts/screenshots/iphone-se__quick-order.png` |
| iphone-se | `/register` | `audit-artifacts/screenshots/iphone-se__register.png` |
| iphone-se | `/reset-password` | `audit-artifacts/screenshots/iphone-se__reset-password.png` |
| iphone-se | `/sales/dashboard` | `audit-artifacts/screenshots/iphone-se__sales_dashboard.png` |
| iphone-se | `/security-gate` | `audit-artifacts/screenshots/iphone-se__security-gate.png` |
| iphone-se | `/shipping` | `audit-artifacts/screenshots/iphone-se__shipping.png` |
| iphone-se | `/splash` | `audit-artifacts/screenshots/iphone-se__splash.png` |
| iphone-se | `/terms` | `audit-artifacts/screenshots/iphone-se__terms.png` |
| iphone-se | `/track` | `audit-artifacts/screenshots/iphone-se__track.png` |
| iphone-se | `/tv/arabic-sweets` | `audit-artifacts/screenshots/iphone-se__tv_arabic-sweets.png` |
| iphone-se | `/tv/bakery` | `audit-artifacts/screenshots/iphone-se__tv_bakery.png` |
| iphone-se | `/tv/chocolate` | `audit-artifacts/screenshots/iphone-se__tv_chocolate.png` |
| iphone-se | `/tv/dragees` | `audit-artifacts/screenshots/iphone-se__tv_dragees.png` |
| iphone-se | `/tv/fusion` | `audit-artifacts/screenshots/iphone-se__tv_fusion.png` |
| iphone-se | `/tv/nuts` | `audit-artifacts/screenshots/iphone-se__tv_nuts.png` |
| iphone-se | `/welcome` | `audit-artifacts/screenshots/iphone-se__welcome.png` |
| ipad | `/` | `audit-artifacts/screenshots/ipad__root.png` |
| ipad | `/account` | `audit-artifacts/screenshots/ipad__account.png` |
| ipad | `/account/addresses` | `audit-artifacts/screenshots/ipad__account_addresses.png` |
| ipad | `/account/logistics` | `audit-artifacts/screenshots/ipad__account_logistics.png` |
| ipad | `/account/users` | `audit-artifacts/screenshots/ipad__account_users.png` |
| ipad | `/admin` | `audit-artifacts/screenshots/ipad__admin.png` |
| ipad | `/admin/3pcs-store` | `audit-artifacts/screenshots/ipad__admin_3pcs-store.png` |
| ipad | `/admin/accounts-release` | `audit-artifacts/screenshots/ipad__admin_accounts-release.png` |
| ipad | `/admin/announcements` | `audit-artifacts/screenshots/ipad__admin_announcements.png` |
| ipad | `/admin/approvals` | `audit-artifacts/screenshots/ipad__admin_approvals.png` |
| ipad | `/admin/assembly-tasks` | `audit-artifacts/screenshots/ipad__admin_assembly-tasks.png` |
| ipad | `/admin/assembly-tv` | `audit-artifacts/screenshots/ipad__admin_assembly-tv.png` |
| ipad | `/admin/audit` | `audit-artifacts/screenshots/ipad__admin_audit.png` |
| ipad | `/admin/central-pool` | `audit-artifacts/screenshots/ipad__admin_central-pool.png` |
| ipad | `/admin/clients` | `audit-artifacts/screenshots/ipad__admin_clients.png` |
| ipad | `/admin/cmd-war-room` | `audit-artifacts/screenshots/ipad__admin_cmd-war-room.png` |
| ipad | `/admin/currency` | `audit-artifacts/screenshots/ipad__admin_currency.png` |
| ipad | `/admin/department` | `audit-artifacts/screenshots/ipad__admin_department.png` |
| ipad | `/admin/dispatch` | `audit-artifacts/screenshots/ipad__admin_dispatch.png` |
| ipad | `/admin/dispatch-mgmt` | `audit-artifacts/screenshots/ipad__admin_dispatch-mgmt.png` |
| ipad | `/admin/dispatch-tv` | `audit-artifacts/screenshots/ipad__admin_dispatch-tv.png` |
| ipad | `/admin/display-management` | `audit-artifacts/screenshots/ipad__admin_display-management.png` |
| ipad | `/admin/exceptions` | `audit-artifacts/screenshots/ipad__admin_exceptions.png` |
| ipad | `/admin/finance` | `audit-artifacts/screenshots/ipad__admin_finance.png` |
| ipad | `/admin/finance-board` | `audit-artifacts/screenshots/ipad__admin_finance-board.png` |
| ipad | `/admin/heartbeat` | `audit-artifacts/screenshots/ipad__admin_heartbeat.png` |
| ipad | `/admin/inventory` | `audit-artifacts/screenshots/ipad__admin_inventory.png` |
| ipad | `/admin/logistics` | `audit-artifacts/screenshots/ipad__admin_logistics.png` |
| ipad | `/admin/merchandising` | `audit-artifacts/screenshots/ipad__admin_merchandising.png` |
| ipad | `/admin/moq` | `audit-artifacts/screenshots/ipad__admin_moq.png` |
| ipad | `/admin/notifications` | `audit-artifacts/screenshots/ipad__admin_notifications.png` |
| ipad | `/admin/operations` | `audit-artifacts/screenshots/ipad__admin_operations.png` |
| ipad | `/admin/operator-inbox` | `audit-artifacts/screenshots/ipad__admin_operator-inbox.png` |
| ipad | `/admin/order-management` | `audit-artifacts/screenshots/ipad__admin_order-management.png` |
| ipad | `/admin/orders` | `audit-artifacts/screenshots/ipad__admin_orders.png` |
| ipad | `/admin/packing-dispatch` | `audit-artifacts/screenshots/ipad__admin_packing-dispatch.png` |
| ipad | `/admin/pricing` | `audit-artifacts/screenshots/ipad__admin_pricing.png` |
| ipad | `/admin/production` | `audit-artifacts/screenshots/ipad__admin_production.png` |
| ipad | `/admin/products` | `audit-artifacts/screenshots/ipad__admin_products.png` |
| ipad | `/admin/ready-goods` | `audit-artifacts/screenshots/ipad__admin_ready-goods.png` |
| ipad | `/admin/rgs-tv` | `audit-artifacts/screenshots/ipad__admin_rgs-tv.png` |
| ipad | `/admin/sales-hub` | `audit-artifacts/screenshots/ipad__admin_sales-hub.png` |
| ipad | `/admin/settings` | `audit-artifacts/screenshots/ipad__admin_settings.png` |
| ipad | `/admin/support` | `audit-artifacts/screenshots/ipad__admin_support.png` |
| ipad | `/admin/target-vs-actual` | `audit-artifacts/screenshots/ipad__admin_target-vs-actual.png` |
| ipad | `/admin/users` | `audit-artifacts/screenshots/ipad__admin_users.png` |
| ipad | `/admin/verification` | `audit-artifacts/screenshots/ipad__admin_verification.png` |
| ipad | `/admin/whatsapp` | `audit-artifacts/screenshots/ipad__admin_whatsapp.png` |
| ipad | `/approval-pending` | `audit-artifacts/screenshots/ipad__approval-pending.png` |
| ipad | `/buyer-portal` | `audit-artifacts/screenshots/ipad__buyer-portal.png` |
| ipad | `/cart` | `audit-artifacts/screenshots/ipad__cart.png` |
| ipad | `/catalogue` | `audit-artifacts/screenshots/ipad__catalogue.png` |
| ipad | `/dashboard` | `audit-artifacts/screenshots/ipad__dashboard.png` |
| ipad | `/documents` | `audit-artifacts/screenshots/ipad__documents.png` |
| ipad | `/faq` | `audit-artifacts/screenshots/ipad__faq.png` |
| ipad | `/favorites` | `audit-artifacts/screenshots/ipad__favorites.png` |
| ipad | `/home` | `audit-artifacts/screenshots/ipad__home.png` |
| ipad | `/intro` | `audit-artifacts/screenshots/ipad__intro.png` |
| ipad | `/login` | `audit-artifacts/screenshots/ipad__login.png` |
| ipad | `/onboarding` | `audit-artifacts/screenshots/ipad__onboarding.png` |
| ipad | `/operations-controller` | `audit-artifacts/screenshots/ipad__operations-controller.png` |
| ipad | `/orders` | `audit-artifacts/screenshots/ipad__orders.png` |
| ipad | `/orders/1` | `audit-artifacts/screenshots/ipad__orders_1.png` |
| ipad | `/privacy` | `audit-artifacts/screenshots/ipad__privacy.png` |
| ipad | `/product/1` | `audit-artifacts/screenshots/ipad__product_1.png` |
| ipad | `/quick-order` | `audit-artifacts/screenshots/ipad__quick-order.png` |
| ipad | `/register` | `audit-artifacts/screenshots/ipad__register.png` |
| ipad | `/reset-password` | `audit-artifacts/screenshots/ipad__reset-password.png` |
| ipad | `/sales/dashboard` | `audit-artifacts/screenshots/ipad__sales_dashboard.png` |
| ipad | `/security-gate` | `audit-artifacts/screenshots/ipad__security-gate.png` |
| ipad | `/shipping` | `audit-artifacts/screenshots/ipad__shipping.png` |
| ipad | `/splash` | `audit-artifacts/screenshots/ipad__splash.png` |
| ipad | `/terms` | `audit-artifacts/screenshots/ipad__terms.png` |
| ipad | `/track` | `audit-artifacts/screenshots/ipad__track.png` |
| ipad | `/tv/arabic-sweets` | `audit-artifacts/screenshots/ipad__tv_arabic-sweets.png` |
| ipad | `/tv/bakery` | `audit-artifacts/screenshots/ipad__tv_bakery.png` |
| ipad | `/tv/chocolate` | `audit-artifacts/screenshots/ipad__tv_chocolate.png` |
| ipad | `/tv/dragees` | `audit-artifacts/screenshots/ipad__tv_dragees.png` |
| ipad | `/tv/fusion` | `audit-artifacts/screenshots/ipad__tv_fusion.png` |
| ipad | `/tv/nuts` | `audit-artifacts/screenshots/ipad__tv_nuts.png` |
| ipad | `/welcome` | `audit-artifacts/screenshots/ipad__welcome.png` |
| desktop | `/` | `audit-artifacts/screenshots/desktop__root.png` |
| desktop | `/account` | `audit-artifacts/screenshots/desktop__account.png` |
| desktop | `/account/addresses` | `audit-artifacts/screenshots/desktop__account_addresses.png` |
| desktop | `/account/logistics` | `audit-artifacts/screenshots/desktop__account_logistics.png` |
| desktop | `/account/users` | `audit-artifacts/screenshots/desktop__account_users.png` |
| desktop | `/admin` | `audit-artifacts/screenshots/desktop__admin.png` |
| desktop | `/admin/3pcs-store` | `audit-artifacts/screenshots/desktop__admin_3pcs-store.png` |
| desktop | `/admin/accounts-release` | `audit-artifacts/screenshots/desktop__admin_accounts-release.png` |
| desktop | `/admin/announcements` | `audit-artifacts/screenshots/desktop__admin_announcements.png` |
| desktop | `/admin/approvals` | `audit-artifacts/screenshots/desktop__admin_approvals.png` |
| desktop | `/admin/assembly-tasks` | `audit-artifacts/screenshots/desktop__admin_assembly-tasks.png` |
| desktop | `/admin/assembly-tv` | `audit-artifacts/screenshots/desktop__admin_assembly-tv.png` |
| desktop | `/admin/audit` | `audit-artifacts/screenshots/desktop__admin_audit.png` |
| desktop | `/admin/central-pool` | `audit-artifacts/screenshots/desktop__admin_central-pool.png` |
| desktop | `/admin/clients` | `audit-artifacts/screenshots/desktop__admin_clients.png` |
| desktop | `/admin/cmd-war-room` | `audit-artifacts/screenshots/desktop__admin_cmd-war-room.png` |
| desktop | `/admin/currency` | `audit-artifacts/screenshots/desktop__admin_currency.png` |
| desktop | `/admin/department` | `audit-artifacts/screenshots/desktop__admin_department.png` |
| desktop | `/admin/dispatch` | `audit-artifacts/screenshots/desktop__admin_dispatch.png` |
| desktop | `/admin/dispatch-mgmt` | `audit-artifacts/screenshots/desktop__admin_dispatch-mgmt.png` |
| desktop | `/admin/dispatch-tv` | `audit-artifacts/screenshots/desktop__admin_dispatch-tv.png` |
| desktop | `/admin/display-management` | `audit-artifacts/screenshots/desktop__admin_display-management.png` |
| desktop | `/admin/exceptions` | `audit-artifacts/screenshots/desktop__admin_exceptions.png` |
| desktop | `/admin/finance` | `audit-artifacts/screenshots/desktop__admin_finance.png` |
| desktop | `/admin/finance-board` | `audit-artifacts/screenshots/desktop__admin_finance-board.png` |
| desktop | `/admin/heartbeat` | `audit-artifacts/screenshots/desktop__admin_heartbeat.png` |
| desktop | `/admin/inventory` | `audit-artifacts/screenshots/desktop__admin_inventory.png` |
| desktop | `/admin/logistics` | `audit-artifacts/screenshots/desktop__admin_logistics.png` |
| desktop | `/admin/merchandising` | `audit-artifacts/screenshots/desktop__admin_merchandising.png` |
| desktop | `/admin/moq` | `audit-artifacts/screenshots/desktop__admin_moq.png` |
| desktop | `/admin/notifications` | `audit-artifacts/screenshots/desktop__admin_notifications.png` |
| desktop | `/admin/operations` | `audit-artifacts/screenshots/desktop__admin_operations.png` |
| desktop | `/admin/operator-inbox` | `audit-artifacts/screenshots/desktop__admin_operator-inbox.png` |
| desktop | `/admin/order-management` | `audit-artifacts/screenshots/desktop__admin_order-management.png` |
| desktop | `/admin/orders` | `audit-artifacts/screenshots/desktop__admin_orders.png` |
| desktop | `/admin/packing-dispatch` | `audit-artifacts/screenshots/desktop__admin_packing-dispatch.png` |
| desktop | `/admin/pricing` | `audit-artifacts/screenshots/desktop__admin_pricing.png` |
| desktop | `/admin/production` | `audit-artifacts/screenshots/desktop__admin_production.png` |
| desktop | `/admin/products` | `audit-artifacts/screenshots/desktop__admin_products.png` |
| desktop | `/admin/ready-goods` | `audit-artifacts/screenshots/desktop__admin_ready-goods.png` |
| desktop | `/admin/rgs-tv` | `audit-artifacts/screenshots/desktop__admin_rgs-tv.png` |
| desktop | `/admin/sales-hub` | `audit-artifacts/screenshots/desktop__admin_sales-hub.png` |
| desktop | `/admin/settings` | `audit-artifacts/screenshots/desktop__admin_settings.png` |
| desktop | `/admin/support` | `audit-artifacts/screenshots/desktop__admin_support.png` |
| desktop | `/admin/target-vs-actual` | `audit-artifacts/screenshots/desktop__admin_target-vs-actual.png` |
| desktop | `/admin/users` | `audit-artifacts/screenshots/desktop__admin_users.png` |
| desktop | `/admin/verification` | `audit-artifacts/screenshots/desktop__admin_verification.png` |
| desktop | `/admin/whatsapp` | `audit-artifacts/screenshots/desktop__admin_whatsapp.png` |
| desktop | `/approval-pending` | `audit-artifacts/screenshots/desktop__approval-pending.png` |
| desktop | `/buyer-portal` | `audit-artifacts/screenshots/desktop__buyer-portal.png` |
| desktop | `/cart` | `audit-artifacts/screenshots/desktop__cart.png` |
| desktop | `/catalogue` | `audit-artifacts/screenshots/desktop__catalogue.png` |
| desktop | `/dashboard` | `audit-artifacts/screenshots/desktop__dashboard.png` |
| desktop | `/documents` | `audit-artifacts/screenshots/desktop__documents.png` |
| desktop | `/faq` | `audit-artifacts/screenshots/desktop__faq.png` |
| desktop | `/favorites` | `audit-artifacts/screenshots/desktop__favorites.png` |
| desktop | `/home` | `audit-artifacts/screenshots/desktop__home.png` |
| desktop | `/intro` | `audit-artifacts/screenshots/desktop__intro.png` |
| desktop | `/login` | `audit-artifacts/screenshots/desktop__login.png` |
| desktop | `/onboarding` | `audit-artifacts/screenshots/desktop__onboarding.png` |
| desktop | `/operations-controller` | `audit-artifacts/screenshots/desktop__operations-controller.png` |
| desktop | `/orders` | `audit-artifacts/screenshots/desktop__orders.png` |
| desktop | `/orders/1` | `audit-artifacts/screenshots/desktop__orders_1.png` |
| desktop | `/privacy` | `audit-artifacts/screenshots/desktop__privacy.png` |
| desktop | `/product/1` | `audit-artifacts/screenshots/desktop__product_1.png` |
| desktop | `/quick-order` | `audit-artifacts/screenshots/desktop__quick-order.png` |
| desktop | `/register` | `audit-artifacts/screenshots/desktop__register.png` |
| desktop | `/reset-password` | `audit-artifacts/screenshots/desktop__reset-password.png` |
| desktop | `/sales/dashboard` | `audit-artifacts/screenshots/desktop__sales_dashboard.png` |
| desktop | `/security-gate` | `audit-artifacts/screenshots/desktop__security-gate.png` |
| desktop | `/shipping` | `audit-artifacts/screenshots/desktop__shipping.png` |
| desktop | `/splash` | `audit-artifacts/screenshots/desktop__splash.png` |
| desktop | `/terms` | `audit-artifacts/screenshots/desktop__terms.png` |
| desktop | `/track` | `audit-artifacts/screenshots/desktop__track.png` |
| desktop | `/tv/arabic-sweets` | `audit-artifacts/screenshots/desktop__tv_arabic-sweets.png` |
| desktop | `/tv/bakery` | `audit-artifacts/screenshots/desktop__tv_bakery.png` |
| desktop | `/tv/chocolate` | `audit-artifacts/screenshots/desktop__tv_chocolate.png` |
| desktop | `/tv/dragees` | `audit-artifacts/screenshots/desktop__tv_dragees.png` |
| desktop | `/tv/fusion` | `audit-artifacts/screenshots/desktop__tv_fusion.png` |
| desktop | `/tv/nuts` | `audit-artifacts/screenshots/desktop__tv_nuts.png` |
| desktop | `/welcome` | `audit-artifacts/screenshots/desktop__welcome.png` |

## Recommended fixes (priority)

1. Eliminate **HTTP 5xx** and repeated **4xx** on API calls (check Supabase env on preview).
2. Fix **horizontal overflow** (tables, flex rows, min-width) starting with admin finance/orders.
3. Raise **tap targets** to ≥44×44px on primary actions for mobile.
4. Add **alt text** and **accessible names** for icon-only controls.
5. Add **loading/skeleton** consistency for slow routes.
6. Run **axe** + keyboard-only pass + real-device smoke.

## 10/10 readiness checklist

- [ ] Zero console errors on happy-path flows
- [ ] Zero failed network calls for core APIs
- [ ] No horizontal scroll on all breakpoints
- [ ] Tap targets ≥44px; spacing between FABs and nav
- [ ] WCAG 2.2 AA axe scan clean
- [ ] Keyboard + screen reader pass
- [ ] Performance: LCP < 2.5s on 4G Fast emulation
- [ ] Visual regression baseline in CI
- [ ] Auth flows tested with real roles
- [ ] Error boundaries copy reviewed for humans

## Commands run

```bash
npx playwright install chromium
APP_URL=https://cursor-central-vercel.vercel.app npx playwright test -c playwright.ux-audit.config.ts
node scripts/merge-ux-audit-report.mjs
```
