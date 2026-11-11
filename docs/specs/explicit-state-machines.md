# Spec: Explicit state machines

Status: draft for review. No code has been changed. Line references are to `main` at `fe73e27`.

## Objective

Keepel already behaves like a set of state machines, but most of them exist only as combinations of
booleans, refs, nullable values, thrown `Error` messages and SQL `WHERE` clauses. This spec inventories
every one of them, decides which deserve to become explicit, and defines the target shape.

The work must raise three things together and regress none:

- **UX** — every state a person can be in has one defined presentation and at least one exit.
- **DX** — a transition is one pure function with a unit test, not an e2e-only behavior spread over
  several callbacks.
- **AX** — an agent can find a machine by name, read its full transition table in one file, and assert
  its state in a browser without matching Spanish copy.

"Without breaking anything" is enforced structurally: refactor phases are behavior-preserving and must
pass the existing suites unmodified. Every user-visible change is isolated as a numbered **delta**
(D1–D6) that can be approved or dropped independently.

## Decision

**Hand-written pure transition modules. No state-machine library.**

Each machine is a TypeScript module exporting a discriminated-union `State`, a discriminated-union
`Event`, and a total `transition(state, event)` function. React binds to it with `useReducer` (or the
existing provider); effects stay in the provider/hook that already owns them.

Why this and not XState or similar:

- The repo already uses exactly this pattern at its best-tested boundary: pure factory plus thin
  adapter (`lib/auth/password-login.ts`, `components/auth/*-form-action.ts`, typed contracts in
  `lib/auth/contracts.ts`). The machines extend an existing convention instead of adding a second one.
- The largest machine has five states. A library would add a dependency (an "ask first" change), a
  second mental model, and client bundle weight for no expressive gain.
- Pure functions are importable from Server Components, Vitest and Playwright helpers alike.
- An agent reads one plain file; there is no runtime, DSL or visualizer to learn.

This should be recorded as `docs/adr/0003-explicit-state-machines.md` when the spec is accepted. It
does not contradict ADR 0001 or 0002.

### Module contract

```ts
// lib/data/operation-machine.ts
//
// | from     | event        | to        | guard / note                         |
// | -------- | ------------ | --------- | ------------------------------------ |
// | sending  | RECEIPT      | confirmed | receipt matches op, action, id, user |
// | sending  | REJECTED     | rejected  | native database error only           |
// | sending  | NO_PROOF     | unknown   | timeout, transport, malformed        |
// | unknown  | CHECK        | checking  |                                      |
// | ...

export const OPERATION_STATUS = ["sending", "unknown", "checking", "confirmed", "rejected"] as const
export type OperationStatus = (typeof OPERATION_STATUS)[number]

export type OperationEvent =
  | { type: "RECEIPT" }
  | { type: "REJECTED" }
  | { type: "NO_PROOF" }
  | { type: "CHECK" }
  | { type: "REPLAY" }

export function transitionOperation(status: OperationStatus, event: OperationEvent): OperationStatus {
  switch (status) {
    case "sending":
      if (event.type === "RECEIPT") return "confirmed"
      if (event.type === "REJECTED") return "rejected"
      if (event.type === "NO_PROOF") return "unknown"
      return status
    // ...
    default:
      return status satisfies never
  }
}
```

Rules for every machine module:

1. The header comment is the transition table. It is the documentation; there is no second copy.
2. States are a `status` discriminant, never parallel booleans. Data that only exists in one state
   lives on that variant.
3. `transition` is total and pure. An event that does not apply returns the same state; it never
   throws. Exhaustiveness is checked with `satisfies never`.
4. Guards that need outside facts receive them on the event, already computed.
5. Effects (RPC, storage, navigation, toast) are not performed inside `transition`.
6. One unit test per machine enumerates every state × event pair against the table.
7. The owning DOM root exposes the state as a `data-*` attribute (see "Agent experience").

## Inventory

Twenty machines were found. Verdicts: **Extract** (implicit and costly), **Unify** (explicit in pieces
that disagree), **Document** (already explicit enough; write the table down), **Leave**.

| #   | Machine                                                 | Where it lives today                                                                        | Implicit as                                                        | Verdict                |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| 1   | Data operation lifecycle                                | `contexts/DataContext.tsx:303-526`                                                          | 3-value status, removal-as-terminal, thrown errors, two code paths | Extract                |
| 2   | Operation journal health                                | `DataContext.tsx:139-141,247-262,559-572`                                                   | `journalUnreadable` ref + `operationStorageError` boolean          | Extract (with 1)       |
| 3   | Data snapshot load                                      | `DataContext.tsx:132-134,143-208`                                                           | `hasLoaded`, `loadError`, three identical loading booleans         | Extract                |
| 4   | Request scope guard                                     | `DataContext.tsx:145-148,179,197`                                                           | `{userId, generation, revision, request}` ref, `dataOwner` state   | Extract (with 3)       |
| 5   | History pagination                                      | `DataContext.tsx:124-126,212-242`                                                           | `history` state + requested and committed cursor refs              | Extract (with 3)       |
| 6   | Editor dialog                                           | 8 dialogs in `components/vehicles`, `components/maintenance`                                | `open`, `isLoading`, `error`, global `pending`, one ref            | Extract                |
| 7   | Unresolved-editor latch                                 | `components/data/operation-recovery.tsx:104-115`                                            | `unresolved` ref over the global pending list                      | Extract (with 6)       |
| 8   | Row action selection                                    | `vehicles-list.tsx:23-24`, `maintenance-list.tsx:35-36`, `upcoming-maintenance.tsx:29-32`   | 2–3 nullable entities that should be mutually exclusive            | Unify                  |
| 9   | Scheduled service lifecycle                             | `scripts/004`, `007`, `008`; `status === "pending"` in 3 TS files                           | SQL `WHERE status='pending'`, a trigger, a CHECK                   | Unify                  |
| 10  | Schedule urgency                                        | `lib/data/scheduled-services.ts:17-29`                                                      | Fourth class is `null`                                             | Unify                  |
| 11  | Auth projection                                         | `contexts/AuthProjectionContext.tsx`, `lib/auth/auth-invalidation.ts`                       | "anonymous" doubles as "revalidating"; two refs                    | Document               |
| 12  | Data ↔ auth transition                                  | `contexts/data-auth-transition.ts`                                                          | Explicit but **dead**: imported only by its test                   | Remove (superseded, 3) |
| 13  | Optimistic list                                         | `lib/data/optimistic-list.ts`                                                               | Explicit but **dead**: imported only by its test                   | Remove (superseded, 1) |
| 14  | Password login / signup / logout                        | `lib/auth/password-login.ts`, `signup.ts`, `logout.ts`, form-action runners                 | Already typed pipelines with discriminated results                 | Document               |
| 15  | Google OAuth round trip                                 | `app/auth/google/route.ts`, `app/auth/callback/route.ts`, `AuthProjectionContext.tsx:82-94` | Query params between hops; one-shot `handledAuthRedirectRef`       | Document               |
| 16  | Route access                                            | `lib/supabase/proxy.ts:42-82`                                                               | Small `if` chain over route class × authenticated                  | Document               |
| 17  | Privacy consent (server)                                | `lib/privacy/consent.ts`                                                                    | Already explicit: `unknown`, `accepted`, `rejected`, with expiry   | Document               |
| 18  | Privacy consent (client UI)                             | `components/privacy/consent-provider.tsx:22-25`                                             | `isPending`, `error`, `isPreferencesOpen`                          | Unify (low)            |
| 19  | Idempotent receipt (database)                           | `keepel_private.mutate_data`, `create_maintenance_batch`                                    | Explicit in SQL: absent, recorded, replay-same, replay-different   | Document               |
| 20  | Navigation menus, error boundary, Google button spinner | `Header.tsx:28-30`, `context-error-boundary.tsx`, `google-signin-button.tsx`                | Independent booleans                                               | Leave (see D6)         |

The rest of this spec defines the machines marked Extract or Unify.

## Machine 1 — Data operation lifecycle

The most important machine in the app, and the least visible. `PendingDataOperation.status` has three
values (`DataContext.tsx:62`); the two terminal outcomes are encoded as "removed from the array", and
for CRUD commands the outcome reaches the dialog as a thrown `Error` whose Spanish message is the state.

### States and transitions (current behavior)

| From       | Event                                  | To                                 | Today's implementation                                |
| ---------- | -------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| —          | `SUBMIT` (no conflict)                 | `sending`                          | `mutate` :349, `createMaintenanceBatch` :484          |
| `sending`  | `RECEIPT` (validated, matching)        | `confirmed`                        | removed from list; receipt merged; refresh            |
| `sending`  | `REJECTED` (native database error)     | `rejected`                         | removed from list; CRUD throws, batch returns         |
| `sending`  | `NO_PROOF` (timeout, transport, shape) | `unknown`                          | CRUD throws; batch chains straight into `CHECK`       |
| `unknown`  | `CHECK`                                | `checking`                         | `reconcileDataOperation`, `reconcileMaintenanceBatch` |
| `checking` | `RECEIPT`                              | `confirmed`                        |                                                       |
| `checking` | `NO_PROOF`                             | `unknown`                          | a missing receipt never proves rollback               |
| `unknown`  | `REPLAY` (same frozen command)         | `sending`                          | **batch only** (:476-481)                             |
| any        | `RESTORED` (reload, same account)      | `unknown`                          | mount effect :564-566                                 |
| any        | `SCOPE_CHANGED` (other session)        | dropped in memory, kept in journal | :351, :447, :506                                      |

### What is wrong with it being implicit

Four behaviors differ between the CRUD path and the batch path, and nothing in the types says so:

| Policy                                 | CRUD (`mutate`)                                | Batch (`createMaintenanceBatch`) |
| -------------------------------------- | ---------------------------------------------- | -------------------------------- |
| Refuse to send if journal write failed | No — result of `publishPending` ignored (:349) | Yes (:488-499)                   |
| Auto-check once after `NO_PROOF`       | No                                             | Yes (:523)                       |
| User can replay the same operation     | No                                             | Yes                              |
| Outcome delivered as                   | thrown `Error` with copy                       | `{ status }` value               |

The first three are documented choices (`docs/testing/data-owner.md`). They should become one visible
`OPERATION_POLICY` record keyed by command kind, so the next reader sees a decision, not an accident.

The fourth is plain debt: nine `throw new Error("…")` sites in `DataContext.tsx` are control flow, and
dialogs render `error.message` verbatim. Copy and state are fused.

### Target

- `lib/data/operation-machine.ts` — statuses, events, `transitionOperation`, `OPERATION_POLICY`,
  `conflictsWith(pending, candidate)` (today inline at :335-341 and :473-477).
- One outcome type for every mutation: `OperationOutcome = { status: "confirmed" } | { status:
"rejected" } | { status: "unknown"; operationId } | { status: "blocked"; reason }` where `reason` is
  `"conflict" | "journal-unreadable" | "journal-unwritable" | "no-session" | "session-changed"`.
- `lib/data/operation-messages.ts` — the only place that maps outcome and reason to Spanish copy.
  Strings move verbatim so existing e2e assertions keep passing.
- Context methods lose the misleading `Optimistic` suffix (`addVehicleOptimistic` → `createVehicle`,
  and so on). They are pessimistic writes with a render-time overlay (:590-610), not optimistic updates.
- Journal health (machine 2) becomes `journal: "healthy" | "unwritable" | "unreadable"` on the same
  owner, replacing the ref/boolean pair. `unreadable` blocks every submit; `unwritable` blocks only
  kinds whose policy requires a durable journal.

### Delta D2 — an exit from `unknown` for CRUD commands (needs approval)

Today a CRUD command whose request never reached the database can never leave `unknown`: checking
finds no receipt forever, and there is no replay. Because every editor freezes while any operation is
pending (machine 7), that tab can no longer write anything until it is closed. The state has no exit.

Proposal: allow the same explicit, user-initiated "Reintentar misma operación" that batches have.
`mutate_data` is already idempotent per `operation_id` and rejects a changed payload, so a replay
either returns the original receipt or performs the write exactly once. Nothing is resent automatically.

This changes a contract accepted in #95 and the e2e test "an unresolved create retains its immutable
operation across reload and can only query its status" (`tests/e2e/data-recovery.spec.ts:259`). It
must be decided by the maintainer, not assumed.

## Machine 3 — Data snapshot load (with 4 and 5)

### Current encoding

`hasLoaded`, `loadError`, and three loading booleans that are always set together (:155-157, :201-203,
:584-586; no consumer reads the individual ones). Screens rebuild the state from these flags, each
differently: `app/page.tsx:19,24`, `vehicles-screen.tsx:23-28`, `vehicle-history-screen.tsx:26-37`.

### Target states

Status and fetch activity are separate axes, as in the well-known query-cache model:

| `status`    | Meaning                             | Legacy flags                         |
| ----------- | ----------------------------------- | ------------------------------------ |
| `signedOut` | no account; nothing to load         | `hasLoaded=false`, `loadError=null`  |
| `pending`   | no valid snapshot yet, no failure   | `hasLoaded=false`, `loadError=null`  |
| `error`     | no valid snapshot; last load failed | `hasLoaded=false`, `loadError` set   |
| `ready`     | valid snapshot; `refreshError` flag | `hasLoaded=true`, `loadError` if set |

plus `isFetching: boolean` on every signed-in state.

| From               | Event                   | To                                       |
| ------------------ | ----------------------- | ---------------------------------------- |
| any                | `ACCOUNT_CHANGED`       | `pending` + fetching, or `signedOut`     |
| `pending`, `error` | `LOAD_STARTED`          | same status, `isFetching=true`           |
| `pending`, `error` | `LOAD_SUCCEEDED`        | `ready`                                  |
| `pending`, `error` | `LOAD_FAILED`           | `error`                                  |
| `ready`            | `LOAD_STARTED`          | `ready`, `isFetching=true`               |
| `ready`            | `LOAD_SUCCEEDED`        | `ready`, `refreshError=false`            |
| `ready`            | `LOAD_FAILED`           | `ready`, `refreshError=true` (data kept) |
| any                | result with stale token | unchanged                                |

- `lib/data/snapshot-machine.ts` holds the reducer and one selector,
  `snapshotView(state): "signedOut" | "skeleton" | "blockingError" | "content"`, used by all three
  screens. The legacy flags stay on the context as derived values until every consumer has moved.
- **Scope guard (4)** becomes a named value: `RequestToken = { generation, request, revision }` with
  `isCurrent(scope, token)`. Today the same comparison is written three ways (:179, :197, :200).
- **History (5)** becomes `history: { status: "none" } | { status: "loading"; vehicleId; cursors } |
{ status: "ready"; vehicleId; page; hasNext; records; totals; cursors }`, replacing `history` state
  plus `historyRequest` and `committedHistoryRequest`. Atomic publish with the snapshot is preserved.
- `contexts/data-auth-transition.ts` (12) is deleted; its three cases are rows of the table above and
  its test is replaced by the reducer's.

No behavior delta. The initial values, the kept-on-failure rule and the copy are unchanged.

## Machine 6 — Editor dialog (with 7 and 8)

Eight dialogs each re-implement the same machine by hand, and they have drifted:

| Behavior                             | Add maintenance      | The other seven                               |
| ------------------------------------ | -------------------- | --------------------------------------------- |
| Close while submitting               | blocked (`:198-200`) | allowed via Escape, overlay or ✕              |
| Double-submit guard                  | `submitting` ref     | disabled button only                          |
| Frozen while an operation is pending | only its own batch   | **any** operation anywhere in the app         |
| Success feedback                     | none                 | none, except edit-schedule and cancel (toast) |
| Error feedback                       | inline               | inline; edit-schedule also toasts             |

### Target

`hooks/use-editor.ts` over `lib/ui/editor-machine.ts`:

| From                    | Event                            | To                                        |
| ----------------------- | -------------------------------- | ----------------------------------------- |
| `closed`                | `OPEN`                           | `editing`                                 |
| `editing`               | `SUBMIT` (invalid)               | `editing` with `error`                    |
| `editing`               | `SUBMIT` (valid)                 | `submitting`                              |
| `submitting`            | `OUTCOME confirmed`              | `closed` (draft reset for create editors) |
| `submitting`            | `OUTCOME rejected, blocked`      | `editing` with `error`                    |
| `submitting`            | `OUTCOME unknown`                | `unresolved` with `operationId`           |
| `unresolved`            | `OPERATION_SETTLED` (its own id) | `closed`                                  |
| `editing`, `unresolved` | `CLOSE`                          | `closed` (draft and operation retained)   |
| `submitting`            | `CLOSE`                          | `submitting` (ignored)                    |

Row-level selection (8) becomes one value per list, `RowAction<T> = { type: "none" } | { type:
"editing"; row: T } | { type: "deleting"; row: T }` (plus `"completing"` on the dashboard), replacing
pairs of nullable entities that can both be set.

### Delta D1 — scope the freeze to the editor's own operation (bug fix)

`usePendingDataOperation` (`operation-recovery.tsx:104-115`) watches the global pending list. Two
consequences:

1. When any `unknown` operation is finally confirmed, the callback fires in **every mounted editor**.
   `AddVehicleDialog` (mounted twice on the vehicles screen) and `ScheduleServiceDialog` (always
   mounted inside the actions dropdown) then run `resetConfirmedForm`, discarding a draft that had
   nothing to do with the confirmed operation.
2. One unresolved operation disables every other editor's fields and submit button, although the data
   owner already rejects genuinely conflicting commands (`DataContext.tsx:335-342`).

Target: an editor is `unresolved` only for the `operationId` it submitted, and is blocked from
submitting only when `conflictsWith` says so. After a reload the editor association is gone, as today;
recovery continues through the `OperationRecovery` panel.

### Delta D3 — one editor behavior

All editors block close while `submitting`, use the same single-flight guard, and report confirmed
writes with one `sonner` toast. Inline `role="alert"` remains the error channel; the duplicate error
toast in edit-schedule is removed.

## Machine 9 — Scheduled service lifecycle (with 10)

A persisted domain machine enforced correctly in SQL but named nowhere:

| From        | Event                                      | To          | Enforced by                                      |
| ----------- | ------------------------------------------ | ----------- | ------------------------------------------------ |
| —           | `schedule.create`                          | `pending`   | `mutate_data` (`scripts/008:97-102`)             |
| `pending`   | `schedule.update`                          | `pending`   | `AND status='pending'` (`008:106`)               |
| `pending`   | batch with completion, service day ≤ today | `completed` | `create_maintenance_batch` (`007:128-153`)       |
| `pending`   | `schedule.cancel`                          | `cancelled` | `AND status='pending'` (`008:111`)               |
| `completed` | linked maintenance record deleted          | `pending`   | trigger `clear_deleted_completion` (`007:49-59`) |
| `cancelled` | —                                          | terminal    | no statement matches                             |

Invariant: `status = 'completed'` ⇔ `completed_record_id IS NOT NULL` (CHECK, `007:26`).

Target, with **no SQL change**:

- `lib/data/scheduled-service-lifecycle.ts` exports `SCHEDULED_SERVICE_STATUS`, the table above as a
  typed constant, and `canTransition(from, event)`. `ScheduledServiceStatus` moves here from
  `DataContext.tsx:49`; the zod enum in `maintenance-command.ts:67` and the three `status === "pending"`
  filters import it.
- A data-API test walks every row of the table, and every missing row, against the real functions, so
  the TypeScript table cannot drift from SQL silently.
- Urgency (10) gains its fourth name. `classifyScheduledService` returns `null` for a pending service
  outside the 30-day horizon or with an unreached mileage; that class becomes `"later"`, and
  `selectScheduledServices` keeps filtering it out so the dashboard is unchanged.
- `CONTEXT.md` gains the terms **Previsión** (with its three states) and **Urgencia**.

### Delta D4 — make `later` and the `completed → pending` return visible (optional feature)

Two states exist that a person cannot see:

- A forecast more than 30 days ahead, or by unreached mileage only, appears nowhere except the
  "Resolver una previsión" selector. It cannot be edited or cancelled until it enters the horizon.
- Deleting a maintenance record that completed a forecast silently returns that forecast to pending.

Both are product decisions and out of scope unless requested.

## Smaller items

- **Consent UI (18)** — `{ sheet: "open" | "closed"; save: "idle" | "saving" | "failed" }` in a
  reducer inside `consent-provider.tsx`. No behavior change. Low priority.
- **Delta D5** — `/auth/error` prints the raw query value (`Código de error: oauth_cancelled`). Parse
  it against `OAUTH_ERROR_CODE` and show a message per code; unknown values get the generic message.
- **Delta D6** — `GoogleSignInButton` sets `isLoading` and never clears it, so returning with the back
  button shows a permanent spinner. Reset on `pageshow`.

## Agent experience

- **Index** — `docs/state-machines.md`: one row per machine with its module path, owner and test file.
  A link from the repository map in `AGENTS.md` (ask first; one line).
- **Observable state** — each owner renders its state as a data attribute, so tests and browser agents
  assert state instead of copy: `data-snapshot-status` on the screen root, `data-operation-status` and
  `data-operation-id` on each recovery card, `data-editor-state` on each dialog form.
- **Vocabulary** — state and event names are English identifiers; Spanish appears only in the message
  maps. `CONTEXT.md` records the domain terms.

## Project structure

```
lib/data/operation-machine.ts            machines 1, 2
lib/data/operation-messages.ts           outcome → copy
lib/data/snapshot-machine.ts             machines 3, 4, 5
lib/data/scheduled-service-lifecycle.ts  machines 9, 10
lib/ui/editor-machine.ts                 machines 6, 7, 8
hooks/use-editor.ts                      React binding for editors
tests/unit/data/*-machine.test.ts        table-driven transition tests
tests/unit/ui/editor-machine.test.ts
docs/state-machines.md                   index
docs/adr/0003-explicit-state-machines.md
```

`contexts/DataContext.tsx` remains the single data owner and the only place that performs effects.

## Rollout

Each phase is one pull request. Phases 1–4 are refactors: the existing unit, integration, e2e and
data-API suites must pass **without edits**, apart from deleting the two dead-module tests.

| Phase | Content                                                                                    | Deltas         |
| ----- | ------------------------------------------------------------------------------------------ | -------------- |
| 0     | ADR 0003, index doc, `CONTEXT.md` terms                                                    | —              |
| 1     | `scheduled-service-lifecycle.ts`, `"later"`, data-API table test                           | —              |
| 2     | `snapshot-machine.ts`; context derives legacy flags; screens use `snapshotView`; delete 12 | —              |
| 3     | `operation-machine.ts`, outcome type, message map, rename methods; delete 13               | —              |
| 4     | `editor-machine.ts`, `use-editor`, `RowAction`; migrate the eight dialogs one per commit   | —              |
| 5     | Approved deltas, one pull request each                                                     | D1, D3, D5, D6 |
| 6     | Decisions that change an accepted contract or add a feature                                | D2, D4         |

Order matters: phase 4 depends on the outcome type from phase 3, and D1 depends on phase 4.

## Testing strategy

- **Unit (Vitest)** — one table-driven test per machine covering every state × event pair, including
  events that must be ignored. This is new coverage: `DataContext.tsx` has no unit tests today.
- **Characterization first** — in phases 2–4 the tests are written against current behavior before
  the code moves, including the CRUD/batch policy differences.
- **Data API** — the lifecycle table test in phase 1.
- **E2E (Playwright)** — unchanged in phases 1–4. Each delta adds or changes exactly the tests that
  describe it; D1 adds "confirming an unrelated operation keeps another editor's draft".
- Handoff checks for every phase: `bun fmt:check`, `bun lint`, `bun type-check`, `bun run test`,
  `bun run build`, and `bun run test:e2e` from phase 2 onward.

## Boundaries

- **Always** — keep `DataContext` the single owner; keep transitions pure; move copy verbatim; keep
  the journal format `keepel-pending-data-v1` readable.
- **Ask first** — any delta; editing `AGENTS.md`; renaming exported context methods if anything outside
  this repo consumes them; touching `scripts/`.
- **Never** — add a state library or a second data cache; resend a write automatically; weaken the
  fail-closed auth invalidation of ADR 0001; change SQL to fit the TypeScript table.

## Success criteria

- Every machine marked Extract or Unify has one module whose header table matches its unit test.
- `DataContext.tsx` contains no boolean load flags as state and no `throw` used to report an outcome.
- All eight dialogs use `use-editor`; none declares its own `isLoading`, `error` or pending latch.
- `"pending" | "completed" | "cancelled"` is declared once in TypeScript.
- `contexts/data-auth-transition.ts` and `lib/data/optimistic-list.ts` no longer exist.
- Phases 1–4 merge with zero edits to existing e2e and data-API specs.
- A browser test can assert snapshot, operation and editor state through `data-*` attributes alone.

## Decisions (2026-11-11)

Taken by the maintainer after phases 0–4 and D3, D5, D6 merged.

1. **D1 — accepted (option A).** An editor is frozen and reset only by the operation it submitted.
   Unrelated editors stay usable; the data owner's `conflictsWith` guard remains the only app-wide
   protection. Confirming one operation never resets another editor's draft.
2. **D2 — accepted.** An unresolved CRUD command offers the same explicit, user-initiated
   "Reintentar misma operación" as a batch, replaying the retained frozen command with the same
   `operation_id`. Never automatic. Supersedes the #95 "can only query its status" contract.
3. **D4 — accepted, minimal form.** The dashboard reminders card lists `later` forecasts in a
   collapsed "Más adelante" section with the same edit/cancel actions; the counter is unchanged.
   Deleting a maintenance record that completed a forecast warns, in the confirmation dialog, that
   the forecast will return to pending.

## Open questions

1. Should the auth projection gain an explicit `revalidating` state so a cross-tab invalidation for
   the same account does not blank and reload the data? It is a real UX cost today, but it touches
   ADR 0001's fail-closed rule, so it is deliberately left out of this spec.

## Not verified while writing

- No test suite was run; behavior claims come from reading the source.
- `components/layout/Header.tsx`, `components/home/LandingPage.tsx`, `scripts/009` and the skeleton
  components were only scanned for state, not read in full.
- The D1 draft-reset path was traced in code, not reproduced in a browser.
