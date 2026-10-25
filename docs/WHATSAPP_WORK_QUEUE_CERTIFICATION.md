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

Actions: **Claim**, **Return to queue** (own tasks), **Assign/Reassign** and **take over / return someone else's task** (ownership supervisors only), **Complete** (owner, outcome
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
row is touched. Until Core releases it, claim/assign/release fail with a plain message ("Task ownership is not
available yet. Nothing was changed.") and change nothing; the queue still reads and Complete (existing RPC)
still works for tasks that already have an owner.

### Permission audit (read-only production data, 2026-10-24)

| Permission | Risk | Step-up | Roles holding it (active users) |
| --- | --- | --- | --- |
| `wa.intake.read` | standard | no | admin 4, super_admin 5, support_executive 12 |
| `wa.intake.triage` (claim, return own, complete) | sensitive | no | admin 4, super_admin 5, support_executive 12 |
| `wa.intake.assign` (assign, reassign, return others') | sensitive | no | admin 4, super_admin 5, support_executive 12 |
| `wa.intake.close` | high | **yes (AAL2)** | admin 4, super_admin 5 |

Owner policy (applied) and how it is enforced:
1. **Support executives keep claiming, completing and returning their own tasks.** Unchanged and tested with the real
   `support_executive` role.
2. **Assign, reassign and take-over/release of someone else's task are limited to ownership supervisors**: a caller
   must hold `wa.intake.assign` AND a role in the explicit allowlist `whatsapp_ownership_supervisor_role_keys()` =
   `admin`, `super_admin` (9 active users). Core migration `20261024137000`; the UI hides the buttons unless
   `whatsapp_is_ownership_supervisor()` is true, and Core re-checks on every call. **Production permission grants
   are not changed.**
3. **Every override needs a recorded reason** (`20261024136000`) and is flagged `override: true` in the audit event.
4. **Department membership is not inferred** (`users.department` is blank for 19 of 21 operators). Any operator can
   still claim any department's unowned task; that is an owner decision.
5. **AAL2 and existing permission controls are untouched.** Claim, assign, release and complete do not require
   step-up in the current permission model. *Proposal (not enabled):* require step-up for supervisory overrides by
   adding `and public.has_step_up_auth()` to `whatsapp_is_ownership_supervisor()` (or registering a `high_risk`
   `requires_step_up` permission). That blocks admins without MFA, so it needs an owner decision.

Role-impact audit (read-only production data, 2026-10-24): `wa.intake.assign` is granted to `support_executive`,
`admin` and `super_admin` only, via global roles (no scoped-role holders, no deny rules, no user holds two of these
roles). The ownership functions are not yet in production, so **no existing capability is removed**. The 12 support
executives lose only the *new* assign/override abilities that were never released. The roles `assembly_manager`,
`packing_supervisor` and `production_manager` hold no `wa.*` grants and are therefore not in the allowlist; adding
a WhatsApp-specific supervisor role later means a grant change plus a new migration that edits the allowlist.

Other findings:
- **Staff directory:** non-supervisors see only operators who own a task and themselves, without department;
  supervisors see all eligible operators with department. No email or phone. Every `wa.intake.read` holder already
  holds triage today, so no one outside the 21 operators is disclosed.
- **All Conversations** is shown to users with `wa.intake.assign` or `wa.intake.close`. Because support executives
  hold assign, this currently includes them, as the previous inbox did for everyone. It is a UI default, not a
  security boundary (RLS lets any `wa.intake.read` holder query the tables).

## Verification

| Check | Result |
| --- | --- |
| `tsc` | clean |
| eslint on changed files | 0 errors |
| Central `vitest run` | 443 files / 3,232 tests pass at the head that includes the `?view=all` loading-gate fix (routing tests: 6) |
| `vite build` | succeeds |
| Core pgTAP (local disposable DB, 448-migration replay + four ownership migrations) | 28/28 + 23/23 + 24/24 + 11/11 (migrations 135000-138000) |
| Core two-session claim race | A won; B blocked on the row lock then rejected; exactly one claim event |
| Core migration governance, monotonicity, history sequence | pass |
| Visual (desktop 1280x800, phone 390x844) | rendered the real component with fixture data: no horizontal overflow, no runtime errors; first card visible on a phone after filters collapse |

Permission matrix covered in tests: read-only (no actions), triage (claim, complete own, return own),
assigner (assign/reassign/release others), All Conversations visibility, frontline redirect from `?view=all`.

## Not verified / limits (exact)
- **No live authenticated session.** The visual check used fixture data in a harness outside the repo, not
  production data and not a signed-in AAL2 session. Real-data layout, RLS read results and live RPC calls
  were not exercised.
- Core RPCs are not applied to production. Core PR #451 CI replayed all migrations from zero and ran the pgTAP file ("Clean database replay and pgTAP contracts" passed). **Supabase Preview status is contradictory, not a pass:** the first attempt failed on a duplicate ledger key for the old version `20260512160000`; the Supabase bot's later comment shows migrations, seeding and edge functions green after a retry, yet the GitHub check run and branch status still read failed. Preview branches were not reset or recreated.
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
- **Core #451 must be squash-merged (proven).** A simulated squash onto `origin/main` passes `check-migration-history-sequence.sh` (150 commits checked, ceiling `20261024137000`), monotonicity, governance and ledger-freeze; the un-squashed branch fails with `M of canonical migration history` for `0f08a21`. `check-migration-history-sequence.sh` (run on push to main and in the production release preflight, not in PR CI) fails if a branch's history modifies a migration file added by an earlier commit; Core commit `0f08a21` did that to `20261024135000`. A squash merge, as used for #448 and #449, leaves one clean commit.

## Rollback
- Central: revert PR #640 (two commits), or restore `src/pages/OperatorInbox.tsx` and
  `src/components/WhatsAppInbox.tsx` from the checkpoint SHA; Vercel baseline deployment
  `dpl_432rKmunSoUsnwAibhp6ZanvKqjE` (commit d8b3a48) is a rollback candidate.
- Core: additive migration; drop the four functions. No data is written by the migration. Task rows changed
  through use are ordinary column updates with audit events and can be released back to the queue.
- No database snapshot exists or is claimed; production DB must never be rolled back destructively.
