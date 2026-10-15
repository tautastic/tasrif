interface PgErrorCause {
  code?: string;
  message?: string;
  constraint?: string;
}

const hasSqlState = (value: unknown): value is PgErrorCause =>
  typeof value === "object" && value !== null && typeof (value as PgErrorCause).code === "string";

const getPgErrorCause = (error: unknown): PgErrorCause | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const cause = "cause" in error ? (error as { cause: unknown }).cause : undefined;
  if (hasSqlState(cause)) {
    return cause;
  }
  return hasSqlState(error) ? error : undefined;
};

export const UNIQUE_VIOLATION_SQLSTATE = "23505";
export const FOREIGN_KEY_VIOLATION_SQLSTATE = "23503";
export const INVALID_ROOT_SQLSTATE = "22023";

export const isUniqueViolation = (error: unknown, constraint?: string): boolean => {
  const cause = getPgErrorCause(error);
  return cause?.code === UNIQUE_VIOLATION_SQLSTATE && (constraint === undefined || cause.constraint === constraint);
};

export const isForeignKeyViolation = (error: unknown): boolean =>
  getPgErrorCause(error)?.code === FOREIGN_KEY_VIOLATION_SQLSTATE;

export const getPgErrorWithCode = (error: unknown, sqlState: string): { message: string } | null => {
  const cause = getPgErrorCause(error);
  if (cause?.code !== sqlState || typeof cause.message !== "string") {
    return null;
  }
  return { message: cause.message };
};
