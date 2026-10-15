import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "next/dist/build/swc/index.js";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type GlobalWithStorage = typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage };

const nextGlobals: GlobalWithStorage = globalThis;
nextGlobals.AsyncLocalStorage ??= AsyncLocalStorage;

const HERE = dirname(fileURLToPath(import.meta.url));
const STUBS: Readonly<Record<string, string>> = {
  "next/link": pathToFileURL(join(HERE, "public-next-link.ts")).href,
  "next/navigation": pathToFileURL(join(HERE, "public-next-navigation.ts")).href,
  "next/server": pathToFileURL(join(HERE, "public-next-server.ts")).href,
  "next/constants": pathToFileURL(join(HERE, "public-next-constants.ts")).href,
};

const isTransformResult = (value: unknown): value is { code: string } =>
  typeof value === "object" && value !== null && "code" in value && typeof value.code === "string";

const compileTsx = (source: string, filename: string): string => {
  const result: unknown = transformSync(source, {
    filename,
    sourceMaps: false,
    module: { type: "es6" },
    jsc: {
      target: "es2022",
      parser: { syntax: "typescript", tsx: true },
      transform: { react: { runtime: "automatic", development: false } },
    },
  });
  if (!isTransformResult(result)) {
    throw new Error(`Could not compile ${filename}`);
  }
  return result.code;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) {
      return { url: stub, shortCircuit: true };
    }
    if (/^next\/[\w-]+$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".json") && url.includes("/src/content/")) {
      return {
        format: "module",
        source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`,
        shortCircuit: true,
      };
    }
    if (url.startsWith("file:") && url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    if (url.startsWith("file:") && url.endsWith(".tsx")) {
      const filename = fileURLToPath(url);
      return { format: "module", source: compileTsx(readFileSync(filename, "utf8"), filename), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

export const renderMarkup = (element: ReactElement): string => renderToStaticMarkup(element);

export interface ParsedTag {
  name: string;
  attributes: Record<string, string>;
  index: number;
}

const ATTRIBUTE = /([A-Za-z_:][\w:.-]*)(?:="([^"]*)")?/g;

export const findTags = (html: string, name: string): ParsedTag[] => {
  const tags: ParsedTag[] = [];
  const opening = new RegExp(`<${name}(?=[\\s>/])([^>]*)>`, "g");
  for (const match of html.matchAll(opening)) {
    const attributes: Record<string, string> = {};
    for (const attribute of (match[1] ?? "").matchAll(ATTRIBUTE)) {
      const attributeName = attribute[1];
      if (attributeName) {
        attributes[attributeName] = attribute[2] ?? "";
      }
    }
    tags.push({ name, attributes, index: match.index });
  }
  return tags;
};

export const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
