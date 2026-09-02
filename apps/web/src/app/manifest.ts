import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Waste-Wise Municipal Operations",
    short_name: "Waste-Wise",
    description: "A unified smart-waste operations workspace for field teams and municipalities.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f8f6",
    theme_color: "#0d2d2a",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/waste-wise-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/waste-wise-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
