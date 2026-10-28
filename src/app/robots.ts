import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/kabinet", "/kniga/", "/zakaz/", "/sozdat", "/vhod", "/chek/", "/otpiska"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
