import type { Metadata } from "next";
import { getMessages } from "../locale-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.nav.music,
    description: t.meta.musicDescription,
    alternates: { canonical: "/music" },
    openGraph: {
      title: `${t.nav.music} | ${t.siteName}`,
      description: t.meta.musicDescription,
      url: "/music",
      images: [{ url: "/og-archive.png", width: 1200, height: 630, alt: t.siteName }],
    },
  };
}

export default function MusicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
