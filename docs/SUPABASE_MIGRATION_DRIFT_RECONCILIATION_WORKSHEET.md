# Supabase migration drift — reconciliation worksheet (Step 1)

**Branch:** `chore/supabase-migration-drift-reconcile`  
**Purpose:** Inventory only. No schema changes, no remote history changes, no deploy.  
**Captured:** `npx supabase@latest migration list` after `git checkout -b chore/supabase-migration-drift-reconcile` (connects to linked remote in `supabase/config.toml`).

---

## 1. Remote-only migration versions

These appear under **Remote** with a **blank Local** column in `migration list`. There is **no** `supabase/migrations/<version>_*.sql` file for that version in this repo.

| Version (UTC time from CLI) |
|----------------------------|
| `20260423214633` (2026-04-23 21:46:33) |
| `20260514185811` (2026-05-14 18:58:11) |
| `20260514185829` (2026-05-14 18:58:29) |
| `20260514185852` (2026-05-14 18:58:52) |
| `20260515073922` (2026-05-15 07:39:22) |
| `20260515073940` (2026-05-15 07:39:40) |
| `20260517072741` (2026-05-17 07:27:41) |
| `20260517151438` (2026-05-17 15:14:38) |
| `20260517152907` (2026-05-17 15:29:07) |
| `20260517203808` (2026-05-17 20:38:08) |
| `20260518074624` (2026-05-18 07:46:24) |
| `20260518075520` (2026-05-18 07:55:20) |
| `20260518210953` (2026-05-18 21:09:53) |

**Count:** 13 remote-only rows.

---

## 2. Local-only migration versions

These appear under **Local** with a **blank Remote** column. Files exist in `supabase/migrations/`, but remote migration history does **not** list them as applied yet.

| Version (UTC time from CLI) |
|----------------------------|
| `20260503201343` (2026-05-03 20:13:43) |
| `20260503215926` (2026-05-03 21:59:26) |
| `20260504035656` (2026-05-04 03:56:56) |
| `20260508155100` (2026-05-08 15:51:00) |
| `20260510120000` (2026-05-10 12:00:00) |
| `20260515120000` (2026-05-15 12:00:00) |
| `20260515120001` (2026-05-15 12:00:01) |
| `20260515194500` (2026-05-15 19:45:00) |
| `20260516200000` (2026-05-16 20:00:00) |
| `20260518220000` (2026-05-18 22:00:00) |

**Count:** 10 local-only rows.

---

## 3. Local migration files that exist (`ls -la supabase/migrations`)

Exact filenames under `supabase/migrations/` (sorted by version prefix):

| File |
|------|
| `20260316122451_bbadbd7b-9e37-467f-b174-96232c0c4fe7.sql` |
| `20260316224020_7d35f99c-5871-4a05-9b56-d10d5660ab0b.sql` |
| `20260317194517_409fc8f4-5db1-47e5-b1de-3d11c9693c4f.sql` |
| `20260318060929_4b5173b4-96aa-456d-8e48-a55c89f0f149.sql` |
| `20260318060955_778b39fe-233b-4f71-93a2-a2c13482b533.sql` |
| `20260320145757_39e58831-d434-4b6a-b5eb-3a29b5845a61.sql` |
| `20260326183622_c0251856-661c-46fe-92ea-11cab045ceda.sql` |
| `20260326221542_ed6bc44b-8ec4-4dc8-be7c-d0bcf37b74c0.sql` |
| `20260327143148_d5aaefca-12c2-4d70-b431-0d4f86760beb.sql` |
| `20260328103258_fc8af159-f71f-4931-97b8-ca089d7ff430.sql` |
| `20260328110331_10623946-780f-4309-8671-c10b3e4e0344.sql` |
| `20260328111505_a7729277-ab0a-4a90-a46d-9cf7f0ba4ec7.sql` |
| `20260328123006_38791861-a6f0-4c21-9da0-569ac2014bfc.sql` |
| `20260328123959_4d8eba20-7f45-43b9-9ada-3ac4476a96d4.sql` |
| `20260328125800_e296d775-1c82-4d9b-9f7d-a9e4959d64a8.sql` |
| `20260328133236_fd360dca-8427-45bd-ad4a-d9f119a4789f.sql` |
| `20260328133628_f02d2f61-4d3b-4702-b196-552ca4949e82.sql` |
| `20260328134152_7c0acfb8-5083-401a-af91-4e204cff7d5a.sql` |
| `20260328135907_aa92c8fa-aa8d-4acb-9944-ef501c038a76.sql` |
| `20260328155611_d58cbc0f-bab8-497e-8e78-32865882c304.sql` |
| `20260328155932_759db656-72c6-47dc-b131-2058d49acbd8.sql` |
| `20260328160736_57b7bd0d-5232-4aa4-b6f9-f39e4c786b98.sql` |
| `20260328164900_f9a00161-daec-4b8d-a08c-e3c41c7fdaf2.sql` |
| `20260328212935_24afb94a-f83a-4031-abda-5940fac5517c.sql` |
| `20260329181011_cf0c9c03-ca8f-48d0-871a-0fa81448f188.sql` |
| `20260329211952_605b4f5a-f30c-4419-82a4-f96d39d376ee.sql` |
| `20260329212754_493d04ef-89e6-461c-935b-786a4ae5fcaa.sql` |
| `20260403111713_3376b25c-4c12-4838-b929-9efaa49f213e.sql` |
| `20260403112258_97fca463-6c89-480f-bff9-5ce32253abb2.sql` |
| `20260404041220_4f0a02d0-2bce-4bfb-831b-2a509e0f2614.sql` |
| `20260406123203_6fb7176b-4f8a-483e-a1e7-afb283cc2921.sql` |
| `20260406194202_51bd0c31-d94e-4edc-af9b-7243230f8fc3.sql` |
| `20260406201149_33376474-8a3d-4e2a-9157-00c6e472b342.sql` |
| `20260406203409_c202009c-fba0-4db3-9754-37527c5f65b2.sql` |
| `20260407090234_fc59a91e-d533-4c01-ba7d-8910abf45d95.sql` |
| `20260407112929_dd020430-4c98-4ddd-8309-dbaf22fcae3f.sql` |
| `20260407115318_ed92ec9c-5d7e-44c3-aceb-bbda7a1f7b2f.sql` |
| `20260407135511_4e3e9d41-01a8-4df8-8f31-e89e9ffe89b9.sql` |
| `20260407150623_1535475b-ad21-4e6d-a6b2-d829832dc394.sql` |
| `20260407161306_62c51cad-7936-48b8-87cc-19a3b50156e0.sql` |
| `20260408071510_eacea421-5317-4bfd-b312-56579fbcfb24.sql` |
| `20260408091702_7866bbd0-9bd1-4656-a1de-297c910a25f8.sql` |
| `20260408095551_5c000ee5-61d7-4e60-a745-9d55d3c75514.sql` |
| `20260409035527_159a2619-4a6e-4df0-9eb4-71ee8255f1db.sql` |
| `20260409040408_4954c5d9-b9cd-4ff6-ad8d-8fd8149d838b.sql` |
| `20260409074536_c0377c70-f981-42b7-994e-a0902cde82b3.sql` |
| `20260410063534_68695304-626f-4e6c-b88b-00c41b4b2c1f.sql` |
| `20260410070342_3b5054da-1185-4b8f-acb7-252cf14c8daf.sql` |
| `20260410113938_7d53424f-2a03-4f2b-a811-bcbd1b4652c1.sql` |
| `20260411112153_df91b082-600a-4f92-8ff9-877e56bc7e02.sql` |
| `20260411124819_fd5c86a0-cb80-41e0-8b58-75403e6fff9b.sql` |
| `20260411213722_3887d579-33ee-4771-96d2-0601f827922f.sql` |
| `20260411215042_23010829-14a0-48b9-a0fc-d33e0fa71ee6.sql` |
| `20260411232922_4efa0706-d24e-47b1-b277-1edf56c2e281.sql` |
| `20260412000610_31ec5e10-bfc0-4efa-9f06-4bd295190756.sql` |
| `20260415073129_7068898e-5f0c-462f-a8ad-12b6c6865383.sql` |
| `20260415114430_50b6a46c-983f-4ff7-a195-883bcc21d4ea.sql` |
| `20260417022356_0da9a04e-412b-4838-a1fb-c3c4e2172322.sql` |
| `20260417113513_ee89e417-a4bb-4cdc-9dd6-4ad6f30ff57a.sql` |
| `20260417122354_357372e9-6b09-4818-982f-3a744336f4d9.sql` |
| `20260417125202_d4fba4ac-38d1-4e69-9263-cd2529e4c66d.sql` |
| `20260417132527_166f4b23-f57e-4358-9d03-dfaac2bcc125.sql` |
| `20260417133645_aebade32-54fc-44b2-a814-02f439bebece.sql` |
| `20260418121859_85a14d4b-cf96-4b08-be4f-8c775cf5d1b6.sql` |
| `20260418135223_8a5d2be4-931d-47c1-b774-19994d1b7e43.sql` |
| `20260418141929_d46f0421-7945-427a-851a-f0ff3016df7e.sql` |
| `20260418160150_24898e81-7a4a-4d15-a093-6ada64310f71.sql` |
| `20260418164728_8182a67f-2953-4579-b544-e7b8c1625264.sql` |
| `20260419073307_307a48c3-d6a4-44ca-8879-f5c0d7762a26.sql` |
| `20260419074858_6d2e4710-4d90-458f-b616-022515b32c23.sql` |
| `20260419105415_f88fcbe8-160e-4a66-aaca-65f036bb3b94.sql` |
| `20260419213453_57ed94ee-a870-4f03-9f73-ed01b80adfed.sql` |
| `20260420043518_c3b1b66a-5c56-4fd2-87af-d932ef0c3add.sql` |
| `20260420044434_6e4d3cf8-d8b1-4094-beba-ef24570c6bc8.sql` |
| `20260420045016_44934221-970b-44e1-9b3d-d0053ff75fe9.sql` |
| `20260420060120_b24913ec-a26d-48c9-a6aa-dd35216e4fa6.sql` |
| `20260420090812_93aedb5d-7b0c-48c3-b627-384c6e8a16b7.sql` |
| `20260420101602_fcf94db5-9d6c-4a7a-a4e9-2994f9cc667b.sql` |
| `20260421045605_2cca8067-e70d-4132-a826-2943dc03c876.sql` |
| `20260421074415_68dfcd03-0ffd-4c1f-9bfc-0543a4fcea36.sql` |
| `20260423214346_f30d294b-923a-44da-9852-e4850ee33488.sql` |
| `20260423214837_bd2aae20-be63-418f-a62b-43366980cac7.sql` |
| `20260423221940_addb309e-b9b0-4d15-a048-19f842515a0c.sql` |
| `20260424111836_79f95cec-b44a-4d19-b2c1-28a94c2b76cb.sql` |
| `20260424140211_f70fa4f2-6e09-425d-9253-272d4c16ec2a.sql` |
| `20260426132530_c248fee6-c23f-4786-9f54-015a7f63b50a.sql` |
| `20260427121337_c31ea530-8d7a-4af4-ad4c-9b7b5ae994ea.sql` |
| `20260503201343_add_request_info_fields_to_b2b_applications.sql` |
| `20260503215926_add_deleted_at_to_users.sql` |
| `20260504035656_add_message_intent_to_debug_webhooks.sql` |
| `20260508155100_phase4_sales_roster_scope.sql` |
| `20260510120000_phase44_dispatch_proof.sql` |
| `20260512160000_orders_human_order_number.sql` |
| `20260515120000_orders_finance_audit.sql` |
| `20260515120001_order_payment_status_on_credit_enum.sql` |
| `20260515194500_buyer_payment_receipt_and_storage.sql` |
| `20260516200000_orders_payment_rejection_reason.sql` |
| `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` |

**Note:** There is **no** file for version `20260423214633` or for any of the other **remote-only** versions in §1; neighbors on disk are `20260423214346_*` and `20260423214837_*`.

**Total files:** 95 `.sql` files (matches `ls` count excluding `.` / `..`).

---

## 4. Remote-only versions — matching local files or placeholders

Each row below needs either:

- A **real** `supabase/migrations/<version>_<slug>.sql` whose body matches what was actually applied for that version (preferred), or  
- A deliberate, reviewed strategy (see resolution plan) — **not** empty placeholders used to silence the CLI without matching reality.

| Version | Local file present? | Action for Step 2+ |
|---------|---------------------|---------------------|
| `20260423214633` | No | Add matching migration file **or** document alternate approved reconciliation. |
| `20260514185811` | No | Same |
| `20260514185829` | No | Same |
| `20260514185852` | No | Same |
| `20260515073922` | No | Same |
| `20260515073940` | No | Same |
| `20260517072741` | No | Same |
| `20260517151438` | No | Same |
| `20260517152907` | No | Same |
| `20260517203808` | No | Same |
| `20260518074624` | No | Same |
| `20260518075520` | No | Same |
| `20260518210953` | No | Same |

---

## 5. Local-only versions — remote verification before “applied”

For each version, **before** any production `db push`, verify on the remote (read-only checks, dashboard, or agreed process) that:

- The **DDL** implied by the file is already present, partially present, or not present (avoid double-apply or destructive reorder).  
- No **conflicting** manual or out-of-band changes exist for the same objects.

| Version | Local file |
|---------|------------|
| `20260503201343` | `20260503201343_add_request_info_fields_to_b2b_applications.sql` |
| `20260503215926` | `20260503215926_add_deleted_at_to_users.sql` |
| `20260504035656` | `20260504035656_add_message_intent_to_debug_webhooks.sql` |
| `20260508155100` | `20260508155100_phase4_sales_roster_scope.sql` |
| `20260510120000` | `20260510120000_phase44_dispatch_proof.sql` |
| `20260515120000` | `20260515120000_orders_finance_audit.sql` |
| `20260515120001` | `20260515120001_order_payment_status_on_credit_enum.sql` |
| `20260515194500` | `20260515194500_buyer_payment_receipt_and_storage.sql` |
| `20260516200000` | `20260516200000_orders_payment_rejection_reason.sql` |
| `20260518220000` | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` |

---

## 6. Commands **not** to run yet (until approved next step)

Do **not** run on production-linked projects without completing `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md` checklist and team sign-off:

```bash
# Do NOT run yet
npx supabase@latest db push
npx supabase@latest db pull
npx supabase@latest migration repair ...
```

Also avoid: ad-hoc **migration repair** against remote, **deploy** of migration apply pipelines that mutate prod, or **direct** DDL on production intended to “fix” drift without aligning files and history.

**Allowed (read-only / inventory):** `migration list`, SQL **SELECT** checks, schema diff review in a clone — as agreed by the team.

---

## 7. Recommended next step (safest)

1. For each **remote-only** version in §1, recover the **exact SQL** that produced that migration record (CI logs, runbooks, dashboard history, DBA notes) and add reviewed `supabase/migrations/<version>_*.sql` files on this branch — see **Option B** in `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md`.  
2. If SQL cannot be recovered for some rows, schedule **Option A** (`db pull` on this branch only) **after** explicit approval and backup, then reconcile generated SQL with §3.  
3. Re-run `npx supabase@latest migration list` until remote-only rows are cleared **or** a documented **Option C** repair plan is executed under backup (last resort).

Only after **Local** and **Remote** columns align for all in-scope versions should **`db push`** be used to apply the **local-only** chain (including `20260518220000`).

---

*End of Step 1 worksheet.*
