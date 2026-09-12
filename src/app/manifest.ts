import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — Intelligent School Management Platform`,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f8fc",
    theme_color: "#0a1730",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
