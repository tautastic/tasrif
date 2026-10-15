import type { Config } from "drizzle-kit";

const CONNECTING_COMMANDS = ["studio"];
const REQUIRED_ENV = ["PGHOST", "PGUSER", "PGDATABASE"] as const;

const connects = process.argv.some((argument) => CONNECTING_COMMANDS.includes(argument));

const requireEnv = (name: (typeof REQUIRED_ENV)[number]): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `drizzle.config.ts: ${name} must be set to run this drizzle-kit command (it needs ${REQUIRED_ENV.join(", ")})`,
    );
  }
  return value;
};

export default {
  schema: "./src/server/db/schema/index.ts",
  dialect: "postgresql",
  ...(connects
    ? {
        dbCredentials: {
          host: requireEnv("PGHOST"),
          user: requireEnv("PGUSER"),
          database: requireEnv("PGDATABASE"),
          ssl: false,
        },
      }
    : {}),
} satisfies Config;
