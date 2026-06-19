import type { MetadataRoute } from "next"

const SITE_URL = "https://toastbook.co"

// Private/utility areas stay out of search. The guest recorder (/e/*) is shared
// privately via QR/link, not meant to be discoverable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/thanks", "/sign-in", "/e/", "/health"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
