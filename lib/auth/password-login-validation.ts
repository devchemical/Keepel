import { z } from "zod"

const PASSWORD_LOGIN_CREDENTIALS_SCHEMA = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export function parsePasswordLoginCredentials(input: { email: unknown; password: unknown }) {
  return PASSWORD_LOGIN_CREDENTIALS_SCHEMA.safeParse(input)
}
