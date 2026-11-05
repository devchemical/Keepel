# Disposable local data API tests (issue #91)

These tests exercise real Supabase Auth and PostgREST with two ordinary, synthetic accounts.
They do not mock RLS or use a service-role client. SQL access is reserved for replaying repository
scripts and resetting the disposable test database. Application authentication and analytics
remain governed by ADR0001 and ADR0002.

## Local environment contract

- Bun 1.3+, Docker, Supabase CLI **2.75.0** (the version used to rehearse this stack).
- Project ID: `keepel-issue90-ticket91`; database container: `supabase_db_keepel-issue90-ticket91`.
- API: `http://127.0.0.1:57431`; PostgreSQL: `127.0.0.1:57432`; shadow: `57430`.
- Reserved unused ports: Studio `57433`, mail `57434`, app redirect `57435`, analytics `57437`,
  inspector `57438`, pooler `57439`. Only database/Auth/API gateway/PostgREST are started.
- The API response cap remains 1000 for later pagination tests.
- Email confirmation is disabled **only in this disposable project**. Accounts use unique
  `@example.test` addresses and randomly generated test passwords. No real data or production
  credentials are needed. CLI local keys are read in memory and never written to the repository.
- The harness ignores application Supabase environment variables, checks its fixed endpoint,
  refuses a linked project, and records checkout ownership under ignored `supabase/.temp/`.
- Run one test command at a time. A checkout lock prevents concurrent start/test/stop commands;
  Vitest executes data API files serially because migration tests reset the schema.

From the checkout that owns the test stack:

```bash
bun install --frozen-lockfile
bun run data-api:start
bun run test:data-api
# Optional focused run (each file prepares its own database):
bun run test:data-api --reporter=verbose
# When all tickets using this environment are done:
bun run data-api:stop
```

`test:data-api` destroys and recreates **only this project's local test database**, then replays
`scripts/001` through `006`. Migration tests pause at `004`, seed historical records via the API,
replay `005`, repeat it, and verify the result via the same ordinary client before `006` removes
source columns. Script `003` is currently empty and is still replayed. The standard `bun run test`
suite excludes tests requiring Docker; explicitly use `test:data-api` for these checks.

Stop uses the named local project with `--no-backup`, removing its disposable volumes. Never use
Docker prune, unqualified stop/reset commands, hosted credentials, `--linked`, or `--db-url` here.
If a run is interrupted, check that no harness process remains before removing
`supabase/.issue91-lock`; the next test run recreates the test database. If the project name or
ports are already occupied by another checkout, stop and coordinate with its owner.

## Migration recovery boundary

Run the corrected `005` **before** `006`. Both date and mileage-only forecasts (including zero)
are carried forward as pending; missing optional values remain null. Replaying `005` must not
create duplicate forecasts. Existing completed/cancelled schedules must not be reopened.

If `006` has already run, dropped `next_service_date` and `next_service_mileage` values cannot be
reconstructed from the resulting schema. Recovery requires a verified pre-drop backup/source.
Do not claim that rerunning the corrected script recovers previously dropped data. This harness
rehearses local migrations; it neither changes nor deploys a hosted database.

Official references checked for the local harness:
[Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started),
[CLI configuration](https://supabase.com/docs/guides/local-development/cli/config), and the
[CLI v3 change notice](https://supabase.com/changelog/supabase-cli-v3). The harness deliberately
uses explicit local flags and the installed v2 CLI rather than upgrading during this ticket.
