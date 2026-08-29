# APPVERSE THREAD / AGENT ROUTING GUARDRAIL

This repository is part of the Oasis Baklawa Appverse completion programme. The canonical programme index is `APPVERSE_MISSION_CONTROL.md` in `oasisbaklawa2006/Oasis-Baklawa-Central`.

## Primary objective

Complete the Appverse. Do not optimize for PR count, agent activity, or local thread completion at the expense of the programme critical path.

## Mandatory instruction envelope

Before making a material change, an execution agent must be able to identify:

- `ASM-ID` — the assigned Mission Control work item/stage.
- `THREAD-ID` — the execution lane/thread identity.
- `REPOSITORY` — the repository authorized for mutation.
- `MISSION` — the exact bounded outcome.
- `DEPENDENCIES` — upstream gates/PRs that must be satisfied.
- `STOP CONDITION` — the evidence or blocker at which the agent returns control.

If context from an existing thread makes these unambiguous, do not demand that the user restate them. Infer them from the current assignment and preserve them.

## Fail-closed routing rule

If a new instruction, pasted agent response, or requested code change belongs to a different workstream or repository than the receiving thread's current scope:

1. **DO NOT EXECUTE IT.**
2. Do not edit code, migrations, configuration, workflow, or documentation to make it fit.
3. Do not open/modify a PR for it.
4. Do not deploy or mutate production.
5. Do not silently expand the current mission.
6. Respond exactly with the routing outcome:

`ROUTING REJECTED — instruction does not belong to this thread.`

Then identify the likely `ASM-ID` / workstream when evidence permits and state:

`No code, PR, migration, deployment, or scope expansion performed.`

Stop and return the item to Mission Control.

## Cross-scope discovery rule

An agent may discover a defect outside its scope. It may collect minimal evidence needed to describe the dependency, but must not fix the foreign-scope defect unless Mission Control explicitly reassigns/expands the ASM work item.

## Dependency guardrail

If the assigned mission depends on an upstream PR/gate that is not satisfied, mark the work `BLOCKED` and stop at the last safe boundary. Do not simulate the missing authority, fabricate schema/data/IDs, bypass guards, or build a parallel replacement.

## Clearance guardrail

`PR MERGED` is evidence, not programme clearance. Never report a stage/module as complete unless all ASM mandatory gates for that scope are satisfied. Use precise statements such as `code merged`, `software-certified`, `physical UAT pending`, or `production-ready` rather than collapsing them into `done`.

## Repository ownership guardrail

Repository-local ownership rules remain mandatory and may be stricter than this document. In particular, the canonical database migration ledger belongs to `oasis-supabase-core`. A non-Core agent must not create a shadow migration history.

## Return-to-Mission-Control triggers

Return control when any of these occurs:

- assigned stage/substage gate is satisfied;
- PR is opened or materially changes dependency state;
- genuine blocker is discovered;
- cross-repository authority is required;
- scope ambiguity would alter architecture/business rules;
- merge-ready or merged milestone is reached;
- production or physical-device action is the only remaining gate.

Routine intermediate progress remains in the execution thread and should not be copied into Mission Control unless needed for routing or a state transition.
