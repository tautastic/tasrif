import { notFound } from "next/navigation";

export const ENTRY_LIST_PAGE_SIZE = 100;

export const parsePageParam = (pageParam: string | string[] | undefined): number => {
  const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const page = Math.floor(Number(raw));
  return Number.isFinite(page) && page > 0 ? page : 1;
};

export const notFoundIfEmpty = (total: number): void => {
  if (total === 0) {
    notFound();
  }
};
