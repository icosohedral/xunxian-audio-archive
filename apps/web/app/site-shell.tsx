"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { Archive, Database, Info, LayoutDashboard, Library, ListMusic, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { usePlayer } from "./providers";
import { formatTime } from "./types";

const links = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/music", label: "仙乐集", icon: Library },
  { href: "/sounds", label: "万籁库", icon: Database },
  { href: "/about", label: "关于", icon: Info },
];

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
        <div className="track-meta"><strong>{player.current.title}</strong><span>{player.current.originalName}</span></div>
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="寻仙音乐资料库首页">
          <span className="brand-mark"><span>寻</span></span>
          <span><strong>寻仙音乐资料库</strong><small>XUNXIAN AUDIO ARCHIVE</small></span>
        </Link>
        <nav aria-label="主导航">
          {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={18} /><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-foot"><Archive size={14} /><span>资料库版本</span><strong>v1.0.1</strong></div>
      </aside>
      <main className="main-content">{children}</main>
      <GlobalPlayer />
    </div>
  );
}
