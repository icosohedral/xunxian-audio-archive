"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Check, ChevronDown, ChevronRight, CircleAlert, Copy, Download, Pause, Pencil, Play, Plus, RotateCcw, Save, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { formatTime, normalizeSearch, resolveAudioUrl, selectPlayableAudioKey, type Track } from "../types";

const PAGE_SIZE = 100;
const RULES_KEY = "xunxian-sound-category-rules-v1";
const DURATION_FILTER_KEY = "xunxian-sound-duration-filter-v1";

type CategoryRule = { id: string; name: string; pattern: string; flags?: string };
type ClassifiedTrack = Track & { matchedCategories: string[]; matchedRuleIds: string[] };

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

function displayRegex(rule: CategoryRule) {
  return `/${rule.pattern}/${rule.flags ?? "i"}`;
}

function parseRulesPayload(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("文件内容不是有效对象");
  const payload = value as { format?: unknown; version?: unknown; rules?: unknown };
  if (payload.format !== "xunxian-sound-category-rules" || payload.version !== 1 || !Array.isArray(payload.rules)) {
    throw new Error("文件格式或版本不受支持");
  }
  return payload.rules.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`第 ${index + 1} 条规则格式无效`);
    const item = value as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const pattern = typeof item.pattern === "string" ? item.pattern : "";
    const flags = typeof item.flags === "string" ? item.flags : "i";
    if (!name || !pattern) throw new Error(`第 ${index + 1} 条规则缺少名称或正则`);
    try { new RegExp(pattern, flags); }
    catch { throw new Error(`第 ${index + 1} 条规则的正则无效`); }
    return {
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      name,
      pattern,
      flags,
    } satisfies CategoryRule;
  });
}

export default function SoundsPage() {
  const [sounds, setSounds] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulePanelOpen, setRulePanelOpen] = useState(false);
  const [ruleListOpen, setRuleListOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [hideShortDuration, setHideShortDuration] = useState(false);
  const [durationThreshold, setDurationThreshold] = useState("1");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const filterMenuRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    fetch("/data/sound.v1.json").then((res) => res.json()).then(setSounds);
    try {
      const saved = localStorage.getItem(RULES_KEY);
      if (saved !== null) {
        queueMicrotask(() => setRules(JSON.parse(saved) as CategoryRule[]));
      } else {
        fetch("/data/default-category-rules.v1.json")
          .then((response) => {
            if (!response.ok) throw new Error("默认规则文件不存在");
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
    try {
      const savedFilter = localStorage.getItem(DURATION_FILTER_KEY);
      if (savedFilter) {
        const parsed = JSON.parse(savedFilter) as { enabled?: unknown; seconds?: unknown };
        const seconds = typeof parsed.seconds === "number" && Number.isInteger(parsed.seconds) && parsed.seconds >= 1 ? String(parsed.seconds) : "1";
        queueMicrotask(() => {
          setHideShortDuration(parsed.enabled === true);
          setDurationThreshold(seconds);
        });
      }
    } catch { localStorage.removeItem(DURATION_FILTER_KEY); }
    const audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("ended", () => setPlaying(false));
    audioRef.current = audio;
    return () => audio.pause();
  }, []);

  useEffect(() => {
    function closeFilterMenu(event: PointerEvent) {
      const menu = filterMenuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.removeAttribute("open");
    }
    document.addEventListener("pointerdown", closeFilterMenu);
    return () => document.removeEventListener("pointerdown", closeFilterMenu);
  }, []);

  const compiledRules = useMemo(() => rules.map((rule) => {
    try { return { ...rule, regex: new RegExp(rule.pattern, (rule.flags ?? "i").replace(/[gy]/g, "")) }; }
    catch { return null; }
  }).filter((rule): rule is CategoryRule & { regex: RegExp } => rule !== null), [rules]);

  const classified = useMemo<ClassifiedTrack[]>(() => sounds.map((sound) => {
    const matches = compiledRules.filter((rule) => rule.regex.test(sound.originalName));
    return {
      ...sound,
      matchedCategories: [...new Set(matches.map((rule) => rule.name))],
      matchedRuleIds: matches.map((rule) => rule.id),
    };
  }), [sounds, compiledRules]);

  const durationFiltered = useMemo(() => {
    if (!hideShortDuration) return classified;
    const thresholdMilliseconds = Math.max(1, Number(durationThreshold) || 1) * 1000;
    return classified.filter((sound) => sound.durationMs >= thresholdMilliseconds);
  }, [classified, hideShortDuration, durationThreshold]);

  const categoryCounts = useMemo(() => durationFiltered.reduce<Record<string, number>>((counts, sound) => {
    if (!sound.matchedCategories.length) counts["未分类"] = (counts["未分类"] ?? 0) + 1;
    for (const tag of sound.matchedCategories) counts[tag] = (counts[tag] ?? 0) + 1;
    return counts;
  }, {}), [durationFiltered]);
  const tagNames = useMemo(() => [...new Set(rules.map((rule) => rule.name))], [rules]);
  const sortedTagNames = useMemo(() => [...tagNames].sort((left, right) => {
    const countDifference = (categoryCounts[right] ?? 0) - (categoryCounts[left] ?? 0);
    return countDifference || left.localeCompare(right, "zh-CN");
  }), [tagNames, categoryCounts]);
  const visibleTagNames = showAllCategories ? sortedTagNames : sortedTagNames.slice(0, 8);
  const hiddenTagCount = Math.max(0, sortedTagNames.length - 8);

  const filtered = useMemo(() => {
    const term = normalizeSearch(query);
    return durationFiltered.filter((sound) => {
      const matchesCategory = category === "all" || (category === "未分类" ? !sound.matchedCategories.length : sound.matchedCategories.includes(category));
      return matchesCategory && (!term || normalizeSearch(`${sound.title} ${sound.originalName} ${sound.matchedCategories.join(" ")}`).includes(term));
    });
  }, [durationFiltered, query, category]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function saveRules(nextRules: CategoryRule[]) {
    setRules(nextRules);
    localStorage.setItem(RULES_KEY, JSON.stringify(nextRules));
    if (category !== "all" && category !== "未分类" && !nextRules.some((rule) => rule.name === category)) setCategory("all");
    setPage(1);
  }

  function saveDurationFilter(enabled: boolean, seconds: string) {
    const normalizedSeconds = seconds === "" ? "" : String(Math.max(1, Math.trunc(Number(seconds) || 1)));
    setHideShortDuration(enabled);
    setDurationThreshold(normalizedSeconds);
    localStorage.setItem(DURATION_FILTER_KEY, JSON.stringify({
      enabled,
      seconds: Math.max(1, Math.trunc(Number(normalizedSeconds) || 1)),
    }));
    setPage(1);
  }

  function addRule(event: React.FormEvent) {
    event.preventDefault();
    const name = ruleName.trim();
    const input = rulePattern.trim();
    if (!name || !input) { setRuleError("请填写分类名称和正则表达式"); return; }
    const { pattern, flags } = parseRegexInput(input);
    try { new RegExp(pattern, flags); }
    catch (cause) { setRuleError(cause instanceof Error ? `正则无效：${cause.message}` : "正则表达式无效"); return; }
    if (editingRuleId) {
      saveRules(rules.map((rule) => rule.id === editingRuleId ? { ...rule, name, pattern, flags } : rule));
    } else {
      saveRules([...rules, { id: crypto.randomUUID(), name, pattern, flags }]);
    }
    setRuleName("");
    setRulePattern("");
    setRuleError(null);
    setEditingRuleId(null);
  }

  function editRule(rule: CategoryRule) {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRulePattern(displayRegex(rule));
    setRuleError(null);
  }

  function cancelEdit() {
    setEditingRuleId(null);
    setRuleName("");
    setRulePattern("");
    setRuleError(null);
  }

  function deleteRule(ruleId: string) {
    saveRules(rules.filter((item) => item.id !== ruleId));
    if (editingRuleId === ruleId) cancelEdit();
  }

  function exportRules() {
    const payload = {
      format: "xunxian-sound-category-rules",
      version: 1,
      exportedAt: new Date().toISOString(),
      rules: rules.map(({ id, name, pattern, flags }) => ({ id, name, pattern, flags: flags ?? "i" })),
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((value) => String(value).padStart(2, "0")).join("");
    link.href = url;
    link.download = `xunxian_category_rules_${date}${time}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importRules(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRuleError(null);
    setImportMessage(null);
    try {
      const imported = parseRulesPayload(JSON.parse(await file.text()));
      const merged = [...rules];
      let updated = 0;
      let added = 0;
      for (const rule of imported) {
        const index = merged.findIndex((item) => item.id === rule.id);
        if (index >= 0) { merged[index] = rule; updated += 1; }
        else { merged.push(rule); added += 1; }
      }
      saveRules(merged);
      setRuleListOpen(false);
      setImportMessage(`导入完成：新增 ${added} 条，更新 ${updated} 条`);
    } catch (cause) {
      setRuleError(cause instanceof Error ? `导入失败：${cause.message}` : "导入失败：无法读取文件");
    }
  }

  async function preview(sound: Track) {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    try {
      if (activeId === sound.id) {
        audio.currentTime = 0;
        await audio.play();
      } else {
        audio.pause();
        const key = selectPlayableAudioKey(sound.audio, (mimeType) => audio.canPlayType(mimeType));
        audio.src = await resolveAudioUrl(key);
        setActiveId(sound.id);
        await audio.play();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "无法播放音效"); }
  }

  async function copyFilename(sound: Track) {
    try {
      await navigator.clipboard.writeText(sound.originalName);
      setCopiedId(sound.id);
      window.setTimeout(() => setCopiedId((current) => current === sound.id ? null : current), 1400);
    } catch {
      setError("复制文件名失败，请检查浏览器剪贴板权限");
    }
  }

  return (
    <div className="page library-page sounds-page">
      <header className="topbar"><div><span className="eyebrow">SOUND EFFECTS LIBRARY</span><h1>万籁库</h1></div><span className="record-count">{filtered.length.toLocaleString()} 条结果</span></header>
      <section className="library-intro sound-library-intro">
        <div><span className="intro-kicker">寻仙世界游戏音效馆藏</span><h2>风起叶落，触手成音</h2><p>收录角色、技能、环境与界面音效，让每一段短促声响都能按出处重新被找到。</p></div>
        <div className="collection-index" aria-label="馆藏编号 02"><span>COLLECTION</span><strong>02</strong></div>
      </section>

      <section className="regex-panel">
        <div className="regex-panel-heading"><button className="regex-panel-toggle" type="button" onClick={() => setRulePanelOpen((value) => !value)} aria-expanded={rulePanelOpen}>{rulePanelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<Braces size={18} /><span><strong>正则分类规则</strong></span></button></div>
        {rulePanelOpen && <div className="regex-panel-body">
          <form className="rule-form" onSubmit={addRule}>
            <label><span>分类名称</span><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="例如：角色语音" /></label>
            <label className="pattern-field"><span>文件名正则</span><div><input value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} placeholder="^boss 或 /.*qimen.*$/i" /></div></label>
            <div className="rule-form-actions"><button className="add-rule-button" type="submit">{editingRuleId ? <Save size={16} /> : <Plus size={16} />}{editingRuleId ? "保存修改" : "添加规则"}</button>{editingRuleId && <button className="cancel-edit-button" type="button" onClick={cancelEdit}><X size={15} />取消</button>}</div>
          </form>
          {ruleError && <p className="rule-error"><CircleAlert size={14} />{ruleError}</p>}
          {importMessage && <p className="import-success"><Check size={14} />{importMessage}</p>}
          <div className="rule-hint">可输入正则内容，例如 <code>^boss</code>（默认添加 i），也可输入完整形式 <code>/.*qimen.*$/i</code>，完整形式不会被重复包裹。</div>
          <div className="rule-list-heading"><button className="rule-list-toggle" type="button" onClick={() => setRuleListOpen((value) => !value)} aria-expanded={ruleListOpen}>{ruleListOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}当前规则 <span>{rules.length}</span></button><div className="rule-file-actions"><button type="button" onClick={() => importInputRef.current?.click()}><Upload size={14} />导入 JSON</button><button type="button" onClick={exportRules} disabled={!rules.length}><Download size={14} />导出 JSON</button><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importRules(event)} /></div></div>
          {ruleListOpen && rules.length > 0 && <div className="rule-list">{rules.map((rule, index) => <div className={`rule-item ${editingRuleId === rule.id ? "editing" : ""}`} key={rule.id}><span className="rule-order">{index + 1}</span><strong>{rule.name}</strong><code>{displayRegex(rule)}</code><span>{categoryCounts[rule.name] ?? 0} 条</span><button onClick={() => editRule(rule)} aria-label={`编辑 ${rule.name} 规则`} title="编辑规则"><Pencil size={14} /></button><button onClick={() => deleteRule(rule.id)} aria-label={`删除 ${rule.name} 规则`} title="删除规则"><Trash2 size={15} /></button></div>)}</div>}
        </div>}
      </section>

      <div className="toolbar stacked"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索文件名或分类…" /></label><details ref={filterMenuRef} className="filter-menu"><summary><SlidersHorizontal size={16} /><span>筛选设置</span>{hideShortDuration && <em>≧ {Number(durationThreshold) || 1} 秒</em>}</summary><div className="filter-popover"><strong>音效时长</strong><div className="duration-filter-row"><label className="duration-filter-toggle"><input type="checkbox" checked={hideShortDuration} onChange={(event) => saveDurationFilter(event.target.checked, durationThreshold)} /><span>音效时长 ≧</span></label><label className="duration-input"><input type="number" min="1" step="1" inputMode="numeric" value={durationThreshold} onChange={(event) => { if (event.target.value === "" || /^\d+$/.test(event.target.value)) saveDurationFilter(hideShortDuration, event.target.value); }} onBlur={() => { if (durationThreshold === "") saveDurationFilter(hideShortDuration, "1"); }} /><span>秒</span></label></div></div></details></div>
      <div className="filter-chips"><button className={category === "all" ? "active" : ""} onClick={() => { setCategory("all"); setPage(1); }}>全部 <span>{durationFiltered.length}</span></button>{visibleTagNames.map((tag) => <button key={tag} className={category === tag ? "active" : ""} onClick={() => { setCategory(tag); setPage(1); }}>{tag} <span>{categoryCounts[tag] ?? 0}</span></button>)}<button className={category === "未分类" ? "active" : ""} onClick={() => { setCategory("未分类"); setPage(1); }}>未分类 <span>{categoryCounts["未分类"] ?? 0}</span></button>{hiddenTagCount > 0 && <button className={`chip-toggle ${showAllCategories ? "expanded" : ""}`} type="button" onClick={() => setShowAllCategories((value) => !value)} aria-expanded={showAllCategories}><ChevronDown size={13} />{showAllCategories ? "收起标签" : `展开 ${hiddenTagCount} 个`}</button>}</div>
      {error && <div className="inline-error"><CircleAlert size={17} />{error}，请确认本地音频服务运行在 8787 端口。</div>}
      <section className="sound-grid" aria-label="音效列表">
        {visible.map((sound) => {
          const active = activeId === sound.id;
          const visibleTags = sound.matchedCategories.slice(0, 4);
          const copied = copiedId === sound.id;
          return <div className={`sound-card ${active ? "active" : ""}`} key={sound.id}><button className="sound-play" onClick={() => void preview(sound)} aria-label={`试听 ${sound.originalName}`}>{active && playing ? <Pause size={17} /> : active ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}</button><button className="sound-info" onClick={() => void preview(sound)} title="点击试听"><strong>{sound.title}</strong><small>{sound.originalName}</small></button><span className="category-tags">{visibleTags.length ? visibleTags.map((tag) => <button className="category-tag matched" key={tag} onClick={() => { setCategory(tag); setPage(1); }} title={`筛选标签：${tag}`}>{tag}</button>) : <button className="category-tag" onClick={() => { setCategory("未分类"); setPage(1); }} title="筛选未分类文件">未分类</button>}{sound.matchedCategories.length > 4 && <span className="more-tags" title={sound.matchedCategories.slice(4).join("、")}>+{sound.matchedCategories.length - 4}</span>}</span><span className="sound-duration">{formatTime(sound.durationMs)}</span><span className={`review-dot ${sound.matchedRuleIds.length ? "matched" : ""}`} title={sound.matchedRuleIds.length ? `已匹配 ${sound.matchedCategories.length} 个标签` : "未分类"} /><button className={`copy-filename ${copied ? "copied" : ""}`} onClick={() => void copyFilename(sound)} aria-label={`复制文件名 ${sound.originalName}`} title={copied ? "已复制" : "复制文件名"}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>;
        })}
      </section>
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {pages} 页 · 每页最多 {PAGE_SIZE} 条</span><button disabled={page === pages} onClick={() => setPage(page + 1)}>下一页</button></div>
    </div>
  );
}
