import { type ChildProcess, spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { cp } from "node:fs/promises";
import { join } from "node:path";
import { ADMIN_PASSWORD, AUTH_SECRET } from "./constants.ts";
import { ARTIFACTS_DIR, REPO_ROOT, STANDALONE_DIR, STANDALONE_SERVER } from "./paths.ts";
import type { DatabaseSettings } from "./state.ts";

const STARTUP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 150;
const GRACEFUL_STOP_MS = 5_000;

export interface ServerOptions {
  port: number;
  database: DatabaseSettings;
  siteUrl: string;
  logName: string;
}

export interface RunningServer {
  pid: number;
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
}

export const assertBuilt = (): void => {
  if (!existsSync(STANDALONE_SERVER)) {
    throw new Error(
      `${STANDALONE_SERVER} does not exist. Run "pnpm build" (or "pnpm e2e:build") before the end-to-end suite.`,
    );
  }
};

export const prepareStandalone = async (): Promise<void> => {
  assertBuilt();
  await cp(join(REPO_ROOT, ".next", "static"), join(STANDALONE_DIR, ".next", "static"), {
    recursive: true,
    force: true,
  });
  await cp(join(REPO_ROOT, "public"), join(STANDALONE_DIR, "public"), { recursive: true, force: true });
};

const serverEnvironment = ({ port, database, siteUrl }: ServerOptions): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  HOSTNAME: "127.0.0.1",
  PORT: String(port),
  SITE_URL: siteUrl,
  AUTH_PASSWORD: ADMIN_PASSWORD,
  AUTH_SECRET,
  PGHOST: database.host,
  PGPORT: String(database.port),
  PGUSER: database.user,
  PGDATABASE: database.database,
  ...(database.password === undefined ? {} : { PGPASSWORD: database.password }),
});

const waitForHealth = async (baseUrl: string, child: ChildProcess, logPath: string): Promise<void> => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`The web server exited during startup (exit ${child.exitCode}). See ${logPath}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`The web server did not become healthy within ${STARTUP_TIMEOUT_MS}ms. See ${logPath}`);
};

export const terminateProcess = async (pid: number): Promise<void> => {
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  if (!alive()) {
    return;
  }
  process.kill(pid, "SIGTERM");
  const deadline = Date.now() + GRACEFUL_STOP_MS;
  while (alive() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (alive()) {
    process.kill(pid, "SIGKILL");
  }
};

export const startWebServer = async (options: ServerOptions): Promise<RunningServer> => {
  assertBuilt();
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const logPath = join(ARTIFACTS_DIR, `${options.logName}.log`);
  const logFd = openSync(logPath, "w");
  const child = spawn(process.execPath, [STANDALONE_SERVER], {
    cwd: STANDALONE_DIR,
    env: serverEnvironment(options),
    stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  const baseUrl = `http://127.0.0.1:${options.port}`;
  const pid = child.pid;
  if (pid === undefined) {
    throw new Error("The web server process could not be started");
  }
  try {
    await waitForHealth(baseUrl, child, logPath);
  } catch (error) {
    await terminateProcess(pid);
    throw error;
  }
  return { pid, port: options.port, baseUrl, stop: () => terminateProcess(pid) };
};
