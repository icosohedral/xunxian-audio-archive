import type { MetadataRoute } from "next";

const SITE_URL = "https://music.xunxian.wiki";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/music`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/sounds`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "yearly", priority: 0.5 },
  ];
}
