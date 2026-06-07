# Quickstart: Multi-Service Enrollment & Full-Database Sync

How to build, run, and manually verify this feature locally. Assumes the feature-001 app already runs (`npm install` done).

## Build & run

```powershell
npm run dev          # Vite + Electron in watch mode
# or a production build:
npm run build
```

On first launch after pulling this branch, the migration runner applies `004`–`007` automatically (logged to the main-process console). Existing single-service children are backfilled into one `child_services` enrollment each; existing payments are linked to that enrollment.

## Verify multi-service enrollment (User Story 1)

1. Log in as **admin**.
2. **Children → Add**: create a child and select **two services** (e.g. *nursery* + *session*), giving each its own unit and price. Save.
   - Expect: the child saves with both enrollments; adding the *same* service twice is rejected.
3. **Payments**: pick a month/year and **Generate**.
   - Expect: **two payment lines** for that child — one per service — each with its own unit/quantity/price/total.
4. Record a payment on one line only.
   - Expect: that line shows `paid`/`partial`; the **child row shows `partial`** (derived roll-up); the other line stays `unpaid`. Combined total = sum of both lines.
5. Edit the child and **remove** one service.
   - Expect: no new line is generated for it next month; **already recorded** lines for it remain visible in history and in the child's statement.
6. Open the child's **statement** and an **export**.
   - Expect: each service appears per month with correct combined totals.

## Verify full-database sync across devices (User Story 2)

Use two app instances pointed at separate local DBs but the **same** MongoDB URI (e.g. run a second copy with a different `userData` dir).

1. On **Device A** (admin): configure the cloud connection (**Sync** page), then make changes across types — add a multi-service child, record payments, change a setting, add a user. **Push**.
2. On **Device B** (admin): set the **same** MongoDB URI, then **Pull**.
   - Expect: Device B now contains **every** change from Device A across all data types (children, enrollments, payments, salaries, expenses, settings*, users).
3. On **Device A**: **remove a service** from a child, then **Push**. On **Device B**: **Pull**.
   - Expect: the enrollment is **gone on Device B** and does **not reappear** on a later pull (tombstone applied).
4. Edit the *same* record on both devices, then sync both.
   - Expect: most-recent change wins deterministically on **both** devices (same result everywhere).
5. Enable **auto-sync** with a short interval on both devices.
   - Expect: changes propagate both directions without manual push/pull.
6. Disconnect the network and attempt a sync.
   - Expect: a clear failure message; local data unchanged.

\* `sync_mongo_uri` is intentionally **not** synced, so each device keeps its own connection string.

## Automated checks

```powershell
npx vitest run        # unit: status roll-up, migration backfill, tombstone reconciliation, conflict
npx playwright test   # e2e: multi-service child → generate → per-service pay
```

## Rollback note

Migrations are additive/rebuild-in-place and preserve data. To re-test the backfill from scratch, delete the dev `nursery.db` in the app's `userData` directory and relaunch.
