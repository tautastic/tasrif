"use client";

import "./styles/globals.css";
import { useEffect } from "react";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <header className="mb-6 border-b border-gray-300 pb-3">
            <a href="/" className="text-3xl font-bold text-gray-900 no-underline">
              Tasrif
            </a>
          </header>
          <main className="max-w-xl space-y-4 py-10" role="alert">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-gray-700">Tasrif could not be displayed. Please try again in a moment.</p>
            {error.digest && <p className="text-sm text-gray-600">Reference: {error.digest}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => retry()} className="btn-primary">
                Try again
              </button>
              <a href="/" className="btn-secondary">
                Go to the home page
              </a>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
