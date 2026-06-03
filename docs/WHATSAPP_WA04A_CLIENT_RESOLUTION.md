# WhatsApp WA-04A — Client resolution engine (read-only suggestions)

**PR:** WA-04A — Client Resolution Engine (Read-Only Suggestions)  
**Date:** 2026-06-02

---

## Summary

Operator inbox now shows **read-only client resolution suggestions** for the selected packet. The engine infers the **likely client** and **likely owner** (`companies.account_manager_id`) from message content and read-only database lookups. **No mutations** are performed.

---

## Resolver architecture

```
Selected packet + sender identity (WA-03A)
  → extractClientResolutionTextSignals()
  → read-only SELECT queries (companies, users, orders, b2b_applications, shadow_clients, delivery_addresses)
  → scoreClientResolutionCandidates()
  → OperatorInboxClientResolutionPanel
```

| Layer | File |
|-------|------|
| Types | `src/lib/wa-governance/clientResolutionTypes.ts` |
| Text signals | `src/lib/wa-governance/clientResolutionSignals.ts` |
| Scoring | `src/lib/wa-governance/clientResolutionScoring.ts` |
| Read-only queries | `src/lib/wa-governance/fetchClientResolution.ts` |
| Display | `src/lib/wa-governance/clientResolutionDisplay.ts` |
| Hook | `src/components/whatsapp/useOperatorInboxClientResolution.ts` |
| UI | `src/components/whatsapp/OperatorInboxClientResolutionPanel.tsx` |

---

## Data sources audited (read-only)

| Source | Use |
|--------|-----|
| `companies` | Primary client entity — `business_name`, `phone`, `gst_number`, `account_manager_id`, `registered_address` |
| `users` | Portal contact phone → `company_id`; owner display via `account_manager_id` |
| `whatsapp_contacts` | Alias hints via packet `customer_name` (no FK to companies) |
| `b2b_applications` | Approved applicant phone → company name |
| `shadow_clients` | Extracted business name / promoted company id |
| `delivery_addresses` | Location token match on city/street |
| `orders` | Order number reference → `company_id` |
| `client_interactions` | **Not queried in v1** — no safe runtime join contract without extra indexes |

**Not present:** dedicated `customers` / `contacts` tables, company nickname/alias table (product aliases only).

---

## Matching signals & weights

| Signal | Weight |
|--------|--------|
| Exact company name in message | 0.78 |
| Partial company name | 0.42 |
| WhatsApp contact company alias | 0.38 |
| WhatsApp contact customer alias | 0.32 |
| GST exact match | 0.52 |
| Phone on company / `WA:` gst encoding | 0.40 |
| Previous order reference | 0.35 |
| Delivery location token | 0.18 |
| Numeric code → company id prefix (weak) | 0.12 |
| Employee sender relay boost | +0.18 |

Scores are summed (capped) and shown as **confidence %**.

---

## Confidence bands

| Band | Threshold | UI |
|------|-----------|-----|
| Auto-highlight | ≥ 95% | Emerald badge |
| Suggested | 70–94% | Blue badge |
| Needs clarification | < 70% | Amber badge |

---

## UI location

**Route:** `/admin/operator-inbox` or `/admin/whatsapp`  
**Panel:** Selected packet header → below **Sender identity** → **Client resolution**

Shows likely client, likely owner, confidence, why matched, and up to 3 alternative matches. Label: **read-only · not persisted**. No write buttons.

---

## Hard rules compliance

- No migrations, ownership writes, order/customer/company creation, outbound WhatsApp, Pipeline C, or WA-02B flag changes
- No audit / suggestion persistence
- Runtime resolution only

---

## Known limitations

1. **Sales executive RLS** — may see only assigned companies; suggestions can be partial.
2. **No company nickname table** — alias matching relies on WhatsApp contact names and partial `business_name`.
3. **No client code column** — “Client code 8472” uses weak id-prefix heuristic only.
4. **Employee-heavy traffic** — client must appear in message body; sender phone alone is not used for employee senders.
5. **client_interactions** not wired in v1.

---

*End of WA-04A note.*
