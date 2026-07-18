import { z } from "zod"

const SIGNUP_INPUT_SCHEMA = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(6),
    confirmPassword: z.string(),
    fullName: z.string().trim().min(1),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ["confirmPassword"],
  })

export function parseSignupInput(input: {
  email: unknown
  password: unknown
  confirmPassword: unknown
  fullName: unknown
}) {
  return SIGNUP_INPUT_SCHEMA.safeParse(input)
}
