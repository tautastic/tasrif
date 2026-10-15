import type { Metadata } from "next";
import "./styles/globals.css";
import type { ReactNode } from "react";
import { DEFAULT_OPEN_GRAPH, getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "~/app/site";
import AdminStatusProvider from "~/components/auth/AdminStatusProvider";
import Footer from "~/components/layout/Footer";
import Header from "~/components/layout/Header";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: `${SITE_NAME} — ${SITE_DESCRIPTION}`, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: DEFAULT_OPEN_GRAPH,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AdminStatusProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:border focus:border-gray-400 focus:bg-white focus:px-3 focus:py-2 focus:text-blue-700"
          >
            Skip to content
          </a>
          <div className="max-w-5xl mx-auto px-4 py-6 overflow-hidden">
            <Header />
            <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
              {children}
            </main>
            <Footer />
          </div>
        </AdminStatusProvider>
      </body>
    </html>
  );
}
