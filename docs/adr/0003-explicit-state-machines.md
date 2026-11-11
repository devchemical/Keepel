# Model state machines as hand-written pure transition modules

Keepel makes its implicit state machines explicit as plain TypeScript modules, without a state-machine library. Each module exports a discriminated-union state with a `status` discriminant, a discriminated-union event, and a total, pure `transition(state, event)` function. React binds to a module with `useReducer` or through the provider that already owns the state; effects stay in that provider or hook. The inventory, target machines and rollout live in `docs/specs/explicit-state-machines.md`, and `docs/state-machines.md` indexes every module.

This extends the pattern already used at the authentication boundary (a pure factory plus a thin adapter and typed contracts in `lib/auth/`) instead of adding a second mental model. The largest machine has five states, so a library would add a dependency and client bundle weight for no expressive gain, while pure functions remain importable from Server Components, Vitest and Playwright helpers alike.

## Consequences

- The header comment of each machine module is its transition table and its only documentation. States are never encoded as parallel booleans; data that exists in one state lives on that variant.
- `transition` never throws and never performs effects (RPC, storage, navigation, toasts). An event that does not apply returns the same state, exhaustiveness is checked with `satisfies never`, and guards receive outside facts already computed on the event.
- Every machine has one table-driven unit test that enumerates each state × event pair, including ignored events.
- The DOM root that owns a machine exposes its state as a `data-*` attribute so tests and agents assert state instead of Spanish copy. State and event names are English identifiers; Spanish copy lives only in message maps.
- `contexts/DataContext.tsx` remains the single data owner and the only place that performs data effects. Persisted lifecycles enforced in SQL are mirrored in TypeScript and checked against the database; SQL is never changed to fit the TypeScript table.
- Refactoring phases preserve behavior and must pass the existing suites unmodified. Any user-visible change is a separately approved delta.
- Adopting a state-machine library, or a second client data cache, requires reopening this decision.
- This decision does not alter ADR 0001 or ADR 0002; in particular, fail-closed authentication invalidation is unchanged.
