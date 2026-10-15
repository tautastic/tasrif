import { SENSE_SEARCH_MAX_LIMIT, type SenseSearchOption, type SenseSearchResponse } from "~/lib/api/sense-search";

const BATCH_DELAY_MS = 10;
const CACHE_TTL_MS = 30_000;

interface CachedLookup {
  promise: Promise<SenseSearchOption | null>;
  expiresAt: number;
}

const cache = new Map<number, CachedLookup>();
let queue = new Map<number, (option: SenseSearchOption | null) => void>();
let isFlushScheduled = false;

const fetchByIds = async (ids: number[]): Promise<SenseSearchOption[]> => {
  const response = await fetch(`/api/senses/search?${new URLSearchParams({ ids: ids.join(",") })}`);
  if (!response.ok) {
    throw new Error(`Sense lookup failed with status ${response.status}`);
  }
  return ((await response.json()) as SenseSearchResponse).items;
};

const flush = async () => {
  const batch = queue;
  queue = new Map();
  isFlushScheduled = false;

  const ids = [...batch.keys()];
  for (let start = 0; start < ids.length; start += SENSE_SEARCH_MAX_LIMIT) {
    const chunk = ids.slice(start, start + SENSE_SEARCH_MAX_LIMIT);
    const items = await fetchByIds(chunk).catch((error: unknown) => {
      console.error(error);
      for (const id of chunk) {
        cache.delete(id);
      }
      return [];
    });
    for (const id of chunk) {
      batch.get(id)?.(items.find((item) => item.id === id) ?? null);
    }
  }
};

export const rememberSense = (option: SenseSearchOption) => {
  cache.set(option.id, { promise: Promise.resolve(option), expiresAt: Date.now() + CACHE_TTL_MS });
};

export const lookupSense = (id: number): Promise<SenseSearchOption | null> => {
  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = new Promise<SenseSearchOption | null>((resolve) => {
    queue.set(id, resolve);
  });
  cache.set(id, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
  if (!isFlushScheduled) {
    isFlushScheduled = true;
    setTimeout(flush, BATCH_DELAY_MS);
  }
  return promise;
};
