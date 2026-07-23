"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Check, ChevronDown, ChevronRight, CircleAlert, Download, Pause, Pencil, Play, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { usePlayer } from "../providers";
import { formatTime, normalizeSearch, type Track } from "../types";

const PAGE_SIZE = 30;
const RULES_KEY = "xunxian-music-category-rules-v1";

type MusicRule = { id: string; name: string; pattern: string; flags?: string };
type ClassifiedTrack = Track & { matchedCategories: string[] };

function parseRegexInput(input: string) {
  const value = input.trim();
  if (value.startsWith("/")) {
    const lastSlash = value.lastIndexOf("/");
    if (lastSlash > 0) {
      const flags = value.slice(lastSlash + 1);
      if (/^[dgimsuvy]*$/.test(flags)) return { pattern: value.slice(1, lastSlash), flags };
    }
  }
  return { pattern: value, flags: "i" };
}

function displayRegex(rule: MusicRule) {
  return `/${rule.pattern}/${rule.flags ?? "i"}`;
}

function parseRulesPayload(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("文件内容不是有效对象");
  const payload = value as { format?: unknown; version?: unknown; rules?: unknown };
  if (payload.format !== "xunxian-music-category-rules" || payload.version !== 1 || !Array.isArray(payload.rules)) throw new Error("文件格式或版本不受支持");
  return payload.rules.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`第 ${index + 1} 条规则格式无效`);
    const item = value as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const pattern = typeof item.pattern === "string" ? item.pattern : "";
    const flags = typeof item.flags === "string" ? item.flags : "i";
    if (!name || !pattern) throw new Error(`第 ${index + 1} 条规则缺少名称或正则`);
    try { new RegExp(pattern, flags); } catch { throw new Error(`第 ${index + 1} 条规则的正则无效`); }
    return { id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(), name, pattern, flags } satisfies MusicRule;
  });
}

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [rules, setRules] = useState<MusicRule[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulePanelOpen, setRulePanelOpen] = useState(false);
  const [ruleListOpen, setRuleListOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const player = usePlayer();

  useEffect(() => {
    fetch("/data/music.v1.json").then((res) => res.json()).then(setTracks);
    try {
      const saved = localStorage.getItem(RULES_KEY);
      if (saved !== null) {
        queueMicrotask(() => setRules(JSON.parse(saved) as MusicRule[]));
      } else {
        fetch("/data/default-music-category-rules.v1.json")
          .then((response) => {
            if (!response.ok) throw new Error("默认音乐规则文件不存在");
            return response.json();
          })
          .then((payload) => {
            const initialRules = parseRulesPayload(payload);
            setRules(initialRules);
            localStorage.setItem(RULES_KEY, JSON.stringify(initialRules));
          })
          .catch((cause) => setRuleError(cause instanceof Error ? `默认规则载入失败：${cause.message}` : "默认规则载入失败"));
      }
    } catch { localStorage.removeItem(RULES_KEY); }
  }, []);

  const compiledRules = useMemo(() => rules.map((rule) => {
    try { return { ...rule, regex: new RegExp(rule.pattern, (rule.flags ?? "i").replace(/[gy]/g, "")) }; }
    catch { return null; }
  }).filter((rule): rule is MusicRule & { regex: RegExp } => rule !== null), [rules]);

  const classified = useMemo<ClassifiedTrack[]>(() => tracks.map((track) => ({
    ...track,
    matchedCategories: [...new Set(compiledRules.filter((rule) => rule.regex.test(track.originalName)).map((rule) => rule.name))],
  })), [tracks, compiledRules]);

  const categoryCounts = useMemo(() => classified.reduce<Record<string, number>>((counts, track) => {
    if (!track.matchedCategories.length) counts["未分类"] = (counts["未分类"] ?? 0) + 1;
    for (const tag of track.matchedCategories) counts[tag] = (counts[tag] ?? 0) + 1;
    return counts;
  }, {}), [classified]);
  const tagNames = useMemo(() => [...new Set(rules.map((rule) => rule.name))].sort((left, right) => (categoryCounts[right] ?? 0) - (categoryCounts[left] ?? 0) || left.localeCompare(right, "zh-CN")), [rules, categoryCounts]);
  const visibleTagNames = showAllCategories ? tagNames : tagNames.slice(0, 8);
  const hiddenTagCount = Math.max(0, tagNames.length - 8);
  const filtered = useMemo(() => {
    const term = normalizeSearch(query);
    return classified.filter((track) => {
      const matchesCategory = category === "all" || (category === "未分类" ? !track.matchedCategories.length : track.matchedCategories.includes(category));
      return matchesCategory && (!term || normalizeSearch(`${track.title} ${track.originalName} ${track.matchedCategories.join(" ")}`).includes(term));
    });
  }, [classified, query, category]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function saveRules(nextRules: MusicRule[]) {
    setRules(nextRules);
    localStorage.setItem(RULES_KEY, JSON.stringify(nextRules));
    if (category !== "all" && category !== "未分类" && !nextRules.some((rule) => rule.name === category)) setCategory("all");
    setPage(1);
  }

  function submitRule(event: React.FormEvent) {
    event.preventDefault();
    const name = ruleName.trim();
    const input = rulePattern.trim();
    if (!name || !input) { setRuleError("请填写标签名称和正则表达式"); return; }
    const { pattern, flags } = parseRegexInput(input);
    try { new RegExp(pattern, flags); } catch (cause) { setRuleError(cause instanceof Error ? `正则无效：${cause.message}` : "正则表达式无效"); return; }
    saveRules(editingRuleId ? rules.map((rule) => rule.id === editingRuleId ? { ...rule, name, pattern, flags } : rule) : [...rules, { id: crypto.randomUUID(), name, pattern, flags }]);
    setRuleName(""); setRulePattern(""); setRuleError(null); setEditingRuleId(null);
  }

  function editRule(rule: MusicRule) {
    setEditingRuleId(rule.id); setRuleName(rule.name); setRulePattern(displayRegex(rule)); setRuleError(null);
  }

  function cancelEdit() {
    setEditingRuleId(null); setRuleName(""); setRulePattern(""); setRuleError(null);
  }

  function exportRules() {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
    const payload = { format: "xunxian-music-category-rules", version: 1, exportedAt: now.toISOString(), rules: rules.map(({ id, name, pattern, flags }) => ({ id, name, pattern, flags: flags ?? "i" })) };
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `xunxian_music_category_rules_${stamp}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  async function importRules(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setRuleError(null); setImportMessage(null);
    try {
      const imported = parseRulesPayload(JSON.parse(await file.text()));
      const merged = [...rules]; let added = 0; let updated = 0;
      for (const rule of imported) { const index = merged.findIndex((item) => item.id === rule.id); if (index >= 0) { merged[index] = rule; updated += 1; } else { merged.push(rule); added += 1; } }
      saveRules(merged); setRuleListOpen(false); setImportMessage(`导入完成：新增 ${added} 条，更新 ${updated} 条`);
    } catch (cause) { setRuleError(cause instanceof Error ? `导入失败：${cause.message}` : "导入失败：无法读取文件"); }
  }

  const choose = (track: Track) => player.current?.id === track.id ? player.toggle() : void player.play(track, filtered);

  return (
    <div className="page library-page music-page">
      <header className="topbar"><div><span className="eyebrow">MUSIC COLLECTION</span><h1>仙乐集</h1></div><span className="record-count">{tracks.length} 首曲目</span></header>
      <section className="library-intro">
        <div><span className="intro-kicker">寻仙世界背景音乐馆藏</span><h2>山川有声，昼夜成曲</h2><p>收录城镇、野外、副本与节庆场景音乐，让每一段悠长旋律都能按情境重新被唤起。</p></div>
        <div className="collection-index" aria-label="馆藏编号 01"><span>COLLECTION</span><strong>01</strong></div>
      </section>

      <section className="regex-panel">
        <div className="regex-panel-heading"><button className="regex-panel-toggle" type="button" onClick={() => setRulePanelOpen((value) => !value)} aria-expanded={rulePanelOpen}>{rulePanelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<Braces size={18} /><span><strong>正则分类规则</strong><small>使用正则匹配音乐原文件名</small></span></button></div>
        {rulePanelOpen && <div className="regex-panel-body">
          <form className="rule-form" onSubmit={submitRule}><label><span>标签名称</span><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="例如：城镇音乐" /></label><label className="pattern-field"><span>文件名正则</span><div><input value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} placeholder="^world_ 或 /.*night.*$/i" /></div></label><div className="rule-form-actions"><button className="add-rule-button" type="submit">{editingRuleId ? <Save size={16} /> : <Plus size={16} />}{editingRuleId ? "保存修改" : "添加规则"}</button>{editingRuleId && <button className="cancel-edit-button" type="button" onClick={cancelEdit}><X size={15} />取消</button>}</div></form>
          {ruleError && <p className="rule-error"><CircleAlert size={14} />{ruleError}</p>}{importMessage && <p className="import-success"><Check size={14} />{importMessage}</p>}
          <div className="rule-hint">可输入正则内容，默认忽略大小写；完整的 <code>/.*night.*$/i</code> 形式也可直接使用。</div>
          <div className="rule-list-heading"><button className="rule-list-toggle" type="button" onClick={() => setRuleListOpen((value) => !value)} aria-expanded={ruleListOpen}>{ruleListOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}当前规则 <span>{rules.length}</span></button><div className="rule-file-actions"><button type="button" onClick={() => importInputRef.current?.click()}><Upload size={14} />导入 JSON</button><button type="button" onClick={exportRules} disabled={!rules.length}><Download size={14} />导出 JSON</button><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importRules(event)} /></div></div>
          {ruleListOpen && rules.length > 0 && <div className="rule-list">{rules.map((rule, index) => <div className={`rule-item ${editingRuleId === rule.id ? "editing" : ""}`} key={rule.id}><span className="rule-order">{index + 1}</span><strong>{rule.name}</strong><code>{displayRegex(rule)}</code><span>{categoryCounts[rule.name] ?? 0} 首</span><button onClick={() => editRule(rule)} aria-label={`编辑 ${rule.name} 规则`}><Pencil size={14} /></button><button onClick={() => { saveRules(rules.filter((item) => item.id !== rule.id)); if (editingRuleId === rule.id) cancelEdit(); }} aria-label={`删除 ${rule.name} 规则`}><Trash2 size={15} /></button></div>)}</div>}
        </div>}
      </section>

      <div className="toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索曲名、文件名或标签…" /><kbd>⌘ K</kbd></label></div>
      <div className="filter-chips"><button className={category === "all" ? "active" : ""} onClick={() => { setCategory("all"); setPage(1); }}>全部 <span>{classified.length}</span></button>{visibleTagNames.map((tag) => <button key={tag} className={category === tag ? "active" : ""} onClick={() => { setCategory(tag); setPage(1); }}>{tag} <span>{categoryCounts[tag] ?? 0}</span></button>)}<button className={category === "未分类" ? "active" : ""} onClick={() => { setCategory("未分类"); setPage(1); }}>未分类 <span>{categoryCounts["未分类"] ?? 0}</span></button>{hiddenTagCount > 0 && <button className={`chip-toggle ${showAllCategories ? "expanded" : ""}`} type="button" onClick={() => setShowAllCategories((value) => !value)} aria-expanded={showAllCategories}><ChevronDown size={13} />{showAllCategories ? "收起标签" : `展开 ${hiddenTagCount} 个`}</button>}</div>
      <section className="track-table" aria-label="背景音乐列表">
        <div className="track-row track-head"><span>#</span><span>曲目</span><span>标签</span><span>时长</span><span /></div>
        {visible.map((track, index) => {
          const active = player.current?.id === track.id;
          return <div className={`track-row ${active ? "playing" : ""}`} key={track.id}><button className="music-index" onClick={() => choose(track)}>{active && player.loading ? <span className="audio-spinner" /> : active ? <i className="playing-bars"><b /><b /><b /></i> : String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</button><button className="track-name" onClick={() => choose(track)}><strong>{track.title}</strong><small>{track.originalName}</small></button><span className="music-tags">{track.matchedCategories.slice(0, 4).map((tag) => <button className="category-tag matched" key={tag} onClick={() => { setCategory(tag); setPage(1); }}>{tag}</button>)}{!track.matchedCategories.length && <button className="category-tag" onClick={() => { setCategory("未分类"); setPage(1); }}>未分类</button>}{track.matchedCategories.length > 4 && <span className="more-tags">+{track.matchedCategories.length - 4}</span>}</span><span>{formatTime(track.durationMs)}</span><button className="row-play" onClick={() => choose(track)} aria-label={active && player.loading ? "正在载入" : active && player.playing ? "暂停" : "播放"} aria-busy={active && player.loading}>{active && player.loading ? <span className="audio-spinner" /> : active && player.playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button></div>;
        })}
      </section>
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {pages} 页</span><button disabled={page === pages} onClick={() => setPage(page + 1)}>下一页</button></div>
    </div>
  );
}
