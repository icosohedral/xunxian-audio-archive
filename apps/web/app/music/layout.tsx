import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "仙乐集",
  description: "浏览与试听《寻仙》城镇、野外、副本和节庆背景音乐。",
  alternates: { canonical: "/music" },
  openGraph: {
    title: "仙乐集 | 寻仙音乐资料库",
    description: "浏览与试听《寻仙》城镇、野外、副本和节庆背景音乐。",
    url: "/music",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "寻仙音乐资料库" }],
  },
};

export default function MusicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
