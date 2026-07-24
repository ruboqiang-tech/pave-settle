export function normalizeUniqueConstraintError(error: unknown, friendlyMessage: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/UNIQUE constraint failed|constraint failed/i.test(message)) {
    return new Error(friendlyMessage)
  }

  return error instanceof Error ? error : new Error(message)
}
