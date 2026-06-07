# Phase 0 Research: Multi-Service Enrollment & Full-Database Sync

This feature is a brownfield extension. Research focused on *how the existing code already works* and the smallest changes that satisfy the spec, rather than greenfield technology selection. The relevant existing files were read: `electron/db/connection.ts`, `electron/db/migrations/index.ts`, `electron/ipc/childrenIPC.ts`, `electron/ipc/paymentsIPC.ts`, `electron/ipc/syncIPC.ts`, `electron/services/mongoSync.ts`.

## Decision 1 — Model multiple services as a child_services (enrollment) table

- **Decision**: Add a `child_services` table (one row per child per service) holding `service`, `unit`, `price`, `is_active`, timestamps, and `synced`. The `children` table keeps its existing `service/unit/price` columns for backward compatibility during migration but they are no longer the source of truth for billing; new code reads enrollments.
- **Rationale**: A child→services relationship is one-to-many; a junction/child table is the normalized fit and lets each service carry its own unit/price (FR-002). It also maps cleanly onto the existing sync engine (each enrollment is an independent record with its own `id`/`synced`, so per-record merge and tombstones work without special cases).
- **Alternatives considered**:
  - *JSON array of services on the `children` row* — rejected: breaks per-service payment uniqueness, per-service conflict resolution, and dashboard revenue-by-service queries; not queryable in SQL.
  - *Keep single `service` column and allow duplicate child rows* — rejected: corrupts identity, search, and statements.

## Decision 2 — Re-key payments on (child_id, service_id, month, year)

- **Decision**: Add `service_id` (FK → `child_services.id`) to `payments` and change the uniqueness constraint from `UNIQUE(child_id, month, year)` to `UNIQUE(child_id, service_id, month, year)`. `payments:generate` iterates each active enrollment and inserts one row per enrollment. The denormalized `service/unit/price` already on the payment row are retained as the historical snapshot.
- **Rationale**: The current `UNIQUE(child_id, month, year)` constraint is the single hard blocker to multi-service billing (FR-004). Re-keying is the minimal schema change that allows one line per service while keeping every existing column. Snapshotting service/unit/price on the payment row keeps historical months unchanged when an enrollment is later edited or removed (FR-007).
- **Implementation note**: `node:sqlite` (like SQLite generally) cannot alter a UNIQUE constraint in place, so migration `005` follows the table-rebuild pattern already used by migration `002` (create `payments_new`, copy, drop, rename). During copy, each legacy payment is matched to its child's single backfilled enrollment to populate `service_id`.
- **Alternatives considered**: *Composite payments keyed only by child+month with a services blob* — rejected for the same reasons as Decision 1.

## Decision 3 — Backfill existing single-service children into one enrollment each

- **Decision**: Migration `004` inserts, for every existing child, one `child_services` row from that child's current `service/unit/price`, reusing a deterministic mapping so legacy payments can be linked in migration `005`.
- **Rationale**: Preserves all historical data with zero manual rework (spec Assumption: "existing single-service children are treated as children with exactly one service enrollment"). Guarantees acceptance scenario US1.4 (a one-service child gaining a second service) starts from a valid state.
- **Alternatives considered**: *Lazy backfill on first edit* — rejected: leaves the DB in a mixed state, complicating payment generation and sync.

## Decision 4 — Per-child status is a derived roll-up, not a stored column

- **Decision**: Each payment line keeps its own `status` (unchanged `calculatePayment`). The child-level status ("paid" all paid / "partial" some / "unpaid" none) is computed on read in `payments:get` by grouping that month's lines per child. Nothing new is stored.
- **Rationale**: Matches the clarified requirement (FR-006a) and avoids a denormalized field that could drift out of sync with the line statuses. Cheap to compute for ~100–150 children.
- **Alternatives considered**: *Store a child_status column* — rejected (YAGNI, drift risk, extra write path).

## Decision 5 — Service removal = hard delete + tombstone

- **Decision**: Removing a service deletes the `child_services` row and writes a `tombstones` row `(entity='child_services', record_id=<id>)`. Previously recorded payment lines for that service are retained (they reference a now-deleted enrollment but keep their snapshot columns). Child deactivation remains a soft delete (`is_active = 0`), unchanged.
- **Rationale**: Clarified answer (FR-007). The payment FK currently uses `ON DELETE CASCADE` to `children`; the new `payments.service_id` FK to `child_services` MUST be defined **without** cascade (or be nullable) so deleting an enrollment does not erase historical payments.
- **Alternatives considered**: *Soft-deactivate enrollment* — rejected by the user's clarification; *block removal when payments exist* — rejected by the user's clarification.

## Decision 6 — Propagate deletions with a uniform tombstones table

- **Decision**: Add a single `tombstones` table `(id, entity, record_id, deleted_at, synced)` and a matching `sync_tombstones` Mongo collection. Any hard delete (currently: service-enrollment removal; extensible to others) writes a tombstone. `sync:push` uploads unsynced tombstones; `sync:pull` reads cloud tombstones and deletes the corresponding local rows so a deletion does not reappear (FR-016).
- **Rationale**: The existing sync has **no deletion propagation** — `pull` only inserts/updates and `push` only sends `synced = 0` rows, so a locally deleted row silently resurrects on the next pull. A central tombstones table is uniform across all entity types and reuses the existing id==_id convention. Minimal and YAGNI-aligned versus a soft-delete column on every table.
- **Alternatives considered**:
  - *`is_deleted` flag per table* — rejected: touches every table and every read query; more invasive.
  - *Full-snapshot overwrite on each sync* — rejected by the user's clarification (per-record merge chosen) and risks wiping concurrent edits.

## Decision 7 — Expand SYNC_ENTITIES to cover the whole database

- **Decision**: Add `child_services`, `users`, and `settings` to `SYNC_ENTITIES` (with new Mongoose models) so a sync truly reconciles the entire database (FR-012). `child_services` and `users` follow the existing integer-`id` pattern. `settings` is keyed by its `key` column (string identity) and needs `updated_at` + `synced` columns added (migration `007`).
- **Rationale**: The spec explicitly enumerates settings and users as part of "everything". Syncing `users` keeps logins consistent across devices; passwords are already bcrypt-hashed so no plaintext is transmitted.
- **Open caution / flagged for tasks**: The `settings` table stores the `sync_mongo_uri` itself and device-local branding asset paths. **Decision**: exclude the `sync_mongo_uri` key (and any other device-local keys) from settings sync to avoid one device overwriting another's connection string; sync all other settings keys. This is implemented as a key denylist in the settings sync path.
- **Alternatives considered**: *Leave users/settings local-only* — rejected: contradicts FR-012's "complete data set" and the user's literal "take everything to all db".

## Decision 8 — Per-record merge already satisfies FR-015a/FR-017; only deletions + entity coverage are missing

- **Decision**: Reuse the existing `resolveConflict` (most-recent `updated_at` wins, higher `id` as tie-break) and the existing per-record pull loop unchanged for conflict handling. The only behavioral additions are tombstone handling (Decision 6) and entity coverage (Decision 7), plus making auto-sync run **push + pull** (today it only pushes when `children` are unsynced).
- **Rationale**: Concurrent edits to *different* records already survive because each record is reconciled independently (FR-015a). Same-record conflicts already resolve deterministically and identically on every device (FR-017). Confirming this avoids rebuilding a working engine.
- **Alternatives considered**: *Field-level merge* — rejected: not required by the spec; record-level most-recent-wins is the clarified default and is far simpler.

## Decision 9 — Auto-sync performs full reconciliation

- **Decision**: Change `startAutoSync` to invoke both push and pull (full reconciliation) on each interval tick when connected, instead of only pushing when `children` have unsynced rows (FR-019).
- **Rationale**: The spec requires auto-sync to perform "the same full reconciliation as a manual sync". The current implementation can miss cloud-originated changes and any non-children local changes.
- **Alternatives considered**: *Push-only auto-sync* — rejected: devices would not converge automatically.

## Resolved unknowns

All Technical Context items are concrete (brownfield code inspected); **no NEEDS CLARIFICATION markers remain**. The three spec ambiguities were already resolved in the `/speckit-clarify` session (sync model = per-record merge; service removal = hard delete + tombstone; combined status = derived roll-up) and are reflected above.
