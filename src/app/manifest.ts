import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — Intelligent School Management Platform`,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8fc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
