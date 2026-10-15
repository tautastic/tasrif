import { dropE2eDatabase } from "./support/database.ts";
import { terminateProcess } from "./support/server.ts";
import { readStateIfPresent, removeState } from "./support/state.ts";

const globalTeardown = async (): Promise<void> => {
  const state = readStateIfPresent();
  if (!state) {
    return;
  }
  await terminateProcess(state.serverPid);
  await dropE2eDatabase(state.database.database);
  removeState();
};

export default globalTeardown;
