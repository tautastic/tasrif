import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    scope: "/",
    start_url: "/",
    name: "Tasrif",
    short_name: "Tasrif",
    lang: "en-US",
    display_override: ["minimal-ui"],
    display: "standalone",
    theme_color: "#fff",
    background_color: "#fff",
    description: "Arabic morphological engine and English–Arabic dictionary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
