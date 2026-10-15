import { z } from "zod";

const requiredText = (name: string) => z.string({ error: `${name} is required` }).min(1, `${name} is required`);

const envSchema = z.object({
  PGHOST: requiredText("PGHOST"),
  PGUSER: requiredText("PGUSER"),
  PGDATABASE: requiredText("PGDATABASE"),
  AUTH_SECRET: requiredText("AUTH_SECRET").min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_PASSWORD: requiredText("AUTH_PASSWORD").min(12, "AUTH_PASSWORD must be at least 12 characters"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
