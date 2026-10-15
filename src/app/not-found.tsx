import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  openGraph: { title: "Page not found" },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-gray-700">
        We could not find what you were looking for. Check the address, or search the dictionary using the box above.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="btn-secondary">
          Go to the home page
        </Link>
        <Link href="/lang/ar" className="btn-secondary">
          Browse Arabic entries
        </Link>
        <Link href="/lang/en" className="btn-secondary">
          Browse English entries
        </Link>
      </div>
    </div>
  );
}
