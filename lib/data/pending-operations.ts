import { z } from "zod"
import { dataCommandSchema, type DataCommand } from "./data-command"

const KEY_PREFIX = "keepel-pending-data-v1:"
const commandsSchema = z.array(dataCommandSchema)
/** A per-tab journal of unresolved commands, never a data cache or auth source. */
export function readPendingCommands(userId: string): DataCommand[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY_PREFIX + userId) ?? "[]")
    const parsed = commandsSchema.safeParse(value)
    return parsed.success
      ? parsed.data.map((command) => {
          Object.freeze(command.values)
          return Object.freeze(command)
        })
      : []
  } catch {
    return []
  }
}
export function writePendingCommands(userId: string, commands: DataCommand[]): boolean {
  try {
    if (commands.length) sessionStorage.setItem(KEY_PREFIX + userId, JSON.stringify(commands))
    else sessionStorage.removeItem(KEY_PREFIX + userId)
    return true
  } catch {
    return false
  }
}
