import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const STUBS: Record<string, string> = {
  "next/headers": pathToFileURL(`${import.meta.dirname}/stubs/next-headers.ts`).href,
  "next/cache": pathToFileURL(`${import.meta.dirname}/stubs/next-cache.ts`).href,
};

const NEEDS_EXTENSION = new Set(["next/server", "next/navigation"]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) {
      return { url: stub, shortCircuit: true };
    }
    if (NEEDS_EXTENSION.has(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    return nextResolve(specifier, context);
  },
});
