import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DailyVisitStatus } from "./visit-counter";

const categories = [
  ["RULES", "正则分类", "按文件名规则建立自己的分类"],
  ["SEARCH", "即时检索", "搜索全部 6,266 条游戏音效"],
  ["PREVIEW", "原声试听", "在线试听 Opus 与 MP3 音频"],
  ["LOCAL", "规则留存", "分类规则保存在当前浏览器"],
];

export default function Home() {
  return (
    <div className="page home-page">
      <header className="topbar"><div><span className="eyebrow">XUNXIAN AUDIO ARCHIVE</span><h1>总览</h1></div><DailyVisitStatus /></header>
      <section className="overview-hero">
        <div className="overview-copy">
          <span className="overview-kicker">寻仙世界 · 声音编目</span>
          <h2>让每一段声音，<br />都能被重新听见。</h2>
          <p>从城镇的晨钟到战斗中的一声剑鸣，这里收录了寻仙世界的背景音乐与游戏音效。</p>
          <div className="hero-actions"><Link className="primary-button" href="/music">浏览仙乐集 <ArrowRight size={16} /></Link><Link className="text-button" href="/sounds">检索万籁库 <ArrowRight size={16} /></Link></div>
        </div>
        <aside className="archive-ledger" aria-label="资料库索引摘要">
          <span className="ledger-id">ARCHIVE / XA–01</span>
          <dl>
            <div><dt>馆藏对象</dt><dd>背景音乐 · 游戏音效</dd></div>
            <div><dt>主要能力</dt><dd>检索 · 分类 · 试听</dd></div>
            <div><dt>数据规模</dt><dd><strong>6,414</strong> 条记录</dd></div>
          </dl>
        </aside>
      </section>
      <section className="stat-grid">
        <article><span>全部音频</span><strong>6,414</strong><small>OGG / WAV · 586.5 MiB</small></article>
        <article><span>背景音乐</span><strong>148</strong><small>OGG · 4.46 小时</small></article>
        <article><span>游戏音效</span><strong>6,266</strong><small>OGG / WAV · 4.86 小时</small></article>
        <article><span>总时长</span><strong>9.32</strong><small>小时 · BGM 4.46 + 音效 4.86</small></article>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">CUSTOM ORGANIZATION</span><h2>自定义整理</h2></div><Link href="/sounds">打开万籁库 <ArrowRight size={16} /></Link></div>
        <div className="category-grid">{categories.map(([label, title, copy]) => <Link href="/sounds" key={title} className="category-card"><span className="feature-label">{label}</span><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={18} /></Link>)}</div>
      </section>
    </div>
  );
}
