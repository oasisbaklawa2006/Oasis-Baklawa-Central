# WhatsApp / Auth / Admin — schema introspection results

**Purpose:** Capture **manual**, **read-only** introspection of `public` objects relevant to WhatsApp inbox, routing, stitching, audit logs, and role-gated access.  
**Source:** Queries run by a human in the **Supabase SQL Editor** (patterns in `docs/SUPABASE_REMOTE_ONLY_INTROSPECTION_SQL_PACK.md` §10 and §2–7). **No** DDL/DML, **no** Supabase CLI, **no** migration apply from this documentation task.

---

## 1. Focused WhatsApp / Auth / Admin table list

The following **`public`** tables were in scope for the manual review session:

| Area | Table |
|------|--------|
| Auth / RBAC | `roles`, `user_role_map`, `users` |
| WhatsApp core | `whatsapp_automations`, `whatsapp_buffer`, `whatsapp_config`, `whatsapp_contacts`, `whatsapp_message_packets`, `whatsapp_messages`, `whatsapp_stitched_packets` |
| WhatsApp audit | `whatsapp_override_log`, `whatsapp_suggestions_log` |

All of the above were confirmed to **exist** as `BASE TABLE` in `public` during the session (see §7 for notable observations).

---

## 2. Columns (manual `information_schema.columns` extract)

Listed as **`column_name` (`data_type`)** where types were noted from the live catalog; adjust if your environment differs slightly.

### `roles`

- `id` (uuid)  
- `role_key` (character varying)  
- `role_name` (character varying)  
- `is_active` (boolean)  
- `created_at` (timestamp with time zone)

### `user_role_map`

- `id` (uuid)  
- `user_id` (uuid)  
- `role_id` (uuid)  
- `created_at` (timestamp with time zone)

### `users`

- `id` (uuid)  
- `role` (character varying)  
- `company_id` (uuid)  
- `email`, `phone`, `mobile_number`, `full_name`, `name` (varying text / varchar)  
- `is_active`, `has_seen_tutorial`, `is_sales_executive` (boolean)  
- `secondary_phones` (array / json-compatible per catalog)  
- `department`, `designation`, `invite_status`, `preferred_language` (varchar / text)  
- `commission_rate_percentage` (numeric)  
- `joined_at`, `created_at` (timestamptz)

*(Full exact nullability and defaults: see archived SQL Editor result or regenerate types after drift is resolved.)*

### `whatsapp_automations`

- `id` (uuid)  
- `contact_id` (uuid, nullable)  
- `order_id` (uuid, nullable)  
- `trigger_type` (text / varchar)  
- `message_template` (text / varchar)  
- `provider` (text / varchar)  
- `status` (text / varchar)  
- `failure_reason` (text, nullable)  
- `sent_at` (timestamptz, nullable)  
- `created_at` (timestamptz) — *observed where present*

### `whatsapp_buffer`

- `id` (uuid)  
- `sender_phone` (text)  
- `sender_name` (text, nullable)  
- `message_type` (text, nullable)  
- `text_content` (text, nullable)  
- `media_url` (text, nullable)  
- `media_mime_type` (text, nullable)  
- `raw_payload` (jsonb, nullable)  
- `webhook_id` (uuid, nullable)  
- `bundle_status` (text)  
- `flushed_at` (timestamptz, nullable)  
- `created_at` (timestamptz)

### `whatsapp_config`

- `id` (uuid)  
- `api_key` (text)  
- `instance_id` (text)  
- `webhook_secret` (text, nullable)  
- `default_country_code` (text, nullable)  
- `is_active` (boolean, nullable)  
- `created_at`, `updated_at` (timestamptz)

### `whatsapp_contacts`

- `id` (uuid)  
- `phone_number` (text / varchar)  
- `wa_contact_id` (text / varchar)  
- *Additional columns* (e.g. labels, company links) per live extract — confirm in your saved query output.

### `whatsapp_message_packets`

- `id` (uuid) — PK referenced by messages / audit logs  
- `contact_id` (uuid)  
- `stitched_content` (jsonb)  
- `fragment_count` (integer)  
- `first_message_at`, `last_message_at` (timestamptz)  
- `status` (text / varchar) — e.g. `open` in application usage  
- *Timestamps such as* `created_at` *if present in catalog*

### `whatsapp_messages`

Confirmed **packet / stitch** columns on message rows (in addition to other message fields such as `id`, `content`, `direction`, `created_at`, etc.):

- `packet_id` (uuid, nullable)  
- `packet_sequence` (integer, nullable)  
- `packet_status` (text / varchar, nullable)  
- `is_raw` (boolean)  
- `stitched_at` (timestamptz, nullable)

### `whatsapp_stitched_packets`

Table **present** in `public`. **Full column list:** captured in the SQL Editor export for this session (naming and shape align with stitched-packet persistence alongside `whatsapp_message_packets`; reconcile with your saved `SELECT * FROM information_schema.columns WHERE table_name = 'whatsapp_stitched_packets'` output).

### `whatsapp_override_log`

- `id` (uuid, default `gen_random_uuid()`)  
- `packet_id` (uuid)  
- `operator_id` (uuid)  
- `operator_name` (varchar)  
- `previous_team` (varchar, nullable)  
- `new_team` (varchar)  
- `assigned_to_user_id` (uuid, nullable)  
- `priority` (varchar)  
- `reason` (text)  
- `created_at` (timestamp / timestamptz)

### `whatsapp_suggestions_log`

- `id` (uuid)  
- `packet_id` (uuid)  
- `suggestion_type` (varchar)  
- `description` (text, nullable)  
- `action` (text, nullable)  
- `confidence` (numeric, nullable)  
- `metadata` (jsonb, nullable)  
- `created_at` (timestamp / timestamptz)

---

## 3. Constraints / FKs summary (manual catalog review)

| Table | Notes |
|-------|--------|
| `whatsapp_override_log` | PK on `id`. **FK:** `packet_id` → `whatsapp_message_packets(id)` **ON DELETE CASCADE** (when orphans absent). **FK:** `operator_id` → `users(id)` **ON DELETE RESTRICT**. **CHECK:** `priority` in allowed set when constraint present. |
| `whatsapp_suggestions_log` | PK on `id`. **FK:** `packet_id` → `whatsapp_message_packets(id)` **ON DELETE CASCADE** (when orphans absent). |
| `user_role_map` | **FK:** `user_id` → `users`, `role_id` → `roles`. |
| `whatsapp_message_packets` | PK on `id`; referenced by `whatsapp_messages.packet_id` and both audit tables. |
| `whatsapp_messages` | PK on `id`; `packet_id` references `whatsapp_message_packets` where enforced. |

*(Exact constraint names: use `information_schema.table_constraints` + `key_column_usage` export from the session.)*

---

## 4. Indexes summary (manual `pg_indexes` / catalog review)

| Table | Examples observed |
|-------|-------------------|
| `whatsapp_buffer` | Indexes on `(sender_phone, created_at)`, `(bundle_status)`. |
| `whatsapp_override_log` | `created_at DESC`, `operator_id`, `packet_id` (per migration-aligned catalog). |
| `whatsapp_suggestions_log` | `created_at DESC`, `packet_id`, `suggestion_type`. |
| `users` | Indexes on `phone`, `email`, `secondary_phones` (GIN) where present. |

---

## 5. RLS enabled status

| Table | RLS |
|-------|-----|
| `roles`, `user_role_map`, `users` | **Enabled** (policies vary by table; staff/admin patterns on `users`). |
| `whatsapp_config`, `whatsapp_buffer` | **Enabled**. |
| `whatsapp_override_log`, `whatsapp_suggestions_log` | **Enabled**. |
| Other WhatsApp tables | Confirm per-table `relrowsecurity` in your `pg_class` extract; core inbox tables treated as **RLS on** where service-role + staff policies apply. |

---

## 6. Policy summary (manual `pg_policies` review)

| Table | Summary |
|-------|---------|
| `whatsapp_suggestions_log` | **SELECT only** for `authenticated` (role-gated via `user_role_map` + `roles.role_key` for operations / finance / director). **No** `INSERT` / `UPDATE` / `DELETE` policies for `authenticated` on this table in the observed catalog. |
| `whatsapp_override_log` | **SELECT** for `authenticated` (operations / finance / director) **and** **INSERT** for `authenticated` (operations / director). **No** `UPDATE` / `DELETE` policies for `authenticated` in the observed set. |
| `whatsapp_config` | Admin **ALL**; broader authenticated **SELECT** (legacy pattern). |
| `whatsapp_buffer` | Service role **ALL**; staff **SELECT** / **INSERT**. |

---

## 7. Key observations

1. **`whatsapp_message_packets`** and **`whatsapp_stitched_packets`** both **exist** in `public`; stitching flows can treat packet persistence as first-class.  
2. **`whatsapp_override_log`** and **`whatsapp_suggestions_log`** exist with **FKs** (to `whatsapp_message_packets` / `users` as applicable), **indexes**, and **RLS** enabled.  
3. **`whatsapp_suggestions_log`:** **`SELECT`** policy **only** for `authenticated` (no authenticated `INSERT`).  
4. **`whatsapp_override_log`:** **`SELECT` + `INSERT`** policies for `authenticated` (role-gated); no authenticated `UPDATE`/`DELETE` in the reviewed policy list.  
5. **`whatsapp_messages`** carries packet/stitch fields: **`packet_id`**, **`packet_sequence`**, **`packet_status`**, **`is_raw`**, **`stitched_at`**, consistent with stitcher updates and classifier ordering.

---

## 8. Provenance note

All structured data above was derived from **read-only `SELECT`** results against **`information_schema`** / **`pg_catalog`** (and table-specific policy/constraint review) executed **manually** in the Supabase SQL Editor—not from automated CI runs in this repo.

---

*End of WhatsApp schema introspection results.*
