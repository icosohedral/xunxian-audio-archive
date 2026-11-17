import Image from "next/image";
import { AudioLines, Disc3, Music2 } from "lucide-react";
import { catalog, formatCount, formatHours, formatMiB } from "./catalog";

const { counts, durationMs, bytes } = catalog;

const stats = [
  { icon: Disc3, label: "全部音频", value: formatCount(counts.total), hint: `共 ${formatHours(durationMs.total)} 小时 · ${formatMiB(bytes.total)} MiB` },
  { icon: Music2, label: "背景音乐", value: formatCount(counts.music), hint: `${formatHours(durationMs.music)} 小时` },
  { icon: AudioLines, label: "游戏音效", value: formatCount(counts.sound), hint: `${formatHours(durationMs.sound)} 小时` },
];

export default function Home() {
  return (
    <div className="page home-page">
      <h1 className="visually-hidden">总览</h1>
      <section className="library-intro">
        <div>
          <h2>在中国神话与人间烟火之间寻仙</h2>
          <p>《寻仙》是由北京像素软件开发、腾讯运营的中国神话题材 3D MMORPG，以中国美术片风格构筑了一个有神仙妖怪、法宝灵兽，也有城镇村落与市井人情的东方世界。音乐与音效记录了其中的昼夜、地域、职业与剧情变化，本资料库希望让这些散落的声音重新变得可检索、可聆听。</p>
        </div>
        <Image className="library-intro-art" src="/images/intro-sea.webp" alt="" width={676} height={520} priority unoptimized />
      </section>
      <section className="stat-grid">
        {stats.map(({ icon: Icon, label, value, hint }) => <article key={label}><span><Icon size={14} aria-hidden="true" />{label}</span><strong>{value}</strong><small>{hint}</small></article>)}
      </section>
    </div>
  );
}
