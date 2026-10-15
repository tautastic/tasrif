export const entryUrl = (slug: string): string => `/entry/${encodeURIComponent(slug)}`;

export const rootUrl = (root: string): string => `/root/${encodeURIComponent(root)}`;

export const searchUrl = (query: string): string => `/search?${new URLSearchParams({ q: query }).toString()}`;
