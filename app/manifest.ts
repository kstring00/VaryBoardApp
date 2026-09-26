import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Vary Board",
    short_name: "Vary Board",
    description: "Your program. Beyond the clinic. The companion app for the Vary Board wall-mounted training board.",
    start_url: "/app",
    scope: "/app",
    display: "standalone",
    orientation: "any",
    background_color: "#f1efea",
    theme_color: "#f1efea",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
