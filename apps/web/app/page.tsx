"use client";

import Image from "next/image";
import { AudioLines, Disc3, Music2 } from "lucide-react";
import { catalog, formatCount, formatHours, formatMiB } from "./catalog";
import { useLocale } from "./locale-provider";

const { counts, durationMs, bytes } = catalog;

export default function Home() {
  const { t } = useLocale();
  const stats = [
    { icon: Disc3, label: t.home.all, value: formatCount(counts.total), hint: t.home.totalHint(formatHours(durationMs.total), formatMiB(bytes.total)) },
    { icon: Music2, label: t.home.music, value: formatCount(counts.music), hint: t.home.hours(formatHours(durationMs.music)) },
    { icon: AudioLines, label: t.home.sounds, value: formatCount(counts.sound), hint: t.home.hours(formatHours(durationMs.sound)) },
  ];
  return (
    <div className="page home-page">
      <h1 className="visually-hidden">{t.nav.overview}</h1>
      <section className="library-intro">
        <div>
          <h2>{t.home.intro}</h2>
          <p>{t.home.body}</p>
        </div>
        <Image className="library-intro-art" src="/images/intro-sea.webp" alt="" width={676} height={520} priority unoptimized />
        {/* 深色主题换夜晚版（27KB）；直接加载，避免切到深色时空白一下 */}
        <Image className="library-intro-art library-intro-art-night" src="/images/intro-sea-night.webp" alt="" width={676} height={520} loading="eager" unoptimized />
      </section>
      <section className="stat-grid">
        {stats.map(({ icon: Icon, label, value, hint }) => <article key={label}><span><Icon size={14} aria-hidden="true" />{label}</span><strong>{value}</strong><small>{hint}</small></article>)}
      </section>
    </div>
  );
}
