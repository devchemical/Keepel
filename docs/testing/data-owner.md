# Interactive data ownership (#95)

Spec: [#90](https://github.com/devchemical/Keepel/issues/90), implementation
[#95](https://github.com/devchemical/Keepel/issues/95). ADR0001/0002 remain authoritative.

## Read contract

DataContext supplies dashboard, vehicle list and vehicle history. Vehicle server pages authenticate
with the existing server client and pass only the route's vehicle ID. They do not query resource
snapshots or redirect on a failed resource query. History shows unavailable only after a successful
owned load cannot find the vehicle.

`readDataSnapshot` reads vehicles, history and pending schedules through the single browser client.
The owner publishes a complete successful snapshot; any failed constituent query preserves the last
valid data and exposes `loadError`. `hasLoaded` distinguishes initial loading/error from confirmed
empty data. Refresh loading does not replace valid content with skeletons. All three former refresh
entry points delegate to `refreshAll` so related projections refresh together. Retry is explicit.

Requests capture a session scope, query sequence and mutation revision. Old sessions, superseded
queries and reads begun before a newer mutation cannot publish. Auth changes hide the previous
account synchronously, then clear its data. Resource identity joins are derived from owned vehicles,
so identity edits immediately update all loaded representations. Vehicle deletes remove child history,
forecasts and their contribution to the loaded aggregates. No extra auth authority/client was added.

## Mutation contract

Every interactive dialog goes through DataContext. Maintenance creation/completion keeps #93's
`create_maintenance_batch` operation/receipt contract. Other operations use `mutate_data`, a finite
set of vehicle create/update/delete, maintenance update/delete, schedule create/update/cancel actions.
This is a narrow existing-client Data API RPC, not a new HTTP API or generic cache.

The owner validates complete editor values with shared strict schemas. Unknown identity fields and
sparse changes are rejected. Empty optional fields become NULL; zero is retained. Native SQL validates
field allowlists/types, calendar syntax and schedule criteria before writes, plus canonical constraints.
Script008 scopes every resource operation to `auth.uid()`, verifies affected rows and atomically saves
an immutable private receipt. Private definer functions follow script007's inaccessible receipt-table
pattern; public invoker wrappers grant only the narrow authenticated operations. Replaying an identical
operation returns its receipt; changing its payload fails. Vehicle deletion does not delete its receipt.
Actual public database types are generated from the disposable schema using the installed CLI.

A confirmed native database error is `rejected`. An aborted wait, transport error, malformed response,
or missing receipt is `unknown`. No write is automatically resent. CRUD stays unknown until the user
queries `get_data_operation`; an absent receipt does not establish rollback. Cancellation has exactly
this contract too. Only a validated matching operation/action/resource/account receipt establishes
success. Loading failure after a confirmed mutation never changes that mutation into a failed write.

Optimistic changes are overlays on the last snapshot, not saved copies of whole arrays. Rejecting
one operation removes only its overlay. Confirmed receipts merge by identity; request revisions stop
an older read from wiping a newer result. Batch odometers remain monotone; an old vehicle receipt
cannot replace a newer local timestamp. Confirmed vehicle deletions suppress late child receipts.
Cancellation stays visible until confirmation so its recovery action remains reachable.

Unresolved CRUD commands are copied/frozen and retained by the owner across modal close/navigation.
A versioned, account-scoped sessionStorage journal restores their identity and complete payload after
reload, with status unknown and only a status query. It never restores authentication or sends writes.
The journal is removed on confirmation/rejection or tab closure; it contains no credentials and sends
no telemetry. Other accounts do not see it. A storage failure keeps the in-memory command and displays
a request to keep the tab open. Private receipts remain queryable while that account exists. #93's
batch modal retains its original immutable operation, explicit read and user-requested idempotent replay.

## #96 seam and deliberate limits

`lib/data/queries.ts::maintenanceHistoryQuery` owns account/optional vehicle scope and stable ordering
by service_date DESC, id DESC. #96 should add cursor pages at this seam and separate database totals;
DataContext remains the interactive owner and exposes page/total load states. Every confirmed mutation
already converges through `refreshAll`; replace that invalidation with the relevant page/totals queries.

The current history snapshot still has the configured Data API response cap. Dashboard totals are
coherent for the loaded snapshot; this ticket does not claim complete-history totals beyond that cap.
Other tabs' resource changes require explicit refresh. A receipt absent after a transport failure stays
unknown; no generic operation cancellation or automatic resend pretends otherwise. Closing a tab while
unresolved loses its per-tab journal; retain the displayed operation reference for support. No hosted
schema, production data, CRUD analytics, auth architecture or visual design is changed.

## Verification seams

`tests/data-api/data-commands.test.ts` exercises actual local transactions, receipts, isolation, zero
rows, invalid input, response loss, maintenance edits/deletes and forecast restoration. Existing API
suites retain migration, ownership, batch, odometer, completion and cascade checks.

`tests/e2e/data-recovery.spec.ts` exercises initial/refresh failures and retry, vehicle identity,
cascade/totals, native rejection, lost responses, cancelled schedule writes, delayed create, session
transitions and reload recovery. The controlled services are only transport/UI evidence; real API tests
are the integrity evidence. Existing maintenance/schedule/auth/privacy suites remain in the full run.
