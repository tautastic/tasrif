interface StoredFetch {
  value: unknown;
  tags: readonly string[];
  revalidate: unknown;
}

export interface FakeIncrementalCache {
  sets: Array<{ key: string; tags: readonly string[]; revalidate: unknown }>;
  hits: number;
  expireTag: (tag: string) => void;
  clear: () => void;
  uninstall: () => void;
}

interface FetchSetContext {
  tags?: readonly string[];
}

interface FetchSetValue {
  revalidate?: unknown;
}

const isFetchSetValue = (value: unknown): value is FetchSetValue => typeof value === "object" && value !== null;

type CacheHolder = typeof globalThis & { __incrementalCache?: unknown };

export const installFakeIncrementalCache = (): FakeIncrementalCache => {
  const holder: CacheHolder = globalThis;
  const entries = new Map<string, StoredFetch>();
  const fake: FakeIncrementalCache = {
    sets: [],
    hits: 0,
    expireTag: (tag) => {
      for (const [key, entry] of [...entries]) {
        if (entry.tags.includes(tag)) {
          entries.delete(key);
        }
      }
    },
    clear: () => entries.clear(),
    uninstall: () => {
      delete holder.__incrementalCache;
    },
  };
  holder.__incrementalCache = {
    isOnDemandRevalidate: false,
    generateSimpleCacheKey: async (input: string) => input,
    get: async (key: string) => {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }
      fake.hits++;
      return { isStale: false, value: entry.value };
    },
    set: async (key: string, value: unknown, context: FetchSetContext) => {
      const tags = context.tags ?? [];
      const revalidate = isFetchSetValue(value) ? value.revalidate : undefined;
      entries.set(key, { value, tags, revalidate });
      fake.sets.push({ key, tags, revalidate });
    },
  };
  return fake;
};
