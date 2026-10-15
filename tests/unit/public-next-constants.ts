import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const loaded: unknown = require("next/constants.js");

const readPhase = (value: unknown): string => {
  if (typeof value === "object" && value !== null && "PHASE_PRODUCTION_BUILD" in value) {
    const phase = value.PHASE_PRODUCTION_BUILD;
    if (typeof phase === "string") {
      return phase;
    }
  }
  throw new Error("next/constants does not export PHASE_PRODUCTION_BUILD");
};

export const PHASE_PRODUCTION_BUILD: string = readPhase(loaded);
