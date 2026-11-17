import type { Metadata } from "next";
import "./globals.css";
import { PlayerProvider } from "./providers";
import { SiteShell } from "./site-shell";
import { themeBootScript } from "./theme";
import { VisitTracker } from "./visit-counter";

export const metadata: Metadata = {
  metadataBase: new URL("https://music.xunxian.wiki"),
  title: {
    default: "寻仙音乐资料库",
    template: "%s | 寻仙音乐资料库",
  },
  description: "浏览、检索与试听《寻仙》游戏音乐与音效资料。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "寻仙音乐资料库",
    title: "寻仙音乐资料库",
    description: "浏览、检索与试听《寻仙》游戏音乐与音效资料。",
    url: "/",
    images: [{ url: "/og-archive.png", width: 1200, height: 630, alt: "寻仙音乐资料库" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "寻仙音乐资料库",
    description: "浏览、检索与试听《寻仙》游戏音乐与音效资料。",
    images: ["/og-archive.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning><head><link rel="icon" href="/icons/logo.png" type="image/png" sizes="64x64" /><link rel="apple-touch-icon" href="/icons/logo.png" /><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head><body><VisitTracker /><PlayerProvider><SiteShell>{children}</SiteShell></PlayerProvider></body></html>;
}
