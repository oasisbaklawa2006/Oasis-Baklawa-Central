# WhatsApp Identity, Ownership & Responsibility Architecture (PR-WA-02A)

**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/wa-02a-identity-ownership-architecture-d522`  
**Date:** 2026-06-02  
**Scope:** Design-only architecture audit for sender identity, customer resolution, client ownership, order responsibility, and commission governance.  
**Evidence:** Static repo inspection (`users`, `companies`, Edge Functions, migrations, generated types).  
**Not verified:** Live CRM data quality, historical ownership assignments, or production auto-assignment side effects.

**Authoritative business rule (input to this audit):**

Every order must track four distinct roles:

| Role | Definition | AI may change? |
|------|------------|----------------|
| **Client Owner** | CRM relationship owner; default commission credit | **Never** |
| **Order Creator** | Person who initiated/submitted the order | Set at creation; AI suggests only |
| **Order Handler** | Person executing/following up on the order | Assignable; AI suggests only |
| **Approver** | Person approving workflow exceptions | Human only |

**Commission** defaults to Client Owner. Ownership transfer or commission sharing requires explicit managerial approval.

**WhatsApp reality:** ~80% of inbound order messages originate from **Oasis employees**, not customers. The WhatsApp sender is usually **not** the customer. Customer identity must be resolved from message content, attachments, and CRM — not from the inbound phone number alone.

**Related docs:** `docs/WHATSAPP_COMPLETE_MODULE_BUILD_AUDIT.md` (PR-WA-01B), `docs/C2C_CURRENT_SAFE_BOUNDARY.md`

---

## A. Executive Summary

Oasis Central has **partial identity primitives** but **no unified four-role responsibility model** on orders. Today:

- **Client Owner** is approximated by `companies.account_manager_id` (Sales roster / CRM field).
- **Order Creator, Order Handler, and Approver** are **not first-class persisted fields** on `orders`.
- **Sender identification** is implemented in **three incompatible ways** (`whatsapp-webhook` `classifySender`, `whatsapp-identify-sender`, and ad-hoc phone scans in `admin-create-draft`).
- **`whatsapp-identify-sender` exists but is not invoked** from the operator inbox or webhook unified path.
- **Critical governance violation:** `whatsapp-webhook` **automatically writes** `companies.account_manager_id` when a sales executive sends on behalf of a client or when staff re-wire resolves a company name — directly contradicting “AI may never change ownership automatically.”
- **`admin-create-draft`** correctly distinguishes employee sender phone from customer company resolution and returns `sales_exec_id` in JSON, but **does not persist** creator/handler fields on the order row.
- **Customer identity** is fragmented across `companies`, `users` (buyer portal), `b2b_applications`, `delivery_addresses`, `shadow_clients`, and `whatsapp_contacts` (Edge-only; absent from generated `types.ts` — schema drift risk).

**Architecture verdict:** Before any WhatsApp automation write path (WA-02B+), the program must adopt a **single resolution engine** with explicit confidence bands, freeze automatic ownership mutation in webhook code, and add persisted **order responsibility columns** plus an **ownership change audit trail**.

**Recommended authoritative mapping:**

| Business concept | Authoritative store (target) | Current store (as-built) |
|------------------|------------------------------|----------------------------|
| Employee identity | `users.id` + verified phone keys | Same (partial) |
| Customer (B2B account) | `companies.id` | Same (plus duplicate shadow paths) |
| Client Owner | `companies.account_manager_id` + `company_ownership_history` *(future)* | `companies.account_manager_id` only |
| Order Creator | `orders.order_creator_user_id` *(future)* | Not persisted |
| Order Handler | `orders.order_handler_user_id` or queue assignment *(future)* | `operational_queue_items.assigned_to` (orthogonal) |
| Approver | `orders.approved_by_user_id` / exception workflow *(future)* | `finance_verified_by`, `closed_by` (partial) |
| Commission credit | Derived from Client Owner at payout time | `users.commission_rate_percentage` + `commission_payouts.executive_id` |

---

## B. Sender Identity Model

### B.1 Inventory — employee / staff / role tables

| Object | Source | Purpose | Key identity fields |
|--------|--------|---------|---------------------|
| `public.users` | Core app schema / `types.ts` | **Single employee + buyer identity table** | `id`, `phone`, `mobile_number`, `secondary_phones[]`, `role`, `department`, `designation`, `is_sales_executive`, `is_active`, `company_id` (buyers only), `commission_rate_percentage` |
| `public.roles` | Migration seed / introspection | Role catalogue | `role_key`, `role_name`, `is_active` |
| `public.user_role_map` | Migrations (C2 audit RLS) | Multi-role overlay (ops/finance/director) | `user_id`, `role_id` |
| `public.commission_payouts` | Migrations | Payout ledger | `executive_id` → `users.id` |
| `public.crm_tasks` | `20260410063534_*` | Sales CRM tasks | `company_id`, `sales_exec_id` |
| **No separate `staff` or `employees` table** | — | Employees are rows in `users` with internal roles | — |
| **No `outlet_id` on `users`** | — | Store/outlet encoded in **role string** only (`STORE_INCHARGE`, `STORE_READY_GOODS`, `RGS_ADMIN`, `STORE_3RD_PARTY`, etc.) | — |
| `public.operational_queue_items` | Execution OS migrations | Ops queue ownership | `assigned_to`, `owner_department`, `created_by` |

**Department mapping (as-built):**

- `users.department` — free-text / HR field on user row.
- `operational_queue_items.owner_department`, `operational_search_index.department` — execution OS projections.
- `whatsapp-route-packet` assigns **team labels** (`SALES`, `FINANCE`, `OPERATIONS`, `SUPPORT`, `CEO`) — routing suggestions only, not persisted user IDs.

**Outlet mapping (as-built):**

- Implicit via role keys in `whatsapp-identify-sender` `STAFF_ROLES` list and auth routing — **no normalized outlet entity** linked to WhatsApp senders.

### B.2 How sender is identified today

Three parallel implementations:

#### 1) `whatsapp-webhook` → `classifySender(last10)` (`supabase/functions/whatsapp-webhook/index.ts`)

- Matches `users` by `phone` / `mobile_number` (last 10 digits).
- Returns `{ type: "staff" | "client" | "lead", userId?, role?, isSalesExec? }`.
- **Staff** = role in hardcoded internal list OR `is_sales_executive`.
- **Client** = user row exists but not staff role.
- **Lead** = no user match.
- Does **not** scan `secondary_phones`.
- Does **not** use `whatsapp-identify-sender`.
- Drives company resolution, shadow creation, and **auto account_manager assignment**.

#### 2) `whatsapp-identify-sender` Edge function (TOOL 2 — **unwired**)

- Input: `phone_number`, optional `message_text`, `wa_contact_id`.
- Output kinds: `employee` | `customer` | `spam` | `unknown`.
- Employee match: primary `phone` against `STAFF_ROLES`, then full-table scan of `secondary_phones` (limit 400).
- Customer match: `whatsapp_contacts` by `wa_contact_id` or phone variants.
- Spam heuristic on message text (confidence ≥ 0.65 → spam).
- **Not called from `src/` or from `whatsapp-webhook`.**

#### 3) `admin-create-draft` sender scan

- Treats `phone` parameter as **sender** (documented: “Sales Exec, NOT client”).
- Resolves `senderStaffUserId` / `salesExecId` from primary + `secondary_phones`.
- Returns `sales_exec_id` in response JSON only — **not written to `orders`**.

#### 4) Frontend / War Room ad-hoc

- `ShadowClientSection.tsx` merges employee phones into `users.secondary_phones` or updates `users.phone` during shadow triage — **manual CRM surgery**, not governed identity API.

### B.3 How sender **should** be identified (target)

| Layer | Rule |
|-------|------|
| **Authoritative employee identity** | `public.users.id` where `is_active = true` and role ∈ internal staff set **OR** `is_sales_executive = true` |
| **Phone keys (normalized)** | Canonical E.164-ish `91XXXXXXXXXX` + last-10 index; authoritative mapping table `user_phone_keys(user_id, phone_normalized, key_type)` *(future)* — replaces ad-hoc scans |
| **Primary resolver** | Single Edge entry: **`whatsapp-identify-sender`** (extended) invoked by webhook + inbox on every inbound message |
| **Sender record on packet** | Persist on `whatsapp_message_packets`: `sender_user_id`, `sender_kind`, `sender_confidence`, `sender_phone_normalized` *(future columns)* |
| **Employee vs customer vs proxy** | Explicit `sender_kind`: `employee` \| `buyer_user` \| `unknown_contact` \| `spam`; **never infer customer from sender phone when `sender_kind = employee`** |

**Proxy employee rule (80% case):**

```
IF sender_kind = employee THEN
  customer_resolution MUST use message content / attachments / explicit CRM IDs
  MUST NOT map company_id from sender phone alone
```

This rule is **partially** encoded in `admin-create-draft` (returns 400 for proxy without `company_id` or `candidate_company_name`) but **violated** in `whatsapp-webhook` Pipeline C auto-order path.

### B.4 Authoritative employee identity — recommendation

**Single source of truth:** `users.id` with governed phone key registry.

| Concern | Authoritative | Notes |
|---------|---------------|-------|
| Who is an employee? | `users.role` + `is_sales_executive` + `is_active` | Consolidate staff role list in one shared module (today duplicated webhook vs identify-sender) |
| Employee phone | `users.phone`, `mobile_number`, `secondary_phones` → future `user_phone_keys` | Secondary phone scan at 400-row limit is not scalable |
| Department | `users.department` for HR; ops routing uses role → department map | Do not overload WhatsApp routing teams as HR truth |
| Outlet | Future `user_outlet_assignments` *(optional)* | Until then, role string only — document as **AMBER** accuracy |

---

## C. Customer Identity Model

### C.1 Inventory — customer / company / contact tables

| Object | Purpose | Key fields | Relationships |
|--------|---------|--------------|---------------|
| `public.companies` | **B2B customer account (commercial entity)** | `business_name`, `gst_number`, `phone`, `registered_address`, `account_manager_id`, `status`, credit fields | 1 company → 1 `account_manager_id`; FK to `users` |
| `public.users` (buyer) | B2B portal login | `company_id` → single company | Many users can share one `company_id` *(portal)* |
| `public.b2b_applications` | Onboarding / KYC pipeline | `business_name`, `contact_phone`, `mobile_number`, `gst_number`, `registered_address`, `status` | Approved app → company creation |
| `public.delivery_addresses` | Ship-to locations | `company_id`, address fields, `contact_person`, `contact_phone`, `is_default` | **Many addresses per company** |
| `public.shadow_clients` | Pre-company WhatsApp leads | `sender_phone`, extracted business fields, `promoted_to_company_id` | Parallel to `companies.status = 'shadow'` |
| `public.whatsapp_contacts` | WA address book cache | `phone_number`, `customer_name`, `company_name`, `wa_contact_id` | Used by identify-sender; **missing from `types.ts`** |
| `public.client_interactions` | CRM timeline | `company_id`, interaction type | Many rows per company |
| Credit / finance | `companies.allow_credit`, `credit_limit`, `wallet_balance`, `total_outstanding` | Account-level | Not contact-level |

**There is no standalone `customers` or `contacts` table** — “customer” in business language maps to **`companies`** (account) plus associated people phones scattered across apps and addresses.

### C.2 Cardinality answers

| Question | As-built answer | Target answer |
|----------|-----------------|---------------|
| One customer → many contacts? | **Yes (implicitly).** Phones live on `b2b_applications`, `delivery_addresses.contact_phone`, `companies.phone`, buyer `users.phone`, WhatsApp sender numbers — **not normalized** | **Yes.** Future `company_contacts(company_id, …)` with typed roles (ordering, billing, WhatsApp) |
| One company → many contacts? | **Yes** (implicit via above) | **Yes** — explicit contact entities |
| One contact → many companies? | **Possible but unsupported.** Same phone on multiple shadow companies or mis-merged War Room data | **Rare; requires manual governance.** Auto-merge forbidden |
| One customer → many delivery addresses? | **Yes.** `delivery_addresses.company_id` | **Yes** — keep `delivery_addresses` as SSOT for ship-to |
| One GST entity → one company? | **Intended.** `companies.gst_number` unique in business logic; shadow uses synthetic `WA:{phone91}` | **Yes.** GST is company key; do not reuse across accounts |
| Authoritative customer identity? | **`companies.id`** for commerce; **`companies.status`** distinguishes active / shadow / merged / rejected | Same, with **`company_contacts`** for people |

### C.3 Customer resolution strategies (as-built)

| Strategy | Where | Match keys |
|----------|-------|------------|
| Message text business name | `whatsapp-webhook`, `admin-create-draft`, Banyan | `ilike` on `companies.business_name` |
| Sender phone → buyer user | webhook Strategy 2 | `users.phone` → `users.company_id` |
| Sender phone → B2B app | webhook Strategy 1 | `b2b_applications.contact_phone` |
| Sender phone → company | webhook Strategy 3 / shadow GST | `companies.gst_number` / `phone` patterns |
| AI extracted business name | Banyan parser | Fuzzy match against active companies |
| Shadow reconciliation | Banyan + webhook | Create/find `companies.status = 'shadow'` + `shadow_clients` row |
| WhatsApp contact cache | identify-sender | `whatsapp_contacts.phone_number` |

**Gap:** When sender is employee, customer phone in message body is **not systematically extracted** into a contact resolution step — only business **name** patterns in webhook staff re-wire.

### C.4 Authoritative customer identity — recommendation

| Concept | SSOT |
|---------|------|
| Commercial account | `companies.id` |
| Legal/tax identity | `companies.gst_number` (when present) |
| Default registered address | `companies.registered_address` |
| Delivery locations | `delivery_addresses` where `company_id` matches |
| Portal users | `users` where `company_id` matches |
| WhatsApp thread identity | `whatsapp_message_packets.company_id` *(future)* + `company_contacts` *(future)* |
| Lead before KYC | `companies.status = 'shadow'` **single shadow model** — deprecate parallel `shadow_clients` as primary *(merge into company + intake record)* |

---

## D. Ownership Model

### D.1 Where Client Owner exists today

| Location | Field | Usage |
|----------|-------|-------|
| `companies.account_manager_id` | UUID → `users.id` | **Client Owner proxy** — Sales Dashboard filters, RLS for sales executives, commission roster (`SalesPerformanceHub`), `notify-event` sales audience |
| `is_account_manager(user, company)` | SQL function | RLS: sales exec sees only assigned companies/orders |
| `crm_tasks.sales_exec_id` | Per-task assignment | CRM follow-ups — not synced to company owner automatically |
| Commission | `users.commission_rate_percentage` on owner user; payouts in `commission_payouts.executive_id` | Delivered-value commission in Sales Performance Hub |

**There is no `client_owner_id` column separate from `account_manager_id`.** For this program, **`account_manager_id` IS Client Owner** until a dedicated rename/migration clarifies semantics for non-sales account managers.

### D.2 Ownership assignment today

| Path | Behavior | Governance |
|------|----------|------------|
| CRM / Admin manual | Admin can set `account_manager_id` via client management UI | Allowed — human CRM |
| Sales Performance Hub | Reads companies by `account_manager_id` | Read-only roster view |
| **`whatsapp-webhook` staff re-wire** | If staff mentions client name and company has **no** `account_manager_id`, **`UPDATE companies SET account_manager_id = sender.userId`** | **FORBIDDEN by business rule — auto ownership write** |
| **`whatsapp-webhook` sales exec auto-assign** | If sender is sales exec and company has no manager, **auto-assign sender** | **FORBIDDEN by business rule** |
| War Room shadow merge | Manual company merge / reject in `ShadowClientSection` | Human — but ungoverned client writes |
| AI / parser | Banyan does **not** set `account_manager_id` | Correct |

### D.3 Ownership change workflow (target)

```
Ownership change request (manager UI or CRM)
  → validate: new owner is active sales executive
  → require: reason + effective_date + approver (sales head / admin)
  → insert company_ownership_history (old, new, reason, approved_by)
  → update companies.account_manager_id
  → optional: commission_split_rules if sharing (manager-approved only)
  → notify: old owner, new owner, finance
  → NEVER triggered from WhatsApp webhook or AI parser
```

**As-built:** No `company_ownership_history` table. No approval workflow. Webhook can mutate owner silently.

### D.4 Inactive employee workflow (target)

| Trigger | Action |
|---------|--------|
| `users.is_active = false` for current `account_manager_id` | Flag companies with **orphan owner** in CRM queue |
| Reassignment | **Manager bulk reassignment** — not auto |
| Open orders | `order_handler` may shift to team queue; **commission owner unchanged** until ownership transfer approved |
| WhatsApp messages from inactive employee phone | Resolve sender as `former_employee`; route to supervisor; **do not** credit commission to inactive user |

### D.5 Transferred territory workflow (target)

| Concept | Implementation |
|---------|----------------|
| Territory | Future `sales_territories` + `company_territory_map` *(optional)* |
| Transfer | Manager moves **company assignment** via ownership workflow — not inferred from message |
| WhatsApp | Employee messages for clients outside roster → **suggested handler** = assigned owner; creator = sending employee |

---

## E. Responsibility Model

### E.1 Four roles — as-built vs target

| Role | Business definition | As-built persistence | Target persistence | Audit |
|------|---------------------|----------------------|--------------------|-------|
| **Client Owner** | CRM relationship owner; commission default | `companies.account_manager_id` | Same + `company_ownership_history` | Ownership change log |
| **Order Creator** | Who initiated/submitted | **Not on `orders`**; `admin-create-draft` returns `sales_exec_id` in JSON only | `orders.order_creator_user_id` + `orders.creation_channel` (`whatsapp_employee_proxy`, `whatsapp_customer`, `portal`, `admin`) | `order_responsibility_log` event at create |
| **Order Handler** | Who executes / follows up | `operational_queue_items.assigned_to` (separate subsystem); entity graph defaults `operations_manager` | `orders.order_handler_user_id` or link to queue item | Reassignment log |
| **Approver** | Exception approver | `orders.finance_verified_by`, `orders.closed_by`; catalogue drafts use `reviewed_by` | `orders.approved_by_user_id` + `approval_requests` table for exceptions | Existing finance audit + WA exception log |

### E.2 Partial approver signals on `orders` today

From `src/integrations/supabase/types.ts` — `orders` row includes:

- `finance_verified_by`, `finance_verified_at` — finance approval slice
- `closed_by`, `closed_at` — closure authority
- **Missing:** generic approver for clarification release, duplicate override, ownership dispute, shadow promotion

### E.3 Commission responsibility

| Rule | As-built | Target |
|------|----------|--------|
| Default commission credit | Implicitly `account_manager_id` user when computing Sales Performance Hub | Explicit: `commission_credit_user_id` default = Client Owner at order creation |
| Order Creator ≠ Owner | Creator may be different employee (proxy order) — **commission still to Owner** unless approved share | Persist both IDs; commission engine reads Owner |
| Commission split | Not modeled | `commission_split_rules(order_id, user_id, pct, approved_by)` — manager approval only |

### E.4 Recommended storage map

```
companies
  account_manager_id          → Client Owner (CRM SSOT)

orders
  company_id
  order_creator_user_id       → NEW (required on create)
  order_handler_user_id       → NEW (default at create, reassignable)
  approved_by_user_id         → NEW (nullable until exception)
  commission_credit_user_id   → NEW (default = companies.account_manager_id at create, immutable without workflow)
  creation_channel            → NEW
  wamid                       → existing idempotency

company_ownership_history     → NEW
order_responsibility_log      → NEW (append-only)
wa_intake_resolutions         → NEW (links packet → company + confidence + resolver version)
```

---

## F. WhatsApp Resolution Engine

### F.1 Target flow

```
┌─────────────────────┐
│ Incoming WA message │  whatsapp-webhook (ingress only)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Persist raw + WAMID │  whatsapp_messages, debug_webhooks dedup
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Packet stitch       │  whatsapp-message-stitcher (idempotent)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Sender Resolution   │  whatsapp-identify-sender (extended)
│  - employee?        │  → sender_user_id, sender_kind, confidence
│  - buyer?           │
│  - spam/unknown?    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Customer Resolution │  wa-customer-resolver (NEW — design only)
│  IF employee sender:│  extract customer hints from text/OCR/GST/phone-in-body
│  IF buyer sender:   │  map users.company_id or whatsapp_contacts
│  ELSE:              │  phone + name + GST fuzzy match
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Client Owner        │  READ companies.account_manager_id ONLY
│ Resolution          │  AI suggests if null — NEVER auto-write
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Responsibility      │  creator = sender if employee else null
│ Assignment          │  handler = owner or ops queue default
│                     │  commission_credit = owner
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Intake record       │  wa_intake_resolutions (proposed lines + confidence)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Human approval      │  War Room / Inbox action (ADMIN+)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Draft creation      │  admin-create-draft (sole promotion adapter)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Customer comms      │  send-whatsapp (governed, idempotent)
└─────────────────────┘
```

### F.2 Confidence thresholds (program standard)

| Band | Range | System behavior | Human action |
|------|-------|-----------------|--------------|
| **Auto match** | **≥ 0.95** | Bind `company_id`, pre-fill draft lines, show green badge | Optional one-click confirm |
| **Suggested match** | **0.70 – 0.94** | Present top 3 candidates; pre-select highest | Operator must confirm or search CRM |
| **Clarification** | **< 0.70** | Do **not** create order; send templated ask to **sender** (employee or customer) | Wait for reply; new resolution pass |

**Additional hard gates (any confidence):**

- Employee sender + no customer candidate → **always clarification**
- Multiple companies same GST → **always clarification + approver**
- Owner null on active company → **suggest owner from roster** — assign only via CRM/manager
- Ownership dispute flag → **freeze commission + require approver**

### F.3 Resolution inputs by sender kind

| Sender kind | Customer resolution inputs (priority order) |
|-------------|---------------------------------------------|
| `employee` | 1) Explicit `company_id` in structured operator payload 2) GST in message/OCR 3) Business name fuzzy 4) Customer phone in message 5) Recent thread context (120s window — existing webhook Strategy 3.5) |
| `buyer_user` | 1) `users.company_id` 2) `b2b_applications` 3) `whatsapp_contacts` |
| `unknown` | 1) Phone → company 2) AI name extraction 3) shadow intake record — **no auto active company** |

### F.4 Employee-proxy order flow (80% case)

```
Employee (sender_user_id = E)
  → extract customer C from message
  → resolve company_id
  → read client_owner = companies.account_manager_id
  → set order_creator = E
  → set order_handler = client_owner OR ops default if owner inactive
  → set commission_credit = client_owner
  → if client_owner IS NULL → status = awaiting_owner_assignment (NOT auto-set E as owner)
```

**Fixes current bug** where webhook sets `account_manager_id = E` when owner was null.

---

## G. Governance Rules

For each scenario: **Owner** = Client Owner (`account_manager_id`), **Creator** = Order Creator, **Handler** = Order Handler, **Approver** = exception approver, **Commission** = commission credit user.

### Scenario A — Customer messages directly

| Field | Value |
|-------|-------|
| Owner | `companies.account_manager_id` (existing CRM) |
| Creator | Buyer `users.id` if portal user matched; else **null** (customer-initiated, not staff) |
| Handler | Owner if active; else Sales ops queue |
| Approver | Admin if clarification / credit hold / duplicate |
| Commission | Owner |

### Scenario B — Owner messages on behalf of own client

| Field | Value |
|-------|-------|
| Owner | Self (owner = creator’s roster company) |
| Creator | Owner (`sender_user_id`) |
| Handler | Owner |
| Approver | Only if exception (credit, duplicate, SKU clarification) |
| Commission | Owner |

### Scenario C — Another employee messages for existing client

| Field | Value |
|-------|-------|
| Owner | **Unchanged** — CRM `account_manager_id` |
| Creator | Sending employee (`sender_user_id`) |
| Handler | Owner (relationship owner follows up) OR assigned delegate via task — **not sending employee by default** |
| Approver | Owner or manager if handler reassignment needed |
| Commission | **Owner** — not creator |

### Scenario D — Unknown customer

| Field | Value |
|-------|-------|
| Owner | **Null** until CRM assigns (lead pool) |
| Creator | Employee sender if applicable |
| Handler | Sales intake queue / CMD |
| Approver | Sales head for shadow → active promotion |
| Commission | **None** until owner assigned and order delivered |

### Scenario E — New customer

| Field | Value |
|-------|-------|
| Owner | **Assigned in CRM at onboarding** — not by WhatsApp |
| Creator | Employee who submitted intake |
| Handler | Assigned owner once set |
| Approver | Sales head + Admin for KYC activation |
| Commission | Owner after assignment |

**Shadow company creation** may occur for intake, but **`account_manager_id` remains null** until manager assigns.

### Scenario F — Ownership dispute

| Field | Value |
|-------|-------|
| Owner | **Frozen** — last CRM-approved owner until workflow completes |
| Creator | Message sender |
| Handler | **None auto** — route to Sales director queue |
| Approver | **Sales head / ADMIN** mandatory |
| Commission | Frozen; no payout until dispute resolved |

### Scenario G — Employee left company

| Field | Value |
|-------|-------|
| Owner | CRM reassignment required (orphan queue) |
| Creator | If message from ex-employee phone → resolve as `former_employee`; creator null or flagged |
| Handler | Successor owner or ops queue |
| Approver | Manager for owner reassignment |
| Commission | Previous owner until formal transfer — **never** ex-employee |

### Scenario H — Shared account (multiple employees, one company)

| Field | Value |
|-------|-------|
| Owner | Single CRM owner — unchanged |
| Creator | Actual sender employee |
| Handler | Owner or explicitly delegated handler on order |
| Approver | Manager if handler ≠ owner delegation |
| Commission | Owner — shared commission only via approved split rules |

---

## H. AI Permission Matrix

| Action | Allowed (suggest / read) | Forbidden (write without manager) |
|--------|--------------------------|-----------------------------------|
| Identify likely customer | ✅ Rank candidates with confidence | ❌ Auto-bind `company_id` below 0.95 without human confirm |
| Identify likely owner | ✅ Show “suggested owner: X” when `account_manager_id` null | ❌ **Any** `UPDATE companies.account_manager_id` |
| Identify sender employee | ✅ | ❌ Mutate `users` phone keys |
| Extract products / lines | ✅ Into intake record | ❌ Insert `orders` / `order_items` (Pipeline C) |
| Suggest Order Creator | ✅ From sender resolution | ❌ Persist creator without draft promotion auth |
| Suggest Order Handler | ✅ Default to owner | ❌ Reassign handler on approved orders without audit |
| Customer merge | ✅ Flag “possible duplicate” | ❌ Merge companies / delete customers |
| Customer delete | — | ❌ Always forbidden |
| Commission reassignment | ✅ Model “what-if” for manager UI | ❌ Any commission field change |
| Ownership transfer | ✅ Draft transfer request | ❌ Execute transfer |
| Send customer WhatsApp | ✅ Draft message text | ❌ Auto-send without human send action |
| Shadow → active promotion | ✅ Checklist suggestion | ❌ Auto-activate company |

**Managerial approval required for:** ownership transfer, commission sharing, customer merge, shadow activation, duplicate override, finance exception.

---

## I. Recommended Schema Changes (future only — no implementation in PR-WA-02A)

### I.1 New columns on existing tables

**`whatsapp_message_packets`**

- `sender_user_id uuid NULL`
- `sender_kind text NULL` — `employee`, `buyer_user`, `unknown`, `spam`, `former_employee`
- `sender_confidence numeric NULL`
- `sender_phone_normalized text NULL`
- `resolved_company_id uuid NULL`
- `company_resolution_confidence numeric NULL`
- `resolution_status text NULL` — `auto`, `suggested`, `clarification`, `manual`

**`orders`**

- `order_creator_user_id uuid NULL`
- `order_handler_user_id uuid NULL`
- `approved_by_user_id uuid NULL`
- `commission_credit_user_id uuid NULL`
- `creation_channel text NULL`
- `wa_intake_id uuid NULL`

**`suggested_orders`**

- `sender_user_id uuid NULL` — employee who sent (distinct from `sender_phone`)
- `resolved_owner_user_id uuid NULL` — read from company at resolution time (snapshot)
- `creator_user_id uuid NULL`

### I.2 New tables

**`user_phone_keys`**

- `id`, `user_id`, `phone_normalized`, `key_type` (`primary`, `mobile`, `secondary`, `whatsapp`)
- Unique on `phone_normalized` where active
- Replaces full-table secondary phone scans

**`company_contacts`**

- `id`, `company_id`, `full_name`, `phone_normalized`, `email`, `role` (`ordering`, `billing`, `whatsapp`, `owner_person`)
- Many per company

**`company_ownership_history`**

- `id`, `company_id`, `previous_owner_user_id`, `new_owner_user_id`, `reason`, `approved_by`, `effective_at`, `created_at`

**`order_responsibility_log`**

- Append-only: `order_id`, `field_changed`, `old_user_id`, `new_user_id`, `changed_by`, `reason`, `created_at`

**`wa_intake_resolutions`**

- Links `packet_id`, `company_id`, `proposed_items jsonb`, `customer_resolution_method`, `confidence`, `created_at`
- Human approval → `admin-create-draft`

**`commission_split_rules`** *(optional phase 2)*

- `order_id`, `user_id`, `split_pct`, `approved_by`, `approved_at`

### I.3 Code changes (future PRs — not this audit)

| Change | Priority |
|--------|----------|
| Remove `account_manager_id` auto-update from `whatsapp-webhook` | **P0** |
| Wire `whatsapp-identify-sender` into webhook + inbox | **P0** |
| Persist responsibility fields in `admin-create-draft` | **P0** |
| Deprecate duplicate shadow paths (`shadow_clients` vs `companies.status=shadow`) | P1 |
| Add `user_phone_keys` backfill from existing `users` | P1 |
| Regenerate types to include `whatsapp_contacts` | P1 |

### I.4 RPC / Edge (future)

- `resolve_wa_sender(phone, wa_contact_id, message_text)` → thin wrapper over identify-sender
- `resolve_wa_customer(packet_id)` → customer resolver (NEW)
- `propose_order_responsibility(company_id, sender_user_id)` → returns four roles **without writes**

---

## J. Risks

| ID | Risk | Severity | Current evidence |
|----|------|----------|------------------|
| R1 | **Auto ownership assignment in webhook** | **Critical** | `whatsapp-webhook` lines ~1141–1144, ~1310–1314 |
| R2 | **Creator/owner conflation** | **Critical** | Sales exec proxy treated as owner when `account_manager_id` empty |
| R3 | **Four-role model not persisted** | **High** | `orders` lacks creator/handler/commission columns |
| R4 | **Three sender classifiers diverge** | **High** | webhook vs identify-sender vs admin-create-draft |
| R5 | **Customer resolved from sender phone for employees** | **High** | Pipeline C auto-order in webhook |
| R6 | **Dual shadow models** | **Medium** | `shadow_clients` + `companies.status=shadow` |
| R7 | **Schema drift** | **Medium** | `whatsapp_contacts` used in Edge, missing from `types.ts` |
| R8 | **Commission computed without creator/owner separation** | **Medium** | SalesPerformanceHub uses manager filter, not order-level credit |
| R9 | **Secondary phone scan limit 400** | **Medium** | `whatsapp-identify-sender` |
| R10 | **War Room manual phone merge** | **High** | `ShadowClientSection` updates users/companies without audit |
| R11 | **No ownership dispute workflow** | **High** | No freeze mechanism |
| R12 | **Inactive employee phones still match sender** | **Medium** | No `is_active` check in identify-sender |

---

## K. Exact Next Implementation PR After This Audit

### PR title

**WA-02B: Disable Pipeline C auto-order and freeze webhook ownership writes (feature flags + docs)**

### Rationale

WA-02A establishes that **automatic ownership mutation** and **unsupervised order creation** are the highest-risk gaps. The next safe implementation PR should **stop the bleeding** before building the full resolution engine (WA-03+).

### Scope (expected — not part of this audit PR)

| Area | Change |
|------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Feature flag `WA_AUTO_ORDER_ENABLED` default `false`; remove/guard `account_manager_id` auto-`UPDATE` |
| `src/config/waFlags.ts` *(new)* | Documented flags for staging |
| Tests | Webhook does not mutate ownership when flag off |
| Docs | Update WA-01B pipeline map status |

### Risk level

**High** (touches production webhook) — deploy to **staging only** with C2C sign-off.

### Expected files touched

- `supabase/functions/whatsapp-webhook/index.ts`
- `src/config/waFlags.ts` (scaffold; env-driven)
- `docs/WHATSAPP_PIPELINE_C_GATING.md` (short companion)
- Tests adjacent to webhook handler if present

### Follow-on PR sequence (after WA-02B)

1. **WA-03:** Wire `whatsapp-identify-sender` into inbox (read-only display)
2. **WA-04:** Schema migration for order responsibility columns + `company_ownership_history`
3. **WA-05:** Persist four-role model in `admin-create-draft`
4. **WA-06:** Customer resolver Edge function (suggest-only mode)

---

## Validation (PR-WA-02A)

Documentation-only — no app, Edge, migration, or config changes.

```bash
npm run typecheck
npm run build
```

---

## Files changed (this PR)

| File | Change |
|------|--------|
| `docs/WHATSAPP_IDENTITY_OWNERSHIP_ARCHITECTURE.md` | **Added** — identity, ownership, responsibility architecture audit |

---

*End of PR-WA-02A audit.*
