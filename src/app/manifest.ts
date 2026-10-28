import type { MetadataRoute } from "next";

/** Lets phones install the tracker as a home-screen app that opens full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Internship Tracker",
    short_name: "InternTrack",
    description: "A private notebook for tracking an internship search.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
