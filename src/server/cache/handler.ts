const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_MEASURE_DEPTH = 8;
const CACHE_TAGS_HEADER = "x-next-cache-tags";
const STORABLE_KINDS: ReadonlySet<string> = new Set(["APP_PAGE", "APP_ROUTE", "PAGES", "FETCH"]);
const STATE_KEY = Symbol.for("tasrif.public-cache-handler");

type UnknownRecord = Record<string, unknown>;

interface StoredEntry {
  value: unknown;
  lastModified: number;
  tags: readonly string[];
  size: number;
}

interface CacheHit {
  lastModified: number;
  value: unknown;
}

interface HandlerOptions {
  maxMemoryCacheSize?: number;
}

interface GetContext {
  kind?: string;
  tags?: readonly string[];
  softTags?: readonly string[];
}

interface SetContext {
  tags?: readonly string[];
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const now = (): number => performance.timeOrigin + performance.now();

export const measureBytes = (value: unknown, depth = 0): number => {
  if (typeof value === "string") {
    return value.length * 2;
  }
  if (value instanceof Uint8Array) {
    return value.byteLength;
  }
  if (typeof value !== "object" || value === null || depth >= MAX_MEASURE_DEPTH) {
    return 8;
  }
  let total = 16;
  if (value instanceof Map) {
    for (const [key, item] of value) {
      total += measureBytes(key, depth + 1) + measureBytes(item, depth + 1);
    }
    return total;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      total += measureBytes(item, depth + 1);
    }
    return total;
  }
  for (const [key, item] of Object.entries(value)) {
    total += key.length * 2 + measureBytes(item, depth + 1);
  }
  return total;
};

export const isStorable = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.kind !== "string" || !STORABLE_KINDS.has(value.kind)) {
    return false;
  }
  return value.status === undefined || value.status === 200;
};

export const collectTags = (value: unknown, context: SetContext | undefined): string[] => {
  const tags = new Set<string>(context?.tags ?? []);
  if (isRecord(value) && isRecord(value.headers)) {
    const header = value.headers[CACHE_TAGS_HEADER];
    if (typeof header === "string") {
      for (const tag of header.split(",")) {
        if (tag !== "") {
          tags.add(tag);
        }
      }
    }
  }
  return [...tags];
};

export class MemoryCacheStore {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly expiredAt = new Map<string, number>();
  private totalBytes = 0;
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get size(): number {
    return this.entries.size;
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  get(key: string, extraTags: readonly string[] = []): CacheHit | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    const currentTime = now();
    if (currentTime - entry.lastModified > MAX_ENTRY_AGE_MS || this.isExpired([...entry.tags, ...extraTags], entry)) {
      this.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { lastModified: entry.lastModified, value: entry.value };
  }

  set(key: string, value: unknown, tags: readonly string[]): boolean {
    this.delete(key);
    if (!isStorable(value)) {
      return false;
    }
    const size = key.length * 2 + measureBytes(value);
    if (size > this.maxBytes) {
      return false;
    }
    this.entries.set(key, { value, lastModified: now(), tags, size });
    this.totalBytes += size;
    this.evict();
    return true;
  }

  delete(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.totalBytes -= entry.size;
      this.entries.delete(key);
    }
  }

  expireTags(tags: readonly string[]): void {
    const expiredNow = now();
    for (const tag of tags) {
      this.expiredAt.set(tag, expiredNow);
    }
    for (const [key, entry] of [...this.entries]) {
      if (this.isExpired(entry.tags, entry)) {
        this.delete(key);
      }
    }
    for (const [tag, timestamp] of [...this.expiredAt]) {
      if (expiredNow - timestamp > MAX_ENTRY_AGE_MS) {
        this.expiredAt.delete(tag);
      }
    }
  }

  private isExpired(tags: readonly string[], entry: StoredEntry): boolean {
    return tags.some((tag) => {
      const expired = this.expiredAt.get(tag);
      return expired !== undefined && expired >= entry.lastModified;
    });
  }

  private evict(): void {
    for (const key of this.entries.keys()) {
      if (this.totalBytes <= this.maxBytes) {
        return;
      }
      this.delete(key);
    }
  }
}

type GlobalWithStore = typeof globalThis & { [STATE_KEY]?: MemoryCacheStore };

const sharedStore = (maxBytes: number): MemoryCacheStore => {
  const holder: GlobalWithStore = globalThis;
  holder[STATE_KEY] ??= new MemoryCacheStore(maxBytes);
  return holder[STATE_KEY];
};

export const resetSharedStore = (): void => {
  const holder: GlobalWithStore = globalThis;
  delete holder[STATE_KEY];
};

const toTagList = (tags: string | readonly string[]): string[] => (typeof tags === "string" ? [tags] : [...tags]);

export default class PublicCacheHandler {
  private readonly store: MemoryCacheStore;

  constructor(options?: HandlerOptions) {
    this.store = sharedStore(options?.maxMemoryCacheSize ?? DEFAULT_MAX_BYTES);
  }

  async get(key: string, context?: GetContext): Promise<CacheHit | null> {
    const extraTags = context?.kind === "FETCH" ? [...(context.tags ?? []), ...(context.softTags ?? [])] : [];
    return this.store.get(key, extraTags);
  }

  async set(key: string, data: unknown, context?: SetContext): Promise<void> {
    this.store.set(key, data, collectTags(data, context));
  }

  async revalidateTag(tags: string | readonly string[], _durations?: unknown): Promise<void> {
    this.store.expireTags(toTagList(tags));
  }

  resetRequestCache(): void {}
}
