# Media / document vault — foundation status

Last updated: 2026-05-24

## Scope

**Metadata-only** visibility for future invoices, receipts, packing photos, dispatch proofs, label previews, WhatsApp attachment hints, customer references, and support media. **Not** a storage product in this PR.

## Delivered

| Path | Purpose |
|------|---------|
| `src/lib/media-vault/mediaVaultTypes.ts` | Document kinds, groups, backend status |
| `src/lib/media-vault/mediaVaultProjection.ts` | Shell catalog + grouping helper |
| `src/lib/operational-events/mediaFeed.ts` | `buildMediaOperationalFeed` → `OperationalEventRecord[]`, `occurredAt: null` |
| `src/pages/admin/MediaDocumentVault.tsx` | Grouped cards, chips, filters, projection timeline |
| `/admin/media-vault` | Route + sidebar (moduleKey `orders`) |

## Operational kinds

See `MediaOperationalEventKind` in `src/lib/operational-events/types.ts` (`media.*` namespace).

## What is real

- Honest shell rows marked **Shell sample** in UI; deterministic ids for tests.
- Operational feed rows use `entities` with `entityType: "document"` for future linking.

## What is shell / pending backend

- Blob storage, signed URLs, virus scan, RLS on document rows, upload UI, and customer-facing download gates.

## Safety

- No uploads and no binary duplication in-app.
- No public sharing links.
- No Edge or migration in this foundation.

## Next backend work

- Storage provider + bucket policy + metadata table (with RLS) in a reviewed migration PR.
- Virus scan / MIME allowlist before any customer-visible path.
