# Issue #90 acceptance matrix

Current source: integration `934de21` plus ticket #97. Execute the serial commands in
[README](../../README.md#verificación-reproducible); CI uses those same commands.
UI = `bun run test:e2e`; API = `bun run test:data-api`; unit/integration = `bun run test`.
Paths below are under `tests/`. Controlled UI tests simulate transport failures; ordinary real
API tests prove persistence, SQL atomicity, ownership and constraints independently.

| #90 story                  | Observable acceptance and automated evidence                                                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 scheduled list           | UI `e2e/scheduled-services.spec.ts`: persisted forecasts appear in dashboard list and count; API `data-api/scheduled-services.test.ts`                                                                                                                          |
| 2 pending/overdue/resolved | Same suites: only pending selection; completed/cancelled excluded; `unit/data/scheduled-services.test.ts`                                                                                                                                                       |
| 3 date OR mileage          | Same suites: either criterion triggers; unreached mileage gets no invented date                                                                                                                                                                                 |
| 4 explicit resolution      | UI `e2e/maintenance-batch.spec.ts`, API `data-api/maintenance-batch.test.ts`: selected forecast links selected row, same-type alone does not resolve                                                                                                            |
| 5 today remains today      | UI scheduled journeys in opposing zones; unit scheduled boundaries yesterday/today/30/31 days                                                                                                                                                                   |
| 6 calendar days            | `unit/data/calendar-timezones.test.ts` (LA/Kiritimati/Apia/UTC, DST); UI scheduled and history recent-activity journeys in LA/Kiritimati; API exact persisted date                                                                                              |
| 7 vehicle cascade          | UI `e2e/data-recovery.spec.ts`; API `data-api/isolation-and-cascades.test.ts`; real-browser history journey verifies count/cost/history/schedules removed                                                                                                       |
| 8 identity propagation     | UI data-recovery identity edit updates history/reminders/dashboard from current owned vehicle                                                                                                                                                                   |
| 9 load error vs empty      | UI data-recovery initial failure, history initial failure, explicit retry; successful empty has separate state                                                                                                                                                  |
| 10 retain/retry            | UI failed vehicle refresh and history navigation retain valid data; failed post-write refresh explicitly invalidates stale page/totals and retries                                                                                                              |
| 11 partial batch           | UI maintenance-batch retains incomplete rows; shared validation omits only wholly empty rows; API maintenance-batch rejects invalid batches atomically                                                                                                          |
| 12 strict numbers          | API maintenance-batch + data-commands reject negatives/fractions/partial parses/exponents; shared unit maintenance validation; UI partial-row blocking and required schedule criteria                                                                           |
| 13 zero vs null            | API exact zero/NULL reads; UI scheduled create/edit, maintenance edit/batch, history and recent activity show zero and missing values distinctly; vehicle overview/list use nullable formatter                                                                  |
| 14 recent odometer         | API maintenance-batch: nonfuture performed day can raise mileage transactionally                                                                                                                                                                                |
| 15 historical odometer     | Same API: older/lower/future values, edits/deletes/concurrent batches never reduce odometer                                                                                                                                                                     |
| 16 slow/unknown writes     | UI data-recovery delayed create, lost response, cancellation, reload/status lookup; API real commit with lost response, immutable receipts, concurrent idempotency                                                                                              |
| 17 actual confirmation     | UI zero-row/rejected delete stays open; API affected-row errors reject, matching immutable receipt required, lookup failure stays unknown                                                                                                                       |
| 18 complete history        | UI tied53 rows/page failures/navigation/reset; API >1000 cap; `real-api-e2e/history.spec.ts` traverses1007 IDs/41pages exactly once                                                                                                                             |
| 19 complete totals         | Same suites verify totals independent of page/recent5, full account/vehicle scope, CRUD invalidation                                                                                                                                                            |
| 20 one owner               | DataContext owns reads/writes/invalidation; UI old-session read suppression and receipt recovery, no new cache/client/auth authority                                                                                                                            |
| 21 shared contracts        | `test:schema` compares real public schema001–009 to generated types; shared calendar/numeric/schedule/type modules consumed by add/edit forms and command boundaries                                                                                            |
| 22 regression coverage     | All unit/integration, controlled UI, ordinary real API and real-browser suites required by CI                                                                                                                                                                   |
| 23 mandatory quality       | CI frozen install, full format/lint/types, all suites, generated schema check, configured build with TypeScript enabled                                                                                                                                         |
| 24 analytics               | **Scoped exception explicitly chosen by user:** retain ADR0002. Defer CRUD attempt/success/error events and all resource IDs. Existing consented property-free server auth success allowlist stays; `unit/analytics`, `unit/privacy`, UI privacy tests guard it |
| 25 reproducibility         | Supabase JS pinned2.108.1, lockfile frozen, README Node>=20.9/Bun/CLI/Docker/migrations, consumer-searched cleanup below                                                                                                                                        |

## Decisions and stale assumptions reconciled

- ADR0001/0002 and domain guidance now exist; authentication remains server-authoritative.
  The old spec's “no tests/ADRs” audit describes its starting point, not current source.
- Explicit pending/completed/cancelled schedules, local-day OR reached-mileage selection,
  30-day date horizon, transactional completion/odometer and null semantics are implemented.
- SQL001–009 rehearsed serially. Migration tests pause at004, seed ordinary accounts, run005
  twice, preserve zero/mileage-only/date-only/mixed forecasts, then006. Dropped legacy columns
  cannot be recovered without a verified pre-drop source. No hosted migration is performed.
- Query projections/keyset pagination and independent totals are exercised beyond the1000-row
  response cap. Index plans were rehearsed against100k synthetic rows in #96; see
  [history-pagination.md](history-pagination.md). No SQL/index change in #97, so that destructive
  comparison rehearsal is not unnecessarily repeated. `test:schema` restores canonical009.
- Security follow-up remains private; public acceptance uses two ordinary synthetic accounts.
  No production data/credentials, new auth authority, cache/framework or visual redesign.
- Retired after repository-wide consumer search: `add-vehicle-dialog-context.tsx` (alternative
  had partial integer parsing), `dropdown-menu-backup.tsx`, unused context provider/AppProviders
  barrel re-exports and hooks useMediaQuery barrel re-export. Direct provider/media-query imports
  remain used and intact. Shared maintenance labels replace duplicated active dictionaries.
- Existing tests use Vitest plus Playwright; adding a third framework is unnecessary.

## Verification evidence

Verified in ticket #97's checkout on 2026-11-06, Node 22.22.3, Bun 1.3.12 and
Supabase CLI 2.75.0. CI pins Node 22/Bun 1.3.9/CLI 2.75.0; frozen install was also
verified with Bun 1.3.9. These are current-checkout results, independent of prior tickets.

| Command                                       | Result                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`               | Pass, including CI-pinned Bun 1.3.9                                             |
| `bun fmt:check`, `bun lint`, `bun type-check` | Pass                                                                            |
| `bun run test`                                | 226 tests / 43 files pass                                                       |
| `bun run test:data-api`                       | 22 tests / 6 files pass; real migration replay and two ordinary accounts        |
| `bun run test:e2e`                            | 46 / 46 pass, retries disabled                                                  |
| `bun run test:data-browser`                   | 1 / 1 pass; 1007 records / 41 pages, totals, CRUD and cascade                   |
| `bun run test:schema`                         | Replayed 001–009 matches checked-in generated public types                      |
| `bun run build:local`                         | Pass, including TypeScript and static generation; synthetic local configuration |

The real-browser journey uses the visible home link and asserts its destination; its
record/count/cost assertions and timeouts remain unchanged. An initial full-document
navigation exceeded the dashboard readiness assertion; the unchanged diagnostic trace
run passed, so no application defect was established. Controlled journeys retain reload
coverage. No force clicks, weakened data assertions or automatic test retries were added.

Local raw logs use `/tmp/keepel97-*.log`; those ephemeral files are not required to
reproduce CI. The disposable stack remains local; no hosted migration was performed.

## Retained limits

- History pages are live, not an immutable cross-tab snapshot. This tab's confirmed mutations
  reset its pages; other-tab data writes require refresh. Deep OR cursors filter preceding index
  rows; measured plans and timing limits are documented in the pagination contract.
- A failed refresh retains context where valid; confirmed mutation followed by read failure
  marks affected history/totals unavailable rather than presenting known-stale totals as current.
- Cancelling transport does not cancel SQL; unknown writes require immutable operation lookup
  or explicit same-identity replay. Mounted-owner/session recovery boundaries remain documented
  in [data-owner.md](data-owner.md) and [maintenance-batch.md](maintenance-batch.md).
- Workflow enforcement is checked in; marking its status required is a GitHub branch-protection
  setting owned by the maintainer. This ticket does not change remote repository settings.
