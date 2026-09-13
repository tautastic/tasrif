import { z } from "zod";

const envSchema = z.object({
  PGHOST: z.string().min(1, "PGHOST is required"),
  PGUSER: z.string().min(1, "PGUSER is required"),
  PGDATABASE: z.string().min(1, "PGDATABASE is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_PASSWORD: z.string().min(1, "AUTH_PASSWORD is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
