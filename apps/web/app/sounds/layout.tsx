import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "万籁库",
  description: "检索、分类与试听《寻仙》游戏音效。",
  alternates: { canonical: "/sounds" },
  openGraph: {
    title: "万籁库 | 寻仙音乐资料库",
    description: "检索、分类与试听《寻仙》游戏音效。",
    url: "/sounds",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "寻仙音乐资料库" }],
  },
};

export default function SoundsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
