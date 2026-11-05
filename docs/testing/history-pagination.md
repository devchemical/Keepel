# Complete history and independent totals

DataContext owns the interactive projection, selected vehicle history, cursor stack, mutations,
and invalidation. Screens select a vehicle and request next/previous pages through that owner;
they do not create a query client, cache, or competing snapshot. Server route authentication is
unchanged. Vehicle identity and odometer remain derived from the current owned vehicle.

## Read contract

- `maintenanceHistoryQuery` selects explicit record fields and scopes by account and optional
  vehicle. Order is `service_date DESC, id DESC`. Cursor predicates include both date and ID:
  date less than the cursor, or equal date and smaller ID. A tied date cannot skip the remaining IDs.
- History displays 25 records, reading 26 to detect a next page. Previous navigation reuses the
  last successful cursor stack; a failed request never moves the displayed page. Retry repeats
  the requested destination. No history record collection is loaded into the dashboard snapshot.
- The dashboard recent list reads only five records. It never supplies a count or cost total.
- `maintenance_totals(p_vehicle_id uuid DEFAULT NULL)` independently returns one row with
  `record_count` and `total_cost` over all records visible to `auth.uid()`. Optional vehicle scope
  narrows that account. Count includes null-cost records; sum treats null as zero. An empty or
  inaccessible vehicle returns zero, without revealing another account. The function is stable,
  security invoker, has an empty search path, and grants execution only to authenticated callers.
  Separate account/vehicle statements avoid a generic optional-filter plan scanning the whole
  account for a vehicle. Data API response limits apply to the single returned aggregate row.
- Vehicle selectors/counts and the forecast selector need complete collections. Dedicated account
  scoped `id ASC` scans read chunks of 500 until an empty response, including when a response cap
  is smaller than a requested chunk. All fields are explicit. Vehicles retain their prior display
  order by creation time after collection. Forecasts join current vehicle data in the owner.

The owner publishes a successful shared snapshot and page together. Session identity, request
sequence, and mutation revision reject obsolete successful responses. Loading, failed loading,
confirmed empty, and stale valid data remain distinct, with explicit retry. Failed navigation or
refresh preserves the last valid page and totals. A confirmed mutation clears page/totals, resets
to the first cursor, and reloads through the same owner. If that reload fails, unavailable totals
and history are shown with recovery feedback; the previous pre-mutation page is not presented as
current. Mutation receipt confirmation remains independent of the following read's success.
Unknown writes do not alter history pages or aggregates optimistically.

Pagination is a live read, not a long-lived database snapshot. This tab's mutations reset paging;
changes in another tab require an explicit refresh. Page navigation currently refreshes the shared
projection too, favoring simple coherent ownership over a second independently invalidated cache.
Very large vehicle/forecast collections can exhaust the shared 15-second read budget; that produces
an explicit error retaining the previous valid projection, never a truncated success.

## Reproduction

The guarded harness replays canonical scripts 001–009. No hosted connection or service-role client
is used. Run these commands serially from the checkout owning the disposable stack:

```bash
bun run data-api:start
bun run test:data-api tests/data-api/history-pagination.test.ts
bun run test:data-browser
KEEPEL_DATA_API_TEST=1 bun tests/data-api/explain-history.ts
bun run test:e2e tests/e2e/history-pagination.spec.ts
```

`test:data-browser` holds the same checkout lock as API tests. It starts a separate Next development
server on port 3101 with local Supabase credentials captured in memory, and a controlled Redis
service on 54321. Auth, RLS, reads, mutations, receipts, and aggregates use the real disposable API.
Do not run it concurrently with API resets, normal E2E, another Next server in this checkout, or
plan rehearsals. Next development/build processes share `.next`; finish each browser run before
building or editing application source. The plan script must also run alone; synthetic rows are
rolled back. Existing synthetic Auth accounts may remain in the disposable database.

The API regression seeds 1,007 history records, proves the unpaginated API caps at 1,000, traverses
every ID in date/ID order once, checks account/vehicle totals and two-account isolation, then edits,
deletes and cascades. It also checks 1,003 vehicles and 1,003 pending forecasts are not truncated.
Controlled Playwright covers tied-date paging, repeated failed navigation, retained valid pages,
initial history error versus empty, and confirmed mutation invalidation followed by failed refresh
and retry. The real API Playwright journey traverses all 41 pages and verifies real UI mutations.

See the plan evidence below for indexes. Additional acceptance and CI matrix follow-up belongs to
issue #97; this ticket does not change analytics (ADR0002), authentication, or production schema.

## Measured index rationale (local PostgreSQL, 2026-11-05)

`tests/data-api/explain-history.ts` creates two ordinary synthetic accounts, 100,000 maintenance
records across 40 vehicles (50,000 records per account, 2,500 per vehicle, five tied calendar dates),
2,000 additional vehicles, and 10,000 pending forecasts. It runs `ANALYZE`, switches to
`authenticated` with a synthetic JWT subject, and uses `EXPLAIN (ANALYZE, BUFFERS)` under real RLS.
It then drops only the two new history indexes inside the transaction for a baseline comparison.
The final rollback restores both the indexes and the pre-rehearsal data. No planner forcing is used.

Actual final run: `/tmp/keepel96-explain-final.log` (full plans). Representative execution times:

| Query                                        | Actual plan                                                                 | Execution |
| -------------------------------------------- | --------------------------------------------------------------------------- | --------- |
| Account first 26                             | `Index Scan idx_maintenance_account_history`                                | 0.076 ms  |
| Vehicle first 26                             | `Index Scan idx_maintenance_vehicle_history`                                | 0.066 ms  |
| Account deep cursor, 26                      | Same account index; 7,491 preceding rows filtered                           | 3.041 ms  |
| Vehicle deep cursor, 26                      | Same vehicle index; 372 preceding rows filtered                             | 0.221 ms  |
| Account full aggregate, 50,000 matches       | Sequential scan + aggregate                                                 | 18.030 ms |
| Vehicle full aggregate, 2,500 matches        | Existing `maintenance_vehicle_owner_idx`, bitmap heap scan + aggregate      | 2.154 ms  |
| Actual vehicle aggregate RPC                 | Function scan (one aggregate row)                                           | 1.950 ms  |
| Vehicle selector first 500                   | `Index Scan idx_vehicles_account_id`                                        | 0.355 ms  |
| Pending forecast first 500                   | `Index Scan idx_scheduled_pending_account_id`                               | 0.374 ms  |
| Account first 26 without new history indexes | Sequential scan, top-N heapsort of 50,000 matches                           | 24.828 ms |
| Vehicle first 26 without new history indexes | Existing ownership index, bitmap heap scan, top-N heapsort of 2,500 matches | 3.846 ms  |

The account and vehicle equality prefixes need separate indexes because vehicle-scoped ordering
cannot satisfy account-wide date order. Date and ID preserve the requested order without a sort.
The vehicle/account ID index supports complete selector scans; the partial pending/account ID
index supports complete forecast scans without indexing resolved forecasts for that read path.
The existing ownership index already supports vehicle aggregates. Account totals intentionally
scan all account records; adding a cost-covering index solely for a half-table aggregate was not
justified by this rehearsal.

These are warm local synthetic measurements, not production latency claims or test thresholds.
The PostgREST OR predicate is a correct keyset but PostgreSQL applies its cursor as a filter after
the equality index condition in these plans. Deep pages can therefore read preceding rows,
especially with many ties; they are not claimed to be constant-time tuple seeks. At this measured
size they retain the stable index order and avoid the baseline sorts. A future measured need can
justify a tuple-comparison page RPC without changing the owner or navigation contract.
