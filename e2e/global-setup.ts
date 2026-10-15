import { MAIN_SITE_URL } from "./support/constants.ts";
import { createE2eDatabase, dropE2eDatabase, openDatabase } from "./support/database.ts";
import { findFreePort, portFromEnv } from "./support/ports.ts";
import { seedDatabase } from "./support/seed.ts";
import { prepareStandalone, startWebServer } from "./support/server.ts";
import { cleanUpPreviousRun } from "./support/stale.ts";
import { type DatabaseSettings, removeState, writeState } from "./support/state.ts";

const globalSetup = async (): Promise<void> => {
  await cleanUpPreviousRun();
  await prepareStandalone();

  let database: DatabaseSettings | undefined;
  let stop: (() => Promise<void>) | undefined;
  try {
    database = await createE2eDatabase();
    const db = await openDatabase(database);
    const seed = await (async () => {
      try {
        return await seedDatabase(db);
      } finally {
        await db.close();
      }
    })();

    const port = await findFreePort(portFromEnv("E2E_PORT"));
    const server = await startWebServer({ port, database, siteUrl: MAIN_SITE_URL, logName: "server-main" });
    stop = server.stop;

    process.env.E2E_BASE_URL = server.baseUrl;
    writeState({ baseUrl: server.baseUrl, serverPid: server.pid, database, seed });
  } catch (error) {
    await stop?.();
    if (database) {
      await dropE2eDatabase(database.database).catch(() => undefined);
    }
    removeState();
    throw error;
  }
};

export default globalSetup;
