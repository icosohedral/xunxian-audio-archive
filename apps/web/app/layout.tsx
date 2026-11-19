import type { Metadata } from "next";
import "./globals.css";
import { htmlLang } from "./i18n";
import { LocaleProvider } from "./locale-provider";
import { getLocale, getMessages } from "./locale-server";
import { PlayerProvider } from "./providers";
import { SiteShell } from "./site-shell";
import { themeBootScript } from "./theme";
import { VisitTracker } from "./visit-counter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    metadataBase: new URL("https://music.xunxian.wiki"),
    title: {
      default: t.siteName,
      template: `%s | ${t.siteName}`,
    },
    description: t.meta.description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: t.meta.ogLocale,
      siteName: t.siteName,
      title: t.siteName,
      description: t.meta.description,
      url: "/",
      images: [{ url: "/og-archive.png", width: 1200, height: 630, alt: t.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.siteName,
      description: t.meta.description,
      images: ["/og-archive.png"],
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={htmlLang(locale)} suppressHydrationWarning><head><link rel="icon" href="/icons/logo.png" type="image/png" sizes="64x64" /><link rel="apple-touch-icon" href="/icons/logo.png" /><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head><body><LocaleProvider initialLocale={locale}><VisitTracker /><PlayerProvider><SiteShell>{children}</SiteShell></PlayerProvider></LocaleProvider></body></html>;
}
