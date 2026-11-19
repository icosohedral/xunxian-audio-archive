"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Braces, Check, ChevronDown, ChevronRight, CircleAlert, Copy, Download, Pause, Pencil, Play, Plus, RotateCcw, Save, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { CategoryChips } from "../category-chips";
import { EmptyResults } from "../empty-results";
import { useFitPageSize } from "../fit-page-size";
import { Pagination } from "../pagination";
import { useSearchShortcut } from "../search-shortcut";
import { UNCATEGORIZED, type Messages } from "../i18n";
import { useLocale } from "../locale-provider";
import { formatTime, normalizeSearch, resolveAudioUrl, selectPlayableAudioKey, type Track } from "../types";

/** Page size on narrow screens, where the list scrolls with the page. */
const FALLBACK_PAGE_SIZE = 100;
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

function parseRulesPayload(value: unknown, errors: Messages["library"]["errors"]) {
  if (!value || typeof value !== "object") throw new Error(errors.notObject);
  const payload = value as { format?: unknown; version?: unknown; rules?: unknown };
  if (payload.format !== "xunxian-sound-category-rules" || payload.version !== 1 || !Array.isArray(payload.rules)) {
    throw new Error(errors.unsupported);
  }
  return payload.rules.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(errors.ruleInvalid(index + 1));
    const item = value as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const pattern = typeof item.pattern === "string" ? item.pattern : "";
    const flags = typeof item.flags === "string" ? item.flags : "i";
    if (!name || !pattern) throw new Error(errors.ruleMissing(index + 1));
    try { new RegExp(pattern, flags); }
    catch { throw new Error(errors.ruleRegex(index + 1)); }
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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulePanelOpen, setRulePanelOpen] = useState(false);
  const [ruleListOpen, setRuleListOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [hideShortDuration, setHideShortDuration] = useState(false);
  const [durationThreshold, setDurationThreshold] = useState("1");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const filterMenuRef = useRef<HTMLDetailsElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutLabel = useSearchShortcut(searchInputRef);
  const { t, tag: tagText } = useLocale();
  const timeoutMessage = t.sounds.errors.timeout;

  const stopLoading = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = null;
    setLoadingId(null);
  }, []);

  const startLoading = useCallback((soundId: string) => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    setLoadingId(soundId);
    loadingTimeoutRef.current = setTimeout(() => {
      audioRef.current?.pause();
      loadingTimeoutRef.current = null;
      setLoadingId(null);
      setError(timeoutMessage);
    }, 15_000);
  }, [timeoutMessage]);

  useEffect(() => {
    fetch("/data/sound.v1.json").then((res) => res.json()).then(setSounds);
    try {
      const saved = localStorage.getItem(RULES_KEY);
      if (saved !== null) {
        queueMicrotask(() => setRules(JSON.parse(saved) as CategoryRule[]));
      } else {
        fetch("/data/default-category-rules.v1.json")
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
    // The error text for the default rules uses the language at mount time.
    const audio = new Audio();
    audio.preload = "none";
    const onCanPlay = () => stopLoading();
    const onPlaying = () => { setPlaying(true); stopLoading(); };
    const onPause = () => { setPlaying(false); stopLoading(); };
    const onEnded = () => { setPlaying(false); stopLoading(); };
    const onError = () => stopLoading();
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audioRef.current = audio;
    return () => {
      audio.pause();
      stopLoading();
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLoading]);

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
    if (!sound.matchedCategories.length) counts[UNCATEGORIZED] = (counts[UNCATEGORIZED] ?? 0) + 1;
    for (const tag of sound.matchedCategories) counts[tag] = (counts[tag] ?? 0) + 1;
    return counts;
  }, {}), [durationFiltered]);
  const tagNames = useMemo(() => [...new Set(rules.map((rule) => rule.name))], [rules]);
  const sortedTagNames = useMemo(() => [...tagNames].sort((left, right) => {
    const countDifference = (categoryCounts[right] ?? 0) - (categoryCounts[left] ?? 0);
    return countDifference || left.localeCompare(right, "zh-CN");
  }), [tagNames, categoryCounts]);

  const filtered = useMemo(() => {
    const term = normalizeSearch(query);
    return durationFiltered.filter((sound) => {
      const matchesCategory = category === "all" || (category === UNCATEGORIZED ? !sound.matchedCategories.length : sound.matchedCategories.includes(category));
      return matchesCategory && (!term || normalizeSearch(`${sound.title} ${sound.originalName} ${sound.matchedCategories.join(" ")} ${sound.matchedCategories.map(tagText).join(" ")}`).includes(term));
    });
  }, [durationFiltered, query, category, tagText]);
  // 桌面端每页条数 = 列表卡片里能完整放下的行数，不出现滚动
  const listRef = useRef<HTMLDivElement | null>(null);
  const pageSize = useFitPageSize(listRef, ".sound-card", FALLBACK_PAGE_SIZE, filtered.length > 0);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [currentPage, filtered]);

  function saveRules(nextRules: CategoryRule[]) {
    setRules(nextRules);
    localStorage.setItem(RULES_KEY, JSON.stringify(nextRules));
    if (category !== "all" && category !== UNCATEGORIZED && !nextRules.some((rule) => rule.name === category)) setCategory("all");
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
    if (!name || !input) { setRuleError(t.sounds.fillBoth); return; }
    const { pattern, flags } = parseRegexInput(input);
    try { new RegExp(pattern, flags); }
    catch (cause) { setRuleError(t.library.errors.regex(cause instanceof Error ? cause.message : undefined)); return; }
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
      const imported = parseRulesPayload(JSON.parse(await file.text()), t.library.errors);
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
      setImportMessage(t.library.imported(added, updated));
    } catch (cause) {
      setRuleError(t.library.errors.importFailed(cause instanceof Error ? cause.message : undefined));
    }
  }

  async function preview(sound: Track) {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    try {
      if (activeId === sound.id) {
        startLoading(sound.id);
        audio.currentTime = 0;
        await audio.play();
        stopLoading();
      } else {
        audio.pause();
        startLoading(sound.id);
        const key = selectPlayableAudioKey(sound.audio, (mimeType) => audio.canPlayType(mimeType));
        audio.src = await resolveAudioUrl(key);
        setActiveId(sound.id);
        await audio.play();
        stopLoading();
      }
    } catch (cause) {
      stopLoading();
      setError(cause instanceof Error ? cause.message : t.sounds.errors.play);
    }
  }

  async function copyFilename(sound: Track) {
    try {
      await navigator.clipboard.writeText(sound.originalName);
      setCopiedId(sound.id);
      window.setTimeout(() => setCopiedId((current) => current === sound.id ? null : current), 1400);
    } catch {
      setError(t.sounds.errors.copy);
    }
  }

  return (
    <div className="page library-page sounds-page">
      <h1 className="visually-hidden">{t.nav.sounds}</h1>

      <section className="filter-card" aria-label={t.library.filters}>
        <div className="toolbar"><label className="search-box"><Search size={18} /><input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t.sounds.search} /><kbd>{shortcutLabel}</kbd></label><details ref={filterMenuRef} className="filter-menu"><summary><SlidersHorizontal size={16} /><span>{t.sounds.filterSettings}</span>{hideShortDuration && <em>{t.sounds.minDuration(Number(durationThreshold) || 1)}</em>}</summary><div className="filter-popover"><strong>{t.sounds.duration}</strong><div className="duration-filter-row"><label className="duration-filter-toggle"><input type="checkbox" checked={hideShortDuration} onChange={(event) => saveDurationFilter(event.target.checked, durationThreshold)} /><span>{t.sounds.durationAtLeast}</span></label><label className="duration-input"><input type="number" min="1" step="1" inputMode="numeric" value={durationThreshold} onChange={(event) => { if (event.target.value === "" || /^\d+$/.test(event.target.value)) saveDurationFilter(hideShortDuration, event.target.value); }} onBlur={() => { if (durationThreshold === "") saveDurationFilter(hideShortDuration, "1"); }} /><span>{t.sounds.seconds}</span></label></div></div></details><button className={`toolbar-button${rulePanelOpen ? " active" : ""}`} type="button" onClick={() => setRulePanelOpen((value) => !value)} aria-expanded={rulePanelOpen} aria-controls="sound-rule-panel"><Braces size={16} />{t.library.rules}</button><span className="record-count">{t.sounds.count(filtered.length.toLocaleString(), sounds.length.toLocaleString())}</span></div>
        {rulePanelOpen && <section className="regex-panel" id="sound-rule-panel" aria-label={t.library.rulePanel}>
          <div className="regex-panel-body">
            <form className="rule-form" onSubmit={addRule}>
              <label><span>{t.sounds.nameLabel}</span><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder={t.sounds.namePlaceholder} /></label>
              <label className="pattern-field"><span>{t.library.patternLabel}</span><div><input value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} placeholder={t.sounds.patternPlaceholder} /></div></label>
              <div className="rule-form-actions"><button className="add-rule-button" type="submit">{editingRuleId ? <Save size={16} /> : <Plus size={16} />}{editingRuleId ? t.library.save : t.library.add}</button>{editingRuleId && <button className="cancel-edit-button" type="button" onClick={cancelEdit}><X size={15} />{t.library.cancel}</button>}</div>
            </form>
            {ruleError && <p className="rule-error"><CircleAlert size={14} />{ruleError}</p>}
            {importMessage && <p className="import-success"><Check size={14} />{importMessage}</p>}
            <div className="rule-hint">{t.sounds.hint}</div>
            <div className="rule-list-heading"><button className="rule-list-toggle" type="button" onClick={() => setRuleListOpen((value) => !value)} aria-expanded={ruleListOpen}>{ruleListOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{t.library.currentRules} <span>{rules.length}</span></button><div className="rule-file-actions"><button type="button" onClick={() => importInputRef.current?.click()}><Upload size={14} />{t.library.importJson}</button><button type="button" onClick={exportRules} disabled={!rules.length}><Download size={14} />{t.library.exportJson}</button><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importRules(event)} /></div></div>
            {ruleListOpen && rules.length > 0 && <div className="rule-list">{rules.map((rule, index) => <div className={`rule-item ${editingRuleId === rule.id ? "editing" : ""}`} key={rule.id}><span className="rule-order">{index + 1}</span><strong>{tagText(rule.name)}</strong><code>{displayRegex(rule)}</code><span>{t.sounds.ruleCount(categoryCounts[rule.name] ?? 0)}</span><button onClick={() => editRule(rule)} aria-label={t.library.editRule(tagText(rule.name))} title={t.library.editTitle}><Pencil size={14} /></button><button onClick={() => deleteRule(rule.id)} aria-label={t.library.deleteRule(tagText(rule.name))} title={t.library.deleteTitle}><Trash2 size={15} /></button></div>)}</div>}
          </div>
        </section>}

        <CategoryChips tags={sortedTagNames} counts={categoryCounts} total={durationFiltered.length} category={category} onSelect={(value) => { setCategory(value); setPage(1); }} />
      </section>
      {error && <div className="inline-error" role="alert"><CircleAlert size={17} />{t.sounds.loadFailed}</div>}
      <section className="list-card" aria-label={t.sounds.list}>
        <div ref={listRef} className="list-scroll sound-grid">
        {visible.map((sound) => {
          const active = activeId === sound.id;
          const visibleTags = sound.matchedCategories.slice(0, 1);
          const copied = copiedId === sound.id;
          const loading = loadingId === sound.id;
          return <div className={`sound-card ${active ? "active" : ""}`} key={sound.id}><button className="sound-play" onClick={() => void preview(sound)} aria-label={loading ? t.sounds.loadingName(sound.originalName) : t.sounds.play(sound.originalName)} aria-busy={loading}>{loading ? <span className="audio-spinner" /> : active && playing ? <Pause size={17} /> : active ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}</button><button className="sound-info" onClick={() => void preview(sound)} title={t.sounds.playTitle}><strong>{sound.originalName}</strong></button><span className="category-tags">{visibleTags.map((tag) => <button className="category-tag matched" key={tag} onClick={() => { setCategory(tag); setPage(1); }} title={t.sounds.filterTag(tagText(tag))}>{tagText(tag)}</button>)}{sound.matchedCategories.length > 1 && <span className="more-tags" title={sound.matchedCategories.slice(1).map(tagText).join(t.sounds.tagSeparator)}>+{sound.matchedCategories.length - 1}</span>}</span><span className="sound-duration">{formatTime(sound.durationMs)}</span><button className={`copy-filename ${copied ? "copied" : ""}`} onClick={() => void copyFilename(sound)} aria-label={t.sounds.copy(sound.originalName)} title={copied ? t.sounds.copied : t.sounds.copyTitle}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>;
        })}
        {sounds.length > 0 && !filtered.length && <EmptyResults onReset={() => { setQuery(""); setCategory("all"); setPage(1); }} />}
        </div>
        <Pagination page={currentPage} pages={pages} onChange={setPage} note={t.pagination.perPage(pageSize)} />
      </section>
    </div>
  );
}
