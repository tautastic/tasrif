interface PgErrorCause {
  code?: string;
  message?: string;
}

const getPgErrorCause = (error: unknown): PgErrorCause | undefined => {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return undefined;
  }
  const cause = (error as { cause: unknown }).cause;
  return typeof cause === "object" && cause !== null ? (cause as PgErrorCause) : undefined;
};

export const UNIQUE_VIOLATION_SQLSTATE = "23505";

export const isUniqueViolation = (error: unknown): boolean =>
  getPgErrorCause(error)?.code === UNIQUE_VIOLATION_SQLSTATE;

export const getPgErrorWithCode = (error: unknown, sqlState: string): { message: string } | null => {
  const cause = getPgErrorCause(error);
  if (cause?.code !== sqlState || typeof cause.message !== "string") {
    return null;
  }
  return { message: cause.message };
};
