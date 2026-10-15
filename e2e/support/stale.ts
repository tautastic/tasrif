import { execFileSync } from "node:child_process";
import { dropE2eDatabase } from "./database.ts";
import { STANDALONE_SERVER } from "./paths.ts";
import { terminateProcess } from "./server.ts";
import { readStateIfPresent, removeState } from "./state.ts";

const isOurServer = (pid: number): boolean => {
  try {
    const commandLine = execFileSync("ps", ["-p", String(pid), "-o", "args="], { encoding: "utf8" });
    return commandLine.includes(STANDALONE_SERVER);
  } catch {
    return false;
  }
};

export const cleanUpPreviousRun = async (): Promise<void> => {
  const previous = readStateIfPresent();
  if (!previous) {
    return;
  }
  if (isOurServer(previous.serverPid)) {
    await terminateProcess(previous.serverPid);
  }
  await dropE2eDatabase(previous.database.database).catch(() => undefined);
  removeState();
};
