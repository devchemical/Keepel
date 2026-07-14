const INTERNAL_REDIRECT_BASE = "https://keepel.invalid"
const INVALID_PERCENT_ENCODING_PATTERN = /%(?![\da-f]{2})/i

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
  })
}

export function sanitizeInternalRedirect(destination: unknown): string {
  if (
    typeof destination !== "string" ||
    destination.length === 0 ||
    destination !== destination.trim() ||
    containsControlCharacter(destination) ||
    INVALID_PERCENT_ENCODING_PATTERN.test(destination) ||
    destination.includes("\\") ||
    !destination.startsWith("/") ||
    destination.startsWith("//")
  ) {
    return "/"
  }

  try {
    const url = new URL(destination, INTERNAL_REDIRECT_BASE)

    if (url.origin !== INTERNAL_REDIRECT_BASE) {
      return "/"
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}
