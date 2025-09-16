import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/auth/*", "/about", "/pricing", "/contact", "/blog/*"],
      disallow: ["/dashboard/*", "/api/*", "/admin/*", "/_next/*", "/static/*"],
    },
    sitemap: "https://example.com/sitemap.xml",
  }
}
