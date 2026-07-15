import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/courses"],
      disallow: [
        "/api/",
        "/admin/",
        "/dashboard",
        "/login",
        "/progress",
        "/courses/new",
        "/courses/*/edit",
        "/lessons/new",
        "/lessons/*/edit",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
