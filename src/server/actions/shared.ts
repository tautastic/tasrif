import type { z } from "zod";

export const parseOrThrow = <S extends z.ZodType>(schema: S, data: unknown, label: string): z.output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`Invalid ${label} — ${details.join("; ")}`);
  }
  return result.data;
};
