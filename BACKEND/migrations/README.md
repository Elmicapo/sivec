# SIVEC MySQL migrations

The migration executor is `../scripts/migrate.js`. It is a manual CLI tool; the
application server does not run migrations at startup. MySQL remains the
required engine.

## Safety and execution

- The default CLI path requires an explicit `--database` and accepts only names
  under `sivec_restore_test_*`, `sivec_migration_test_*`, or `sivec_isolated_*`.
  The separate original-database path allows exactly `deportes` and requires
  `--allow-original-deportes`, `--confirm-target=deportes`, and a signed backup
  manifest. The special flags cannot be combined with any other database.
- The original path pins the only accepted migration files and SHA-256 values:
  `001` `a2d81f10b96dbde358ed13c1d5efcd748b19a27986e1954d05c5b60c9770305a`,
  `002` `afa336878261af47a9553d1dc9b22600578b1af0126a3661c1904bd5b3f65aa1`,
  and `003` `8c586a9cdc69933ee91bd45782bea13cd0d776947c40e73333a44f2f3d0e3845`.
- It connects only to an existing database; it never creates, drops, or
  reconstructs a database. The original-database path creates only the
  migration ledger before the first migration; `--preflight-only` performs no
  database writes.
- It acquires a per-database MySQL advisory lock, records version/name/SHA-256
  checksum/status/timestamps in `sivec_schema_migrations`, skips unchanged
  applied versions, and stops on checksum drift, stale `RUNNING`, or `FAILED`
  state.
- MySQL DDL may commit implicitly. A failed migration is not automatically
  retried: the executor records the failing version/error and stops. It does
  not roll back DDL. Inspect the partial schema and follow the manual recovery
  procedure below; do not edit migration files or delete the ledger.
- Credentials come from `BACKEND/.env`; never print or commit that file.

Run from `BACKEND`:

```powershell
node scripts/migrate.js --database=sivec_restore_test_20261104_484fe0eb
node scripts/migrate.js --database=sivec_restore_test_20261104_484fe0eb --status
node --test
node scripts/verify-migrations.integration.js
node scripts/verify-veeduria.integration.js
```

The integration verifier is deliberately fixed to the restored isolated test
schema above. Its data probes run in one transaction and are rolled back.

## Preparing the guarded `deportes` run

This procedure is implemented but has **not** been run against `deportes`.
Do not proceed without an approved backup artifact and an isolated restoration.
The isolated restoration must be an unmodified restore of the same backup on
the same MySQL host/port and MySQL version as `deportes`; a copy that already
has migrations 001–003 is not a suitable baseline.

1. Keep the dump and restoration log outside the repository. Confirm the
   restoration independently and record a line exactly matching
   `RESTORE SUCCESS: sivec_restore_test_<suffix>` in the evidence file. The
   script hashes both files and compares exact schema definitions and table
   row counts between the isolated restoration and `deportes`. This establishes
   parity and a tamper-evident operator attestation; the marker itself cannot
   prove how the restoration was performed.
2. Set `SIVEC_BACKUP_MANIFEST_KEY` in the process environment to a securely
   generated secret of at least 32 UTF-8 bytes. Use the same secret to create
   and verify the manifest; do not put it in source control or command history.
3. From `BACKEND`, generate the signed manifest. Replace each path and the
   isolated database suffix with the actual, reviewed values:

   ```powershell
   node scripts\prepare-deportes-backup-manifest.js --restored-database=sivec_restore_test_baseline_20261105 --backup-file="D:\backups\SIVEC-deportes.sql" --restore-evidence="D:\backups\restore-evidence.txt" --manifest-out="D:\backups\deportes.manifest.json"
   ```

   The manifest is created with exclusive file creation and includes the
   backup/evidence SHA-256 values, source server identity/version, exact
   baseline schema fingerprint and row counts, and the isolated restore
   fingerprint/counts. This script uses read-only database transactions; it
   does not run migrations or modify database data.
4. First run this read-only preflight and review the reported host, port,
   version, migration state, table counts, trigger definition and current view
   definition:

   ```powershell
   node scripts\migrate.js --database=deportes --allow-original-deportes --confirm-target=deportes --backup-manifest="D:\backups\deportes.manifest.json" --preflight-only
   ```

5. Only after separately reviewing and approving that output, the planned
   execution command is. Pause application writes for the migration window;
   the executor compares baseline counts before each version and stops if they
   change:

   ```powershell
   node scripts\migrate.js --database=deportes --allow-original-deportes --confirm-target=deportes --backup-manifest="D:\backups\deportes.manifest.json"
   ```

   This code path is restricted to exactly versions `001`, `002`, and `003` in
   order. It rechecks the signed manifest, backup/evidence hashes, connected
   database/server/version, baseline counts, prior ledger state and the
   structural preflight before each version. The first migration also removes
   `trg_oficializar_semaforo` as specified by D1; validation remains separate
   from officialization.

## Failure, postflight, and recovery

- Each migration has preflight and postflight checks. Postflight verifies the
  D1 columns, constraints/indexes and trigger removal; Reportar tables,
  columns, constraints/indexes and replacement view; the decision-history
  table, columns, foreign keys, check and indexes; and finally the exact
  `APPLIED` ledger rows/checksums for 001–003.
- A failed version is marked `FAILED` when possible, its version and error are
  printed, and later versions are not run. MySQL may have committed some DDL
  before the failure. There is no automatic DDL rollback or automatic retry.
- Stop application writes and preserve the failed database and its ledger for
  diagnosis. Do not delete the ledger, edit an applied migration, or rerun the
  command as a repair. Restore the verified dump to a **separate** isolated
  database using the reviewed restore procedure; verify its schema and counts,
  then repeat the isolated migration and application tests there.
- If the original database must be recovered, prepare and validate the restore
  on a separate instance first. Replacing/restoring `deportes` is a distinct,
  potentially destructive operation and requires separate explicit approval
  and a controlled maintenance/cutover procedure. This executor never performs
  that recovery.
- None of the preflight or apply commands above have been run against
  `deportes` as part of this code change.

## Applied versions in the isolated restore

| Version | Scope |
|---|---|
| `001` | D1 schema support: separate officializer and `DATETIME` field for UTC writes, CMJ-profile FK, paired-null check, unique report-to-history relation, and removal of the automatic semáforo trigger. |
| `002` | Report intake: nullable legacy `id_reportante`, structured new-scenario proposals/review history, mandatory name/email snapshots, unique tracking digest, receipt-to-report/scenario relations, and private-evidence metadata constraints. |
| `003` | Adds report decision history for receipt, validation, and rejection. Applied and verified on the isolated restore. |
| `005` | Adds the physical scenario type to proposals and nullable structured territorial fields to official scenarios. Applied and verified on the isolated restore. |

## Migration status by target

The migration files `001`–`005` are implemented in this repository. Versions
`001`–`005` have been applied and verified only in
`sivec_restore_test_20261104_484fe0eb`, restored from the verified backup.
None of these versions has been applied to the original `deportes` database or
any production database. The guarded `deportes` mode is implemented but
remains unused until the backup evidence is prepared, the read-only preflight
is reviewed, and the operator explicitly approves the execution command.

Migration `005_scenario_type_and_territory.js` was applied only to the same
isolated test database. It has not been applied to `deportes`.

## Prepared authentication registration migration

`004_public_registration_and_trainer_requests.js` was applied to the isolated
test database only. It adds unique email and identification
indexes only after checking existing non-null values for duplicates, and creates the pending trainer-to-
discipline request table with administrative resolution tracking. An
administrator's approval creates the existing `disciplina_entrenador`
association; a public registration never creates that association directly.
The migration does not rewrite user/person rows or passwords.

The isolated-target executor discovers version 004, but its original
`deportes` allowlist remains pinned to versions 001–003 and deliberately
excludes 004. It has not been applied to `deportes`.

## Boundaries still enforced by future services

MySQL enforces a maximum of five evidence slots and the per-file byte/dimension
limits. The minimum of one photograph and the 20 MB accumulated limit require
transactional application validation; cross-row aggregates are not enforced by
these checks. File-content inspection, EXIF removal, optimization and private
object storage are not implemented here. The approved events/provider and
retention policy for email and evidence remain pending.

The backend uses capability-specific schema guards. Existing report and D1
officialization endpoints require migrations `001`–`003`; scenario proposal
endpoints require the proposal chain `001`, `002`, and `005`, without requiring
the unrelated trainer-request migration `004`. Public trainer registration
requires migration `004` before creating any account records. Each guard fails
closed with HTTP `503` and a controlled schema-readiness code unless its
required versions are recorded as applied. The original `deportes` database
has not been migrated.

The backend now contains public intake, protected CMJ queries, report
validation, a separate queue for reports eligible for D1 officialization, and
the independent officialization operation. Validation never updates the
scenario; only the CMJ officialization transaction updates the semáforo and
history. Application role checks and a `cmj_consejero` profile check are both
required.
