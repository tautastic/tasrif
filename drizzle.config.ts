import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema/index.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.PGHOST ?? "",
    user: process.env.PGUSER ?? "",
    database: process.env.PGDATABASE ?? "",
    ssl: false,
  },
} satisfies Config;
