import { z } from "zod"
import { dataCommandSchema, type DataCommand } from "./data-command"
import { maintenanceCommandSchema, type MaintenanceCommand } from "./maintenance-command"

export type PendingCommand = DataCommand | (MaintenanceCommand & { action: "maintenance.batch" })
const batchCommandSchema = maintenanceCommandSchema.and(z.object({ action: z.literal("maintenance.batch") }))
const KEY_PREFIX = "keepel-pending-data-v1:"
const commandsSchema = z.array(z.union([dataCommandSchema, batchCommandSchema]))
/** A per-tab journal of unresolved commands, never a data cache or auth source. */
export function readPendingCommands(userId: string): PendingCommand[] {
  const value: unknown = JSON.parse(sessionStorage.getItem(KEY_PREFIX + userId) ?? "[]")
  return commandsSchema.parse(value).map(freezePendingCommand)
}

export function writePendingCommands(userId: string, commands: PendingCommand[]): boolean {
  try {
    if (commands.length) sessionStorage.setItem(KEY_PREFIX + userId, JSON.stringify(commands))
    else sessionStorage.removeItem(KEY_PREFIX + userId)
    return true
  } catch {
    return false
  }
}

/** Freeze the parsed copy, including every batch row and completion mapping. */
export function freezePendingCommand(command: PendingCommand): PendingCommand {
  if (command.action === "maintenance.batch") {
    for (const row of command.batch.services) Object.freeze(row)
    Object.freeze(command.batch.services)
    Object.freeze(command.batch)
    if (command.completion) Object.freeze(command.completion)
  } else Object.freeze(command.values)
  return Object.freeze(command)
}
