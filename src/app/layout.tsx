import type { Metadata } from "next";
import "./styles/globals.css";
import type { ReactNode } from "react";
import Footer from "~/components/layout/Footer";
import Header from "~/components/layout/Header";

export const metadata: Metadata = {
  title: "Tasrif",
  description: "Arabic morphological engine and English–Arabic dictionary",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-800 antialiased">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
