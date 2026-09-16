import { after } from "node:test";
import type { Db } from "./client.ts";
import { createTestDatabase } from "./database.ts";

export { codepointsOf, compareArabic, describeArabic, firstDifference, isolate } from "./arabic.ts";
export { assertArabicEqual, assertParadigmEqual, assertSqlState } from "./assert.ts";
export { Db, type SqlFailure, type SqlParam } from "./client.ts";
export {
  collectSqlSources,
  createTestDatabase,
  type SqlSource,
  type TestDatabase,
  type TestDatabaseConfig,
} from "./database.ts";
export * from "./morphology.ts";
export { assertGolden, updatingGoldens } from "./snapshot.ts";

export const openDatabase = async (): Promise<Db> => {
  const handle = await createTestDatabase();
  after(() => handle.drop());
  return handle.db;
};
