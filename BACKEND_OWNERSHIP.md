# Backend Ownership Boundary

This repository is the Oasis Central / ERP operations application repository.

It is not the canonical Supabase backend authority.

Canonical backend repository:

- oasis-supabase-core

Central may contain ERP UI, order workflows, dispatch, finance, catalogue consumption, WhatsApp operator UI, and application-layer business logic.

Central must not casually own or deploy:

- supabase/functions
- supabase/migrations
- supabase/config.toml
- production database schema changes
- RLS policy changes
- storage policy changes

High-risk rule:

Do not deploy whatsapp-webhook from this repository.

Current verified status:

- oasis-supabase-core created and pushed
- whatsapp-studio-inbox-bridge deployed from oasis-supabase-core as v17
- bridge secret rotated
- dry run passed
- resolver SQL verification passed
- BRIDGE_ENABLED=false retained for safety
- legacy whatsapp-webhook untouched
- Supabase production auto-deploy remains OFF

Backend infrastructure changes must be routed through oasis-supabase-core.
