import type { MetadataRoute } from "next";
import { STATIC_ROUTES } from "@/data/static-routes";

const APP_URL = "https://green-rides.vercel.app";

function toSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routePages = STATIC_ROUTES.map((r) => ({
    url: `${APP_URL}/routes/${toSlug(r.from_city)}-to-${toSlug(r.to_city)}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${APP_URL}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/drivers`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    ...routePages,
  ];
}
