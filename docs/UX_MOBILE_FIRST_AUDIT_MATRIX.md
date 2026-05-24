# Oasis Central — Mobile-first audit matrix (MOVE 4)

**Legend:** **PASS** = no automated flags on latest crawl for that viewport; **WARNING** = automated flag **or** policy watchlist; **FAIL** = confirmed broken in human QA (none auto).  
**Heuristic source:** `audit-artifacts/raw/raw-<project>.json` (May 2026 crawl). **Code drift (2026-05-20):** PR **#89** merged; follow-up branch hardened **dispatch**, **approvals** (via `AdminClients`), and **legal/intro/register** tap targets — matrix cells stay **WARNING** until a fresh crawl or human PASS is recorded.

### Criteria per cell block

| Check | Meaning |
|-------|---------|
| Horizontal overflow | `layout.horizontalOverflow` |
| Fixed footer overlap | Manual (video) |
| Keyboard overlap | Manual |
| Sticky collisions | Manual |
| Unreadable density | Manual + tap count proxy |
| Touch targets | tap &lt;44px sample count |
| Scroll traps | Manual |
| Nested scrolls | Manual |
| Modal usability | Manual |

---

## Highest-risk operational mobile surfaces (policy flag)

> **Finance board**, **operator inbox**, **dispatch**, **reports** — default **WARNING** until human PASS recorded.

---

## Dashboard (`/dashboard`, `/home`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | WARNING | PASS | VERIFY | VERIFY | VERIFY | VERIFY | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | WARNING | PASS | VERIFY | VERIFY | VERIFY | VERIFY | PASS | VERIFY | VERIFY | VERIFY |
| iPad | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Finance board (`/admin/finance`, `/admin/finance-board`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | **WARNING** | PASS (auto) | VERIFY | VERIFY | VERIFY | **WARNING** | PASS (auto) | VERIFY | VERIFY | VERIFY |
| iPhone SE | **WARNING** | PASS (auto) | VERIFY | VERIFY | VERIFY | **WARNING** | PASS (auto) | VERIFY | VERIFY | VERIFY |
| iPad | **WARNING** | PASS (auto) | VERIFY | VERIFY | VERIFY | WARNING | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | **WARNING** | PASS (auto) | N/A | N/A | VERIFY | WARNING | N/A | VERIFY | VERIFY | VERIFY |

---

## Operator inbox (`/admin/operator-inbox`, `/admin/whatsapp`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | **WARNING** | PASS | VERIFY | **WARNING** | **WARNING** (pilot improved) | **WARNING** (pilot improved) | PASS (pilot) | VERIFY | VERIFY | VERIFY |
| iPhone SE | **WARNING** | PASS | VERIFY | **WARNING** | **WARNING** (pilot improved) | **WARNING** (pilot improved) | PASS (pilot) | VERIFY | VERIFY | VERIFY |
| iPad | **WARNING** | PASS | VERIFY | VERIFY | WARNING (pilot improved) | WARNING (pilot improved) | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Dispatch (`/admin/dispatch`, `/admin/dispatch-mgmt`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | **WARNING** | PASS | VERIFY | VERIFY | **WARNING** (code improved) | **WARNING** (code improved) | PASS (code) | VERIFY | VERIFY | VERIFY |
| iPhone SE | **WARNING** | PASS | VERIFY | VERIFY | **WARNING** (code improved) | **WARNING** (code improved) | PASS (code) | VERIFY | VERIFY | VERIFY |
| iPad | **WARNING** | PASS | VERIFY | VERIFY | WARNING (code improved) | WARNING (code improved) | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Quick order (`/quick-order`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | **WARNING** | PASS | VERIFY | **WARNING** | VERIFY | **WARNING** | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | **WARNING** | PASS | VERIFY | **WARNING** | VERIFY | **WARNING** | PASS | VERIFY | VERIFY | VERIFY |
| iPad | WARNING | PASS | VERIFY | VERIFY | VERIFY | WARNING | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Approvals (`/admin/approvals`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | **WARNING** | PASS | VERIFY | VERIFY | **WARNING** (code improved) | **WARNING** (code improved) | PASS (code) | VERIFY | VERIFY | VERIFY |
| iPhone SE | **WARNING** | PASS | VERIFY | VERIFY | **WARNING** (code improved) | **WARNING** (code improved) | PASS (code) | VERIFY | VERIFY | VERIFY |
| iPad | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Order detail (`/orders/1`, `/admin/orders`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | WARNING | PASS | VERIFY | VERIFY | VERIFY | WARNING | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | WARNING | PASS | VERIFY | VERIFY | VERIFY | WARNING | PASS | VERIFY | VERIFY | VERIFY |
| iPad | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Product catalogue (`/catalogue`, `/product/1`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| iPad | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Cart (`/cart`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | WARNING | PASS | VERIFY | **WARNING** | **WARNING** | PASS | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | WARNING | PASS | VERIFY | **WARNING** | **WARNING** | PASS | PASS | VERIFY | VERIFY | VERIFY |
| iPad | PASS | PASS | VERIFY | VERIFY | VERIFY | PASS | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | VERIFY | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Login (`/login`, `/register`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | PASS | PASS | VERIFY | VERIFY | PASS | PASS | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | PASS | PASS | VERIFY | VERIFY | PASS | PASS | PASS | VERIFY | VERIFY | VERIFY |
| iPad | PASS | PASS | VERIFY | VERIFY | PASS | PASS | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | PASS | PASS | N/A | N/A | PASS | PASS | N/A | VERIFY | VERIFY | VERIFY |

---

## Reports (`/admin/target-vs-actual`, `/sales/dashboard`)

| Viewport | Overall | Horizontal overflow | Footer overlap | Keyboard overlap | Sticky collisions | Density | Touch targets | Scroll traps | Nested scrolls | Modals |
|----------|---------|--------------------|---------------|------------------|-------------------|---------|---------------|---------------|-----------------|--------|
| iPhone 14 Pro | **WARNING** | PASS | VERIFY | VERIFY | VERIFY | **WARNING** | PASS | VERIFY | VERIFY | VERIFY |
| iPhone SE | **WARNING** | PASS | VERIFY | VERIFY | VERIFY | **WARNING** | PASS | VERIFY | VERIFY | VERIFY |
| iPad | **WARNING** | PASS | VERIFY | VERIFY | VERIFY | WARNING | PASS | VERIFY | VERIFY | VERIFY |
| Desktop | **WARNING** | PASS | N/A | N/A | VERIFY | WARNING | N/A | VERIFY | VERIFY | VERIFY |

---

## Legal / static (`/terms`, `/privacy`, `/shipping`) — automation-backed

| Viewport | Overall | Notes |
|----------|---------|-------|
| iPhone 14 Pro | **WARNING** | **Code:** 44px-class links + `focus-visible` — re-crawl to clear tap sampling |
| iPhone SE | **WARNING** | same |
| iPad | **WARNING** | same |
| Desktop | PASS | tap rule relaxed |

---

## Mobile risk summary

| Bucket | Routes |
|--------|--------|
| **FAIL** | _None from automation — fill only after human confirms_ |
| **WARNING** | Finance board, inbox/WhatsApp, dispatch, quick order, approvals, reports, cart sticky, legal pages |
| **PASS** (auto) | Most remaining routes with no JSON flags |

---

## Evidence

- Raw: `audit-artifacts/raw/raw-iphone-14-pro.json` etc.  
- Report: `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md`
