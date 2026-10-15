import { notFound } from "next/navigation";

export const ENTRY_LIST_PAGE_SIZE = 100;
export const MORPH_PATTERN_LIST_PAGE_SIZE = 50;

const MAX_PAGE = 1_000_000;

export const parsePageParam = (pageParam: string | string[] | undefined): number => {
  const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const page = Math.floor(Number(raw));
  return Number.isFinite(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
};

export const countPages = (total: number, pageSize: number): number => Math.ceil(total / pageSize);

export const notFoundIfOutOfRange = ({ page, total, pageSize }: { page: number; total: number; pageSize: number }) => {
  if (total === 0 || page > countPages(total, pageSize)) {
    notFound();
  }
};

export const withPageParam = (path: string, page: number): string => (page > 1 ? `${path}?page=${page}` : path);

export const withPageTitle = (title: string, page: number): string => (page > 1 ? `${title} — Page ${page}` : title);
