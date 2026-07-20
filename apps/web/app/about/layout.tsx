import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "关于寻仙",
  description: "了解《寻仙》的世界背景、资料库作者与资源整理致谢。",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "关于寻仙 | 寻仙音乐资料库",
    description: "了解《寻仙》的世界背景、资料库作者与资源整理致谢。",
    url: "/about",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "寻仙音乐资料库" }],
  },
};

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
