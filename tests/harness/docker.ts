import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "tasrif-test-pg";
const IMAGE = "postgres:18-trixie";
const READY_TIMEOUT_MS = 60_000;
const CONTAINER_START_TIMEOUT_MS = 90_000;

export interface ServerConfig {
  host: string;
  port: number;
  user: string;
  password: string | undefined;
  adminDatabase: string;
}

const docker = async (args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync("docker", args, { encoding: "utf8" });
  return stdout.trim();
};

const dockerQuiet = async (args: string[]): Promise<string | null> => {
  try {
    return await docker(args);
  } catch {
    return null;
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseServerUrl = (value: string): ServerConfig => {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username) || "postgres",
    password: url.password ? decodeURIComponent(url.password) : undefined,
    adminDatabase: url.pathname.replace(/^\//, "") || "postgres",
  };
};

const containerState = (): Promise<string | null> =>
  dockerQuiet(["inspect", "-f", "{{.State.Running}}", CONTAINER_NAME]);

const mappedPort = async (): Promise<number | null> => {
  const mapping = await dockerQuiet(["port", CONTAINER_NAME, "5432/tcp"]);
  if (mapping === null) {
    return null;
  }
  const port = Number(mapping.split("\n")[0]?.split(":").pop());
  return Number.isInteger(port) ? port : null;
};

const runContainer = (): Promise<string | null> =>
  dockerQuiet([
    "run",
    "-d",
    "--name",
    CONTAINER_NAME,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e",
    "POSTGRES_USER=postgres",
    "-e",
    "POSTGRES_DB=postgres",
    "-p",
    "127.0.0.1::5432",
    IMAGE,
  ]);

export const resolveServer = async (): Promise<ServerConfig> => {
  const fromEnv = process.env.TEST_DATABASE_URL;
  if (fromEnv) {
    return parseServerUrl(fromEnv);
  }

  const deadline = Date.now() + CONTAINER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await containerState();
    if (state === "true") {
      const port = await mappedPort();
      if (port !== null) {
        return { host: "127.0.0.1", port, user: "postgres", password: undefined, adminDatabase: "postgres" };
      }
    } else if (state === "false") {
      await dockerQuiet(["start", CONTAINER_NAME]);
    } else {
      await runContainer();
    }
    await delay(100 + Math.floor(Math.random() * 250));
  }

  throw new Error(
    `Could not start the test database container "${CONTAINER_NAME}" within ${CONTAINER_START_TIMEOUT_MS}ms. ` +
      `Is the Docker daemon running? Alternatively point TEST_DATABASE_URL at a PostgreSQL 18 server.`,
  );
};

export const removeContainer = async (): Promise<void> => {
  await dockerQuiet(["rm", "-f", CONTAINER_NAME]);
};

export const readyTimeoutMs = READY_TIMEOUT_MS;
