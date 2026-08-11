import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { LOCALES, withLocale } from "@/lib/i18n";

const now = new Date();

const ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/courses", changeFrequency: "weekly", priority: 0.8 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // Every page is served under a locale prefix, so list both variants and
  // cross-link them with hreflang alternates.
  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(withLocale(route.path, locale)),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alt) => [alt, absoluteUrl(withLocale(route.path, alt))]),
        ),
      },
    })),
  );
}
