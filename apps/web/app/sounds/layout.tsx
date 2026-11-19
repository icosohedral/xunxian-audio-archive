import type { Metadata } from "next";
import { getMessages } from "../locale-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.nav.sounds,
    description: t.meta.soundsDescription,
    alternates: { canonical: "/sounds" },
    openGraph: {
      title: `${t.nav.sounds} | ${t.siteName}`,
      description: t.meta.soundsDescription,
      url: "/sounds",
      images: [{ url: "/og-archive.png", width: 1200, height: 630, alt: t.siteName }],
    },
  };
}

export default function SoundsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
