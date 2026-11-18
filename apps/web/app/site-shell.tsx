"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { ListMusic, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { AboutDialog } from "./about-dialog";
import { usePlayer } from "./providers";
import { ThemePicker } from "./theme-picker";
import { formatTime } from "./types";
import { DailyVisitStatus } from "./visit-counter";

const links = [
  { href: "/", label: "总览", icon: "overview" },
  { href: "/music", label: "仙乐集", icon: "music" },
  { href: "/sounds", label: "万籁库", icon: "sounds" },
];

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
  if (!player.current) return null;
  const modeIcon = player.mode === "shuffle" ? <Shuffle size={16} /> : player.mode === "repeat" ? <Repeat2 size={16} /> : <ListMusic size={16} />;
  const progressStyle = { "--range-progress": `${player.duration ? Math.min(100, (player.currentTime / player.duration) * 100) : 0}%` } as CSSProperties;
  const volumeStyle = { "--range-progress": `${player.volume * 100}%` } as CSSProperties;
  return (
    <section className="global-player" aria-label="全局音乐播放器">
      <div className="player-track">
        <div className="album-index" aria-hidden="true">BGM</div>
        <div className="track-meta"><strong>{player.current.originalName}</strong></div>
      </div>
      <div className="player-center">
        <div className="player-buttons">
          <button className="icon-button" onClick={player.cycleMode} title={`播放模式：${player.mode}`}>{modeIcon}</button>
          <button className="icon-button" onClick={player.previous} aria-label="上一首"><SkipBack size={18} /></button>
          <button className="play-main" onClick={player.toggle} aria-label={player.loading ? "正在载入" : player.playing ? "暂停" : "播放"} aria-busy={player.loading}>{player.loading ? <span className="audio-spinner" /> : player.playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
          <button className="icon-button" onClick={player.next} aria-label="下一首"><SkipForward size={18} /></button>
        </div>
        <div className="progress-row">
          <span>{formatTime(player.currentTime * 1000)}</span>
          <input aria-label="播放进度" type="range" min="0" max={player.duration || 1} step="0.1" value={Math.min(player.currentTime, player.duration || 1)} style={progressStyle} onChange={(event) => player.seek(Number(event.target.value))} />
          <span>{formatTime(player.duration * 1000)}</span>
        </div>
      </div>
      <div className="volume-control"><Volume2 size={17} /><input aria-label="音量" type="range" min="0" max="1" step="0.05" value={player.volume} style={volumeStyle} onChange={(event) => player.setVolume(Number(event.target.value))} /></div>
      {player.error && <div className="player-error">{player.error}</div>}
    </section>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasPlayer = Boolean(usePlayer().current);
  return (
    <div className={`app-shell${hasPlayer ? " has-player" : ""}`}>
      <a className="skip-link" href="#archive-main">跳到资料正文</a>
      <header className="brand-bar">
        <Link href="/" className="brand" aria-label="寻仙音乐资料库首页">
          <Image className="brand-mark" src="/icons/logo.png" alt="" width={38} height={38} unoptimized />
          <strong className="brand-name">寻仙音乐资料库</strong>
        </Link>
        <div className="header-status">
          <span className="status-pill"><span className="dot" aria-hidden="true" /><DailyVisitStatus /></span>
        </div>
      </header>
      <div className="workspace">
        <aside className="rail">
          <nav className="rail-nav" aria-label="资料库主导航">
            {links.map(({ href, label, icon }) => {
              const active = pathname === href;
              return <Link key={href} href={href} className={`rail-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><span className="rail-icon" style={railIconStyle(icon)} aria-hidden="true" /><span className="rail-label">{label}</span></Link>;
            })}
          </nav>
          <div className="rail-footer">
            <AboutDialog />
            <ThemePicker />
          </div>
        </aside>
        <main id="archive-main" className="main-content">{children}</main>
      </div>
      <GlobalPlayer />
    </div>
  );
}
