// Machine 8 — Row action selection. Owners: the list components (vehicles, maintenance, dashboard).
// A list holds at most one row action; it decides which dialog is open and for which row.
//
// | from               | event                 | to                 |
// | ------------------ | --------------------- | ------------------ |
// | any                | SELECT action, row    | action, row        |
// | action             | CLEAR (same action)   | none               |
//
// Every other pair keeps its state: a dialog closing never clears another dialog's selection.
// Vehicle and maintenance lists select `editing` and `deleting`; the dashboard selects
// `completing` and `editing`.

export const ROW_ACTION_STATUS = ["none", "editing", "deleting", "completing"] as const
export type RowActionStatus = (typeof ROW_ACTION_STATUS)[number]
export type SelectedRowAction = Exclude<RowActionStatus, "none">

export type RowAction<T> =
  | { status: "none" }
  | { status: "editing"; row: T }
  | { status: "deleting"; row: T }
  | { status: "completing"; row: T }

export type RowActionEvent<T> =
  | { type: "SELECT"; action: SelectedRowAction; row: T }
  | { type: "CLEAR"; action: SelectedRowAction }

export const NO_ROW_ACTION = { status: "none" } as const

export function transitionRowAction<T>(state: RowAction<T>, event: RowActionEvent<T>): RowAction<T> {
  switch (event.type) {
    case "SELECT":
      return { status: event.action, row: event.row }
    case "CLEAR":
      return state.status === event.action ? NO_ROW_ACTION : state
    default:
      return event satisfies never
  }
}
