# State machines

Index of Keepel's explicit state machines. Each module follows the contract in
[ADR 0003](adr/0003-explicit-state-machines.md): a `status` discriminated union, a discriminated-union
event, a total and pure `transition`, and a header comment that is the transition table. The full
inventory, verdicts and rollout are in [the explicit state machines spec](specs/explicit-state-machines.md).

Machine numbers match the spec inventory. **Planned** marks a module or test that does not exist yet;
update the row when its phase lands.

| #   | Machine                     | Module                                    | Owner                                              | Test                                                                                                        | Status  |
| --- | --------------------------- | ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Data operation lifecycle    | `lib/data/operation-machine.ts`           | `contexts/DataContext.tsx`                         | `tests/unit/data/operation-machine.test.ts`                                                                 | Planned |
| 2   | Operation journal health    | `lib/data/operation-machine.ts`           | `contexts/DataContext.tsx`                         | `tests/unit/data/operation-machine.test.ts`                                                                 | Planned |
| 3   | Data snapshot load          | `lib/data/snapshot-machine.ts`            | `contexts/DataContext.tsx`                         | `tests/unit/data/snapshot-machine.test.ts`                                                                  | Done    |
| 4   | Request scope guard         | `lib/data/snapshot-machine.ts`            | `contexts/DataContext.tsx`                         | `tests/unit/data/snapshot-machine.test.ts`                                                                  | Done    |
| 5   | History pagination          | `lib/data/snapshot-machine.ts`            | `contexts/DataContext.tsx`                         | `tests/unit/data/snapshot-machine.test.ts`                                                                  | Done    |
| 6   | Editor dialog               | `lib/ui/editor-machine.ts`                | `hooks/use-editor.ts`                              | `tests/unit/ui/editor-machine.test.ts`                                                                      | Planned |
| 7   | Unresolved-editor latch     | `lib/ui/editor-machine.ts`                | `hooks/use-editor.ts`                              | `tests/unit/ui/editor-machine.test.ts`                                                                      | Planned |
| 8   | Row action selection        | `lib/ui/editor-machine.ts`                | List components (vehicles, maintenance, dashboard) | `tests/unit/ui/editor-machine.test.ts`                                                                      | Planned |
| 9   | Scheduled service lifecycle | `lib/data/scheduled-service-lifecycle.ts` | SQL (`mutate_data`, `create_maintenance_batch`)    | `tests/unit/data/scheduled-service-lifecycle.test.ts`, `tests/data-api/scheduled-service-lifecycle.test.ts` | Planned |
| 10  | Schedule urgency            | `lib/data/scheduled-service-lifecycle.ts` | `lib/data/scheduled-services.ts`                   | `tests/unit/data/scheduled-service-lifecycle.test.ts`                                                       | Planned |
| 18  | Privacy consent (client UI) | `components/privacy/consent-provider.tsx` | `components/privacy/consent-provider.tsx`          | Planned                                                                                                     | Planned |

Machines marked Document or Leave in the spec (11, 14–17, 19, 20) are not listed here, and the dead
modules for machines 12 and 13 are removed by phases 2 and 3.
