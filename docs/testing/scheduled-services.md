# Scheduled service reminders

`lib/data/scheduled-services.ts` owns the reminder rule. Dashboard computes one selection and
passes its length to the counter and its classified rows to the list. The caller supplies the
browser's local calendar day; scheduled dates are never interpreted as instants.

- Pending forecasts are overdue when their date is before today OR current vehicle mileage
  reaches their threshold. Zero is a real threshold; unknown mileage cannot reach it.
- Today is pending today unless mileage already makes it overdue.
- Future dates through day 30 are included. Later dates and unreached mileage-only criteria
  have no estimated due day and stay outside this reminder window.
- Completed and cancelled forecasts never enter the selection. The batch dialog's forecast
  picker still offers all pending forecasts for its vehicle, including those outside the window.

`lib/data/scheduled-command.ts` exports `scheduledServiceSchema`, `ScheduledServiceValues`,
`createScheduledService`, `updateScheduledService`, and `cancelScheduledService`. Create/edit
accept complete editor values, normalize blank optional fields to actual NULL, preserve zero,
and require a known type plus date or mileage. These are not sparse PATCH contracts.
Update/cancel target the authenticated owner's pending row and require exactly one returned row.
DataContext owns their invocation and updates its projection from confirmed persisted rows.
The existing add/update context method names are retained; they now publish confirmed writes.
The unused direct scheduled completion/deletion methods were removed after checking consumers.

Completing a reminder opens the existing add-maintenance dialog with an explicit forecast ID.
The user chooses the performed service row; the existing command maps its original UI row to
its normalized batch index. Only `create_maintenance_batch` commits completion, history, mileage,
and receipt together. Service type never implies a link. Uncertain batch outcomes retain the
existing lookup/replay behavior; see [maintenance-batch.md](maintenance-batch.md).
The receipt's vehicle identity is included in immediate history projections so dashboard Recent
Activity can render safely before the joined refresh finishes.

Canonical script010 adds `scheduled_services_requires_criterion` at the exposed table boundary:
`scheduled_date IS NOT NULL OR scheduled_mileage IS NOT NULL`. It is transactional and replayable,
locks the table while checking existing rows, and fails explicitly if legacy rows lack both criteria.
Before applying, inspect `SELECT id FROM public.scheduled_services WHERE scheduled_date IS NULL AND scheduled_mileage IS NULL`.
Repair those rows only from verified user intent, then rerun; no row is silently changed/deleted.
Ordinary authenticated inserts and updates are constrained too; zero mileage and a date alone remain valid.
The actual generated public types are checked after canonical001–010; CHECK adds no TypeScript shape change.
Auth and analytics boundaries are unchanged. Broader loading/error convergence and unknown-outcome
handling for ordinary CRUD remain #95; schedule commands never claim success without affected-row
confirmation and never automatically retry.

## Verification

Run the disposable Data API suite serially, only from its owning checkout:

```bash
bun run test -- tests/unit/data/scheduled-services.test.ts
bun run test:data-api tests/data-api/scheduled-services.test.ts
bun run test:e2e tests/e2e/scheduled-services.spec.ts tests/e2e/maintenance-batch.spec.ts
```

Real API coverage checks zero/NULL, criteria validation, pending-row ownership/affected counts,
current joined mileage, explicit batch linkage and resolved forecast removal. Controlled browser
journeys cover create/edit/cancel, retained invalid input, matching counter/list, inclusive date
horizon, reached mileage, completion without type inference, no stale reminders after reload,
and entered history days in America/Los_Angeles and Pacific/Kiritimati.
