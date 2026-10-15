import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { ARTIFACTS_DIR, STATE_FILE } from "./paths.ts";
import type { SeedIds } from "./seed.ts";

export interface DatabaseSettings {
  host: string;
  port: number;
  user: string;
  password: string | undefined;
  database: string;
}

export interface E2eState {
  baseUrl: string;
  serverPid: number;
  database: DatabaseSettings;
  seed: SeedIds;
}

export const writeState = (state: E2eState): void => {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

export const readState = (): E2eState => JSON.parse(readFileSync(STATE_FILE, "utf8")) as E2eState;

export const readStateIfPresent = (): E2eState | null => {
  try {
    return readState();
  } catch {
    return null;
  }
};

export const removeState = (): void => {
  rmSync(STATE_FILE, { force: true });
};
