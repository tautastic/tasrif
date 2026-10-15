import { createServer } from "node:net";

const LOOPBACK = "127.0.0.1";

export const findFreePort = (preferred?: number): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error) => {
      reject(
        preferred === undefined
          ? error
          : new Error(`Port ${preferred} is not available on ${LOOPBACK}: ${String(error)}`),
      );
    });
    probe.listen(preferred ?? 0, LOOPBACK, () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

export const portFromEnv = (name: string): number | undefined => {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port number, received "${raw}"`);
  }
  return port;
};
