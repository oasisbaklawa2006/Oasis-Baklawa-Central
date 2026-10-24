# WhatsApp work queue — certification evidence

Mission Control: Central #638 (ASM-06 WhatsApp). Recovery baseline: Central #639, checkpoint
`checkpoint/wa-uiux-pre-simplification-20261025` = `d8b3a488506f1c950adf6a03a58cb03d4715ef6e`.
Central PR #640. Backend dependency: Core PR #451 (`20261024135000_whatsapp_case_task_ownership_v1.sql`).

`PR MERGED != STAGE CLEARED`. Nothing here is merged, released or deployed.

## What changed for staff
`/admin/operator-inbox` (and `/admin/whatsapp`) now opens on a **work queue**:

| View | Contents |
| --- | --- |
| Needs Action (default) | Active tasks not mine and not waiting, most urgent first, unassigned ahead of owned |
| My Tasks | Active tasks assigned to me |
| Waiting | Blocked tasks, and tasks on cases awaiting the customer or clarification |
| Completed | The 100 most recently completed tasks |
| All Conversations | The existing full console; only users with `wa.intake.assign` or `wa.intake.close` |

Each card: customer (or phone), identity status, one-line summary, urgency, department, owner, next
action, due time. Search covers customer, phone, summary, department, owner and case type; filters cover
department, urgency and unverified-only. No UUIDs, packet ids, rule versions or JSON are shown.

Actions: **Claim**, **Assign/Reassign** (managers), **Return to queue**, **Complete** (owner, outcome
required), **Reply / Follow up / Verify customer / Ask for help** (open the existing conversation console for
that packet, where the governed identity, clarification, reply and escalation controls already live).

The full console is unchanged apart from progressive disclosure (PR #640 first commit) and a "Back to work
queue" bar. Existing `?packet=<id>` deep links still open it for any inbox reader.

## Reused, not duplicated
- AI: the summary and next action come from the existing AI case routing (`instructions`, `next_action`) and
  are labelled "AI suggestion". The AI decision desk, classify/route suggestions and drafting stay in the
  console. No new model call, edge function or AI service was added.
- Completion: `whatsapp_complete_case_task` (permission, non-empty response, idempotency, audit event).
- Authority: `has_whatsapp_permission` / RLS. Claim needs `wa.intake.triage`; assign needs `wa.intake.assign`;
  step-up (AAL2) applies wherever a permission is configured `requires_step_up`; none of that was changed.

## Governed ownership (Core PR #451)
`whatsapp_claim_case_task`, `whatsapp_assign_case_task`, `whatsapp_release_case_task`, plus read-only
`whatsapp_case_staff_directory`. Row-locked, idempotent per key, append-only audit events
(`DEPARTMENT_TASK_CLAIMED/ASSIGNED/RELEASED`, with previous owner). Nothing is auto-assigned; no historical
row is touched. Until Core releases it, claim/assign/release fail with a plain message and change nothing;
the queue still reads and Complete (existing RPC) still works for tasks that already have an owner.

## Verification
| Check | Result |
| --- | --- |
| `tsc` | clean |
| eslint on changed files | 0 errors |
| Central `vitest run` | 443 files / 3,226 tests pass (34 added in this step: model 16, component 13, routing 5; 5 contract tests were added in the first commit) |
| `vite build` | succeeds |
| Core pgTAP (local disposable DB, 448-migration replay + this migration) | 28/28 |
| Core two-session claim race | A won; B blocked on the row lock then rejected; exactly one claim event |
| Core migration governance, monotonicity, history sequence | pass |
| Visual (desktop 1280x800, phone 390x844) | rendered the real component with fixture data: no horizontal overflow, no runtime errors; first card visible on a phone after filters collapse |

Permission matrix covered in tests: read-only (no actions), triage (claim, complete own, return own),
assigner (assign/reassign/release others), All Conversations visibility, frontline redirect from `?view=all`.

## Not verified / limits (exact)
- **No live authenticated session.** The visual check used fixture data in a harness outside the repo, not
  production data and not a signed-in AAL2 session. Real-data layout, RLS read results and live RPC calls
  were not exercised.
- Core RPCs are not applied to production. Core PR #451 CI replayed all migrations from zero and ran the pgTAP file ("Clean database replay and pgTAP contracts" passed). Its **Supabase Preview check failed** with `duplicate key ... schema_migrations_pkey (20260512160000)`, a version that predates this change by months and is inserted by the preview branch machinery, not by this migration. Every other preview branch (main, #417, buyer release) is already `MIGRATIONS_FAILED`. Preview branches were not reset or recreated (not permitted); this stays an open infrastructure issue, not a verified pass.
- **No department scoping.** The schema has no user-to-department rule, so "within permitted scope" is the
  permission itself: any `wa.intake.assign` holder can assign any task to any eligible triage user.
- The All Conversations gate is a UI default, not a security boundary: RLS still lets any `wa.intake.read`
  holder query the underlying tables.
- Staff directory names come from `users.full_name`/`name`; users without one show as "Staff xxxxxxxx".
- Needs Action lists up to 500 active tasks (flagged when truncated); Completed is capped at 100.
- 62 open Customer Service tasks have no owner today; they will appear unassigned. Staffing them is a
  business decision and is not done here.
- "Ask for help" and "Follow up" open the existing console; there is no new one-click escalation.
- Release order: Core #451 (protected migration release) before relying on ownership actions in Central.

## Rollback
- Central: revert PR #640 (two commits), or restore `src/pages/OperatorInbox.tsx` and
  `src/components/WhatsAppInbox.tsx` from the checkpoint SHA; Vercel baseline deployment
  `dpl_432rKmunSoUsnwAibhp6ZanvKqjE` (commit d8b3a48) is a rollback candidate.
- Core: additive migration; drop the four functions. No data is written by the migration. Task rows changed
  through use are ordinary column updates with audit events and can be released back to the queue.
- No database snapshot exists or is claimed; production DB must never be rolled back destructively.
