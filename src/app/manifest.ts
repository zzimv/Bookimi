import type { MetadataRoute } from "next";

// Веб-манифест: название, цвета бренда, иконки (звезда + «б»). /manifest.webmanifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "БУКИМИ — персональные книги",
    short_name: "БУКИМИ",
    description: "Книга, где главный герой — тот, кого вы любите",
    lang: "ru",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf0",
    theme_color: "#1e4d3b",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
