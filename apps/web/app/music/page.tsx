"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Check, ChevronDown, ChevronRight, CircleAlert, Download, Pause, Pencil, Play, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { CategoryChips } from "../category-chips";
import { EmptyResults } from "../empty-results";
import { useFitPageSize } from "../fit-page-size";
import { Pagination } from "../pagination";
import { usePlayer } from "../providers";
import { useSearchShortcut } from "../search-shortcut";
import { UNCATEGORIZED, type Messages } from "../i18n";
import { useLocale } from "../locale-provider";
import { formatTime, normalizeSearch, type Track } from "../types";

/** Page size on narrow screens, where the list scrolls with the page. */
const FALLBACK_PAGE_SIZE = 30;
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

function parseRulesPayload(value: unknown, errors: Messages["library"]["errors"]) {
  if (!value || typeof value !== "object") throw new Error(errors.notObject);
  const payload = value as { format?: unknown; version?: unknown; rules?: unknown };
  if (payload.format !== "xunxian-music-category-rules" || payload.version !== 1 || !Array.isArray(payload.rules)) throw new Error(errors.unsupported);
  return payload.rules.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(errors.ruleInvalid(index + 1));
    const item = value as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const pattern = typeof item.pattern === "string" ? item.pattern : "";
    const flags = typeof item.flags === "string" ? item.flags : "i";
    if (!name || !pattern) throw new Error(errors.ruleMissing(index + 1));
    try { new RegExp(pattern, flags); } catch { throw new Error(errors.ruleRegex(index + 1)); }
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutLabel = useSearchShortcut(searchInputRef);
  const player = usePlayer();
  const { t, tag: tagText } = useLocale();

  useEffect(() => {
    fetch("/data/music.v1.json").then((res) => res.json()).then(setTracks);
    try {
      const saved = localStorage.getItem(RULES_KEY);
      if (saved !== null) {
        queueMicrotask(() => setRules(JSON.parse(saved) as MusicRule[]));
      } else {
        fetch("/data/default-music-category-rules.v1.json")
          .then((response) => {
            if (!response.ok) throw new Error(t.library.errors.defaultMissing);
            return response.json();
          })
          .then((payload) => {
            const initialRules = parseRulesPayload(payload, t.library.errors);
            setRules(initialRules);
            localStorage.setItem(RULES_KEY, JSON.stringify(initialRules));
          })
          .catch((cause) => setRuleError(t.library.errors.defaultFailed(cause instanceof Error ? cause.message : undefined)));
      }
    } catch { localStorage.removeItem(RULES_KEY); }
    // Runs once on mount; the error text uses the language at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!track.matchedCategories.length) counts[UNCATEGORIZED] = (counts[UNCATEGORIZED] ?? 0) + 1;
    for (const tag of track.matchedCategories) counts[tag] = (counts[tag] ?? 0) + 1;
    return counts;
  }, {}), [classified]);
  const tagNames = useMemo(() => [...new Set(rules.map((rule) => rule.name))].sort((left, right) => (categoryCounts[right] ?? 0) - (categoryCounts[left] ?? 0) || left.localeCompare(right, "zh-CN")), [rules, categoryCounts]);
  const filtered = useMemo(() => {
    const term = normalizeSearch(query);
    return classified.filter((track) => {
      const matchesCategory = category === "all" || (category === UNCATEGORIZED ? !track.matchedCategories.length : track.matchedCategories.includes(category));
      return matchesCategory && (!term || normalizeSearch(`${track.title} ${track.originalName} ${track.matchedCategories.join(" ")} ${track.matchedCategories.map(tagText).join(" ")}`).includes(term));
    });
  }, [classified, query, category, tagText]);
  // 桌面端每页条数 = 列表卡片里能完整放下的行数，不出现滚动
  const listRef = useRef<HTMLDivElement | null>(null);
  const pageSize = useFitPageSize(listRef, ".track-row:not(.track-head)", FALLBACK_PAGE_SIZE, filtered.length > 0);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [currentPage, filtered]);

  function saveRules(nextRules: MusicRule[]) {
    setRules(nextRules);
    localStorage.setItem(RULES_KEY, JSON.stringify(nextRules));
    if (category !== "all" && category !== UNCATEGORIZED && !nextRules.some((rule) => rule.name === category)) setCategory("all");
    setPage(1);
  }

  function submitRule(event: React.FormEvent) {
    event.preventDefault();
    const name = ruleName.trim();
    const input = rulePattern.trim();
    if (!name || !input) { setRuleError(t.music.fillBoth); return; }
    const { pattern, flags } = parseRegexInput(input);
    try { new RegExp(pattern, flags); } catch (cause) { setRuleError(t.library.errors.regex(cause instanceof Error ? cause.message : undefined)); return; }
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
      const imported = parseRulesPayload(JSON.parse(await file.text()), t.library.errors);
      const merged = [...rules]; let added = 0; let updated = 0;
      for (const rule of imported) { const index = merged.findIndex((item) => item.id === rule.id); if (index >= 0) { merged[index] = rule; updated += 1; } else { merged.push(rule); added += 1; } }
      saveRules(merged); setRuleListOpen(false); setImportMessage(t.library.imported(added, updated));
    } catch (cause) { setRuleError(t.library.errors.importFailed(cause instanceof Error ? cause.message : undefined)); }
  }

  const choose = (track: Track) => player.current?.id === track.id ? player.toggle() : void player.play(track, filtered);

  return (
    <div className="page library-page music-page">
      <h1 className="visually-hidden">{t.nav.music}</h1>

      <section className="filter-card" aria-label={t.library.filters}>
        <div className="toolbar"><label className="search-box"><Search size={18} /><input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t.music.search} /><kbd>{shortcutLabel}</kbd></label><button className={`toolbar-button${rulePanelOpen ? " active" : ""}`} type="button" onClick={() => setRulePanelOpen((value) => !value)} aria-expanded={rulePanelOpen} aria-controls="music-rule-panel"><Braces size={16} />{t.library.rules}</button><span className="record-count">{t.music.count(filtered.length.toLocaleString(), tracks.length.toLocaleString())}</span></div>
        {rulePanelOpen && <section className="regex-panel" id="music-rule-panel" aria-label={t.library.rulePanel}>
          <div className="regex-panel-body">
            <form className="rule-form" onSubmit={submitRule}><label><span>{t.music.nameLabel}</span><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder={t.music.namePlaceholder} /></label><label className="pattern-field"><span>{t.library.patternLabel}</span><div><input value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} placeholder={t.music.patternPlaceholder} /></div></label><div className="rule-form-actions"><button className="add-rule-button" type="submit">{editingRuleId ? <Save size={16} /> : <Plus size={16} />}{editingRuleId ? t.library.save : t.library.add}</button>{editingRuleId && <button className="cancel-edit-button" type="button" onClick={cancelEdit}><X size={15} />{t.library.cancel}</button>}</div></form>
            {ruleError && <p className="rule-error"><CircleAlert size={14} />{ruleError}</p>}{importMessage && <p className="import-success"><Check size={14} />{importMessage}</p>}
            <div className="rule-hint">{t.music.hint}</div>
            <div className="rule-list-heading"><button className="rule-list-toggle" type="button" onClick={() => setRuleListOpen((value) => !value)} aria-expanded={ruleListOpen}>{ruleListOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{t.library.currentRules} <span>{rules.length}</span></button><div className="rule-file-actions"><button type="button" onClick={() => importInputRef.current?.click()}><Upload size={14} />{t.library.importJson}</button><button type="button" onClick={exportRules} disabled={!rules.length}><Download size={14} />{t.library.exportJson}</button><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importRules(event)} /></div></div>
            {ruleListOpen && rules.length > 0 && <div className="rule-list">{rules.map((rule, index) => <div className={`rule-item ${editingRuleId === rule.id ? "editing" : ""}`} key={rule.id}><span className="rule-order">{index + 1}</span><strong>{tagText(rule.name)}</strong><code>{displayRegex(rule)}</code><span>{t.music.ruleCount(categoryCounts[rule.name] ?? 0)}</span><button onClick={() => editRule(rule)} aria-label={t.library.editRule(tagText(rule.name))}><Pencil size={14} /></button><button onClick={() => { saveRules(rules.filter((item) => item.id !== rule.id)); if (editingRuleId === rule.id) cancelEdit(); }} aria-label={t.library.deleteRule(tagText(rule.name))}><Trash2 size={15} /></button></div>)}</div>}
          </div>
        </section>}

        <CategoryChips tags={tagNames} counts={categoryCounts} total={classified.length} category={category} onSelect={(value) => { setCategory(value); setPage(1); }} />
      </section>
      <section className="list-card track-table" aria-label={t.music.list}>
        <div ref={listRef} className="list-scroll">
        <div className="track-row track-head"><span>#</span><span>{t.music.head.track}</span><span>{t.music.head.tags}</span><span>{t.music.head.length}</span><span /></div>
        {visible.map((track, index) => {
          const active = player.current?.id === track.id;
          return <div className={`track-row ${active ? "playing" : ""}`} key={track.id}><button className="music-index" onClick={() => choose(track)}>{active && player.loading ? <span className="audio-spinner" /> : active ? <i className="playing-bars"><b /><b /><b /></i> : String((currentPage - 1) * pageSize + index + 1).padStart(2, "0")}</button><button className="track-name" onClick={() => choose(track)}><strong>{track.originalName}</strong></button><span className="music-tags">{track.matchedCategories.slice(0, 4).map((tag) => <button className="category-tag matched" key={tag} onClick={() => { setCategory(tag); setPage(1); }}>{tagText(tag)}</button>)}{track.matchedCategories.length > 4 && <span className="more-tags">+{track.matchedCategories.length - 4}</span>}</span><span>{formatTime(track.durationMs)}</span><button className="row-play" onClick={() => choose(track)} aria-label={active && player.loading ? t.player.loading : active && player.playing ? t.player.pause : t.player.play} aria-busy={active && player.loading}>{active && player.loading ? <span className="audio-spinner" /> : active && player.playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button></div>;
        })}
        {tracks.length > 0 && !filtered.length && <EmptyResults onReset={() => { setQuery(""); setCategory("all"); setPage(1); }} />}
        </div>
        <Pagination page={currentPage} pages={pages} onChange={setPage} />
      </section>
    </div>
  );
}
