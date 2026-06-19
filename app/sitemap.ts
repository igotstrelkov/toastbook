import type { MetadataRoute } from "next"

const SITE_URL = "https://toastbook.co"

// Only the marketing landing page is indexable; everything else is private or
// utility (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ]
}
