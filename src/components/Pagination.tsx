import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  extraParams?: Record<string, string>;
}

const MAX_VISIBLE_PAGES = 5;

const linkClassName = "px-2 sm:px-3 py-1 border border-gray-200 text-xs sm:text-sm";

const visiblePages = (currentPage: number, totalPages: number): number[] => {
  const start = Math.max(
    1,
    Math.min(currentPage - Math.floor(MAX_VISIBLE_PAGES / 2), totalPages - MAX_VISIBLE_PAGES + 1),
  );
  const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const buildHref = (basePath: string, page: number, extraParams: Record<string, string>): string =>
  `${basePath}?${new URLSearchParams({ ...extraParams, page: String(page) }).toString()}`;

const StepLink = ({
  label,
  rel,
  page,
  basePath,
  extraParams,
  disabled,
}: {
  label: string;
  rel: "prev" | "next";
  page: number;
  basePath: string;
  extraParams: Record<string, string>;
  disabled: boolean;
}) =>
  disabled ? (
    <span className={`${linkClassName} text-gray-600 bg-gray-100`} aria-disabled="true">
      {label}
    </span>
  ) : (
    <Link
      href={buildHref(basePath, page, extraParams)}
      rel={rel}
      aria-label={`${label} page`}
      className={`${linkClassName} hover:bg-gray-50`}
    >
      {label}
    </Link>
  );

const Pagination = ({ currentPage, totalPages, basePath, extraParams = {} }: PaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="flex flex-wrap justify-center items-center gap-1 sm:gap-2 mt-6" aria-label="Pagination">
      <StepLink
        label="Previous"
        rel="prev"
        page={currentPage - 1}
        basePath={basePath}
        extraParams={extraParams}
        disabled={currentPage <= 1}
      />

      {visiblePages(currentPage, totalPages).map((page) => (
        <Link
          key={page}
          href={buildHref(basePath, page, extraParams)}
          className={`${linkClassName} ${page === currentPage ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}
          aria-label={`Page ${page}`}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </Link>
      ))}

      <StepLink
        label="Next"
        rel="next"
        page={currentPage + 1}
        basePath={basePath}
        extraParams={extraParams}
        disabled={currentPage >= totalPages}
      />
    </nav>
  );
};

export default Pagination;
