"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-10" role="alert">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-gray-700">An unexpected error occurred while loading this page. Please try again.</p>
      {error.digest && <p className="text-sm text-gray-600">Reference: {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
