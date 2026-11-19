"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties } from "react";
import { ListMusic, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { AboutDialog } from "./about-dialog";
import { LanguagePicker, useLocale } from "./locale-provider";
import { usePlayer } from "./providers";
import { ThemePicker } from "./theme-picker";
import { formatTime } from "./types";
import { DailyVisitStatus } from "./visit-counter";

const links = [
  { href: "/", key: "overview", icon: "overview" },
  { href: "/music", key: "music", icon: "music" },
  { href: "/sounds", key: "sounds", icon: "sounds" },
] as const;

/** Per-theme icon variants; globals.css picks one from the root theme attributes, so there is no flash on load. */
function railIconStyle(icon: string) {
  return {
    "--icon": `url(/icons/nav-${icon}.png)`,
    "--icon-orange": `url(/icons/nav-${icon}-orange.png)`,
    "--icon-dark": `url(/icons/nav-${icon}-dark.png)`,
  } as CSSProperties;
}

function GlobalPlayer() {
  const player = usePlayer();
  const { t } = useLocale();
  if (!player.current) return null;
  const modeIcon = player.mode === "shuffle" ? <Shuffle size={16} /> : player.mode === "repeat" ? <Repeat2 size={16} /> : <ListMusic size={16} />;
  const progressStyle = { "--range-progress": `${player.duration ? Math.min(100, (player.currentTime / player.duration) * 100) : 0}%` } as CSSProperties;
  const volumeStyle = { "--range-progress": `${player.volume * 100}%` } as CSSProperties;
  return (
    <section className="global-player" aria-label={t.player.label}>
      <div className="player-track">
        <div className="album-index" aria-hidden="true">BGM</div>
        <div className="track-meta"><strong>{player.current.originalName}</strong></div>
      </div>
      <div className="player-center">
        <div className="player-buttons">
          <button className="icon-button" onClick={player.cycleMode} title={t.player.modeTitle(t.player.mode[player.mode])} aria-label={t.player.modeTitle(t.player.mode[player.mode])}>{modeIcon}</button>
          <button className="icon-button" onClick={player.previous} aria-label={t.player.previous}><SkipBack size={18} /></button>
          <button className="play-main" onClick={player.toggle} aria-label={player.loading ? t.player.loading : player.playing ? t.player.pause : t.player.play} aria-busy={player.loading}>{player.loading ? <span className="audio-spinner" /> : player.playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
          <button className="icon-button" onClick={player.next} aria-label={t.player.next}><SkipForward size={18} /></button>
        </div>
        <div className="progress-row">
          <span>{formatTime(player.currentTime * 1000)}</span>
          <input aria-label={t.player.progress} type="range" min="0" max={player.duration || 1} step="0.1" value={Math.min(player.currentTime, player.duration || 1)} style={progressStyle} onChange={(event) => player.seek(Number(event.target.value))} />
          <span>{formatTime(player.duration * 1000)}</span>
        </div>
      </div>
      <div className="volume-control"><Volume2 size={17} /><input aria-label={t.player.volume} type="range" min="0" max="1" step="0.05" value={player.volume} style={volumeStyle} onChange={(event) => player.setVolume(Number(event.target.value))} /></div>
      {player.error && <div className="player-error">{t.player.errors[player.error]}</div>}
    </section>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasPlayer = Boolean(usePlayer().current);
  const { locale, t } = useLocale();
  // The server sets the first title; after a language switch, keep the tab title in the same language.
  const firstLocale = useRef(locale);
  useEffect(() => {
    if (locale === firstLocale.current) return;
    firstLocale.current = locale;
    const page = links.find((link) => link.href === pathname && link.href !== "/");
    document.title = page ? `${t.nav[page.key]} | ${t.siteName}` : t.siteName;
  }, [locale, pathname, t]);
  return (
    <div className={`app-shell${hasPlayer ? " has-player" : ""}`}>
      <a className="skip-link" href="#archive-main">{t.shell.skip}</a>
      <header className="brand-bar">
        <Link href="/" className="brand" aria-label={t.shell.home}>
          <Image className="brand-mark" src="/icons/logo.png" alt="" width={38} height={38} unoptimized />
          <strong className="brand-name">{t.siteName}</strong>
        </Link>
        <div className="header-status">
          <span className="status-pill"><span className="dot" aria-hidden="true" /><DailyVisitStatus /></span>
        </div>
      </header>
      <div className="workspace">
        <aside className="rail">
          <nav className="rail-nav" aria-label={t.nav.label}>
            {links.map(({ href, key, icon }) => {
              const active = pathname === href;
              return <Link key={href} href={href} className={`rail-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><span className="rail-icon" style={railIconStyle(icon)} aria-hidden="true" /><span className="rail-label">{t.nav[key]}</span></Link>;
            })}
          </nav>
          <div className="rail-footer">
            <AboutDialog />
            <div className="rail-tools">
              <LanguagePicker />
              <ThemePicker />
            </div>
          </div>
        </aside>
        <main id="archive-main" className="main-content">{children}</main>
      </div>
      <GlobalPlayer />
    </div>
  );
}
