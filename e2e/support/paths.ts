import { existsSync } from "node:fs";
import { join } from "node:path";

export const REPO_ROOT = join(import.meta.dirname, "..", "..");
export const ARTIFACTS_DIR = join(REPO_ROOT, "e2e", ".artifacts");
export const STATE_FILE = join(ARTIFACTS_DIR, "state.json");
export const STANDALONE_DIR = join(REPO_ROOT, ".next", "standalone");
export const STANDALONE_SERVER = join(STANDALONE_DIR, "server.js");

const PREINSTALLED_CHROMIUM = "/opt/pw-browsers/chromium";

export const chromiumExecutable = (): string | undefined => {
  const configured = process.env.E2E_CHROMIUM_PATH?.trim();
  if (configured) {
    return configured;
  }
  return existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;
};

export const firefoxSelected = (): boolean => process.env.E2E_BROWSER?.trim().toLowerCase() === "firefox";

export const firefoxExecutable = (): string | undefined => process.env.E2E_FIREFOX_PATH?.trim() || undefined;
