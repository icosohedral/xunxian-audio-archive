import { ExternalLink, Github, PackageOpen } from "lucide-react";

const topics = [
  ["WORLD", "东方神话世界", "玩家从凡人出发，游历山川城镇，迎战妖怪、结识仙友，在熟悉的中国神话意象中展开自己的寻仙旅程。"],
  ["ART", "中国美术片风格", "人物、建筑和场景采用独特的中国风造型语言，让诙谐、质朴与瑰丽共同组成寻仙世界的视觉气质。"],
  ["STORY", "人间故事", "宏大的神话并没有离开日常生活：乡野传说、市井人物和带有人情味的任务，共同构成这个世界的底色。"],
  ["AUDIO", "声音中的寻仙", "音乐与音效记录了昼夜、地域、职业和剧情的变化。本资料库希望让这些散落的声音重新变得可检索、可聆听。"],
];

export default function AboutPage() {
  return (
    <div className="page about-page">
      <header className="topbar"><div><span className="eyebrow">ABOUT THE ARCHIVE</span><h1>关于</h1></div></header>
      <section className="library-intro about-library-intro">
        <div><span className="intro-kicker">关于寻仙与这座声音资料库</span><h2>在中国神话与人间烟火之间寻仙</h2><p>《寻仙》是由北京像素软件开发、腾讯运营的中国神话题材 3D MMORPG。它以鲜明的中国美术片风格，构筑了一个既有神仙妖怪、法宝灵兽，也有城镇村落与市井人情的东方奇幻世界。</p></div>
      </section>
      <section className="about-grid">
        {topics.map(([label, title, copy]) => <article key={label}><span className="feature-label">{label}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </section>
      <section className="data-notes">
        <div className="data-notes-heading"><span className="eyebrow">CATALOG SCOPE</span><h2>资料库收录</h2></div>
        <dl><div><dt>背景音乐</dt><dd>148 个 OGG · 4.460 小时</dd></div><div><dt>游戏音效</dt><dd>4,706 个 OGG + 1,560 个 WAV</dd></div><div><dt>完整音频</dt><dd>586.50 MiB · 9.324 小时</dd></div><div><dt>说明</dt><dd>本站为资料整理与试听项目，游戏及相关权利归原权利人所有。</dd></div></dl>
      </section>
      <section className="credits-card">
        <div className="credits-heading"><span className="eyebrow">PROJECT CREDITS</span><h2>项目人员与致谢</h2></div>
        <div className="credits-grid">
          <article><span className="credit-mark author"><Github size={20} /></span><div><span className="eyebrow">CREATED &amp; MAINTAINED BY</span><h3>icosohedral</h3><p>寻仙音乐资料库的整理、规则维护与网站开发。</p><a href="https://github.com/icosohedral" target="_blank" rel="noreferrer">GitHub @icosohedral <ExternalLink size={14} /></a></div></article>
          <article><span className="credit-mark thanks"><PackageOpen size={20} /></span><div><span className="eyebrow">SPECIAL THANKS</span><h3>贴吧用户「耳目清净」</h3><p>感谢其开发的寻仙游戏资源解包工具，为本资料库的资源整理提供了重要支持。</p><a href="https://tieba.baidu.com/home/main?id=tb.1.18df2155.RJhYqZLwH1IZGDyVW0eKzA%3Ft%3D1784471593&amp;fr=pb" target="_blank" rel="noreferrer">访问用户主页 <ExternalLink size={14} /></a></div></article>
        </div>
      </section>
    </div>
  );
}
