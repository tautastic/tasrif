import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_DIR = join(import.meta.dirname, "..", "..", "src");
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];

const firstExistingFile = (base: string): string | null => {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("~/")) {
      const resolved = firstExistingFile(join(SRC_DIR, specifier.slice(2)));
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
        const target = new URL(specifier, context.parentURL);
        const resolved = firstExistingFile(fileURLToPath(target));
        if (resolved) {
          return { url: resolved, shortCircuit: true };
        }
      }
      throw error;
    }
  },
});
