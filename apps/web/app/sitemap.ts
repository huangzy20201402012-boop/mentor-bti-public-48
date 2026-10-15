import { btiContent } from "@mentor-bti/bti-content";
import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["/", "/domains", "/types", "/quick/start"];
  return [
    ...staticPaths.map((path) => ({ url: new URL(path, siteUrl).toString(), changeFrequency: "monthly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...btiContent.personalities.map((personality) => ({ url: new URL(`/types/${personality.code.toLowerCase()}`, siteUrl).toString(), changeFrequency: "monthly" as const, priority: 0.6 }))
  ];
}
