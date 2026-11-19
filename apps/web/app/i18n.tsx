import type { ReactNode } from "react";

export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
/** The visitor's language choice; read on the server so the first render is already in that language. */
export const LOCALE_COOKIE = "xunxian-locale";

export const htmlLang = (locale: Locale) => (locale === "en" ? "en" : "zh-CN");

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Locale for a request: the saved choice if there is one, otherwise the browser's first language.
 * Browsers that ask for Chinese, and requests without a language (most crawlers), get Chinese.
 */
export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase();
  if (!first || first === "*" || first.startsWith("zh")) return "zh";
  return "en";
}

/** The uncategorized filter key; rules and counts use it in both languages. */
export const UNCATEGORIZED = "未分类";

/**
 * English labels for the default category rules' tag names. Tags stay keyed by their Chinese name
 * (rules, saved filters and exports keep working); this only changes what English visitors read.
 * Names visitors create themselves have no entry and show as typed.
 */
const TAG_LABELS_EN: Record<string, string> = {
  [UNCATEGORIZED]: "Uncategorized",
  // Music
  五行劫: "Five Elements Trial",
  京城: "Capital",
  副本: "Dungeons",
  城镇: "Towns",
  夜晚: "Night",
  女儿国: "Land of Women",
  白云观: "Baiyun Temple",
  道观: "Taoist temples",
  野外: "Wilderness",
  镇妖塔: "Demon-Sealing Tower",
  龙宫: "Dragon Palace",
  // Sounds
  NPC语音: "NPC voices",
  NPC音效: "NPC sounds",
  中立NPC语音: "Neutral NPC voices",
  敌对NPC语音: "Hostile NPC voices",
  叫卖语音: "Vendor calls",
  问候语音: "Greetings",
  求助语音: "Calls for help",
  死亡语音: "Death cries",
  五行劫剧情: "Five Elements Trial story",
  女儿国剧情: "Land of Women story",
  魔尊剧情: "Demon Lord story",
  八派尊者: "Eight Sect masters",
  宠物技能: "Pet skills",
  法宝技能: "Artifact skills",
  技能音效: "Skill sounds",
  灵宝吟唱: "Lingbao chants",
  怪物音效: "Monster sounds",
  环境音效: "Ambience",
  界面音效: "Interface sounds",
  系统提示: "System alerts",
  进度条: "Progress bar",
  鬼怪: "Ghosts and spirits",
  乘风: "Chengfeng",
  乾坤: "Qiankun",
  刑天: "Xingtian",
  天君: "Tianjun",
  奇门: "Qimen",
  妙音: "Miaoyin",
  幽冥: "Youming",
  掌电: "Zhangdian",
  控火: "Konghuo",
  罗刹: "Luocha",
  金刚: "Jingang",
  驭剑: "Yujian",
};

export function tagLabel(locale: Locale, tag: string) {
  return locale === "en" ? TAG_LABELS_EN[tag] ?? tag : tag;
}

const zh = {
  siteName: "寻仙音乐资料库",
  meta: {
    description: "浏览、检索与试听《寻仙》游戏音乐与音效资料。",
    musicDescription: "浏览与试听《寻仙》城镇、野外、副本和节庆背景音乐。",
    soundsDescription: "检索、分类与试听《寻仙》游戏音效。",
    ogLocale: "zh_CN",
  },
  nav: { overview: "总览", music: "仙乐集", sounds: "万籁库", label: "资料库主导航" },
  shell: { skip: "跳到资料正文", home: "寻仙音乐资料库首页" },
  language: { label: "语言", switchTo: "切换到英文 (English)", short: "EN" },
  visits: {
    label: "今日来访",
    loading: "正在载入今日访客数",
    count: (count: string) => `今日来访 ${count} 人次`,
  },
  theme: { label: "配色主题", green: "青绿主题", orange: "陶土橙主题", dark: "深色主题" },
  about: {
    open: (version: string) => `关于寻仙音乐资料库，版本 ${version}`,
    repo: "项目地址",
    hub: "资源总站",
    notice: "本站为资料整理与试听项目，游戏及相关权利归原权利人所有。",
    ok: "知道了",
  },
  player: {
    label: "全局音乐播放器",
    mode: { sequence: "顺序播放", shuffle: "随机播放", repeat: "单曲循环" },
    modeTitle: (mode: string) => `播放模式：${mode}`,
    previous: "上一首",
    next: "下一首",
    loading: "正在载入",
    pause: "暂停",
    play: "播放",
    progress: "播放进度",
    volume: "音量",
    errors: { timeout: "音频载入超时，请重试", play: "无法播放音频" },
  },
  home: {
    intro: "在中国神话与人间烟火之间寻仙",
    body: "寻仙以中国美术片风格构筑了一个有神仙妖怪、法宝灵兽，也有城镇村落与市井人情的东方世界。音乐与音效记录了其中的昼夜、地域、职业与剧情变化，本资料库希望让这些散落的声音重新变得可检索、可聆听。",
    all: "全部音频",
    music: "背景音乐",
    sounds: "游戏音效",
    totalHint: (hours: string, mib: string) => `共 ${hours} 小时 · ${mib} MiB`,
    hours: (hours: string) => `${hours} 小时`,
  },
  pagination: {
    label: "分页",
    previous: "上一页",
    next: "下一页",
    input: (pages: number) => `页码，共 ${pages} 页，输入后按回车跳转`,
    page: (input: ReactNode, pages: number) => <>第{input}/ {pages} 页</>,
    perPage: (size: number) => ` · 每页 ${size} 条`,
  },
  chips: { all: "全部", more: "更多" },
  empty: {
    title: "没有找到匹配的音频",
    hint: <>可按文件名的一部分搜索，例如 <code>boss</code>、<code>night</code>；也可以换个分类试试。</>,
    reset: "清除搜索与筛选",
  },
  library: {
    filters: "搜索与筛选",
    rules: "分类规则",
    rulePanel: "正则分类规则",
    patternLabel: "文件名正则",
    save: "保存修改",
    add: "添加规则",
    cancel: "取消",
    currentRules: "当前规则",
    importJson: "导入 JSON",
    exportJson: "导出 JSON",
    editRule: (name: string) => `编辑 ${name} 规则`,
    deleteRule: (name: string) => `删除 ${name} 规则`,
    editTitle: "编辑规则",
    deleteTitle: "删除规则",
    errors: {
      notObject: "文件内容不是有效对象",
      unsupported: "文件格式或版本不受支持",
      ruleInvalid: (index: number) => `第 ${index} 条规则格式无效`,
      ruleMissing: (index: number) => `第 ${index} 条规则缺少名称或正则`,
      ruleRegex: (index: number) => `第 ${index} 条规则的正则无效`,
      defaultMissing: "默认规则文件不存在",
      defaultFailed: (message?: string) => (message ? `默认规则载入失败：${message}` : "默认规则载入失败"),
      regex: (message?: string) => (message ? `正则无效：${message}` : "正则表达式无效"),
      importFailed: (message?: string) => (message ? `导入失败：${message}` : "导入失败：无法读取文件"),
    },
    imported: (added: number, updated: number) => `导入完成：新增 ${added} 条，更新 ${updated} 条`,
  },
  music: {
    search: "搜索文件名或标签…",
    count: (shown: string, total: string) => `${shown} / ${total} 首`,
    ruleCount: (count: number) => `${count} 首`,
    nameLabel: "标签名称",
    namePlaceholder: "例如：城镇音乐",
    patternPlaceholder: "^world_ 或 /.*night.*$/i",
    fillBoth: "请填写标签名称和正则表达式",
    hint: <>可输入正则内容，默认忽略大小写；完整的 <code>/.*night.*$/i</code> 形式也可直接使用。</>,
    list: "背景音乐列表",
    head: { track: "曲目", tags: "标签", length: "时长" },
  },
  sounds: {
    search: "搜索文件名或分类…",
    count: (shown: string, total: string) => `${shown} / ${total} 条`,
    ruleCount: (count: number) => `${count} 条`,
    filterSettings: "筛选设置",
    minDuration: (seconds: number) => `≧ ${seconds} 秒`,
    duration: "音效时长",
    durationAtLeast: "音效时长 ≧",
    seconds: "秒",
    nameLabel: "分类名称",
    namePlaceholder: "例如：角色语音",
    patternPlaceholder: "^boss 或 /.*qimen.*$/i",
    fillBoth: "请填写分类名称和正则表达式",
    hint: <>可输入正则内容，例如 <code>^boss</code>（默认添加 i），也可输入完整形式 <code>/.*qimen.*$/i</code>，完整形式不会被重复包裹。</>,
    loadFailed: "音效加载失败，请稍后重试。",
    list: "音效列表",
    loadingName: (name: string) => `正在载入 ${name}`,
    play: (name: string) => `试听 ${name}`,
    playTitle: "点击试听",
    filterTag: (tag: string) => `筛选标签：${tag}`,
    tagSeparator: "、",
    copy: (name: string) => `复制文件名 ${name}`,
    copyTitle: "复制文件名",
    copied: "已复制",
    errors: {
      timeout: "音效载入超时，请重试",
      play: "无法播放音效",
      copy: "复制文件名失败，请检查浏览器剪贴板权限",
    },
  },
};

export type Messages = typeof zh;

const en: Messages = {
  siteName: "Xunxian Music Archive",
  meta: {
    description: "Browse, search and listen to music and sound effects from the game Xunxian.",
    musicDescription: "Browse and listen to Xunxian's town, wilderness, dungeon and festival music.",
    soundsDescription: "Search, categorize and listen to Xunxian's sound effects.",
    ogLocale: "en_US",
  },
  nav: { overview: "Overview", music: "Music", sounds: "Sounds", label: "Archive navigation" },
  shell: { skip: "Skip to content", home: "Xunxian Music Archive home" },
  language: { label: "Language", switchTo: "切换到中文 (Chinese)", short: "中文" },
  visits: {
    label: "Visits today",
    loading: "Loading today's visit count",
    count: (count: string) => `${count} visits today`,
  },
  theme: { label: "Color theme", green: "Jade theme", orange: "Terracotta theme", dark: "Dark theme" },
  about: {
    open: (version: string) => `About Xunxian Music Archive, version ${version}`,
    repo: "Repository",
    hub: "Resource hub",
    notice: "This site collects and previews game audio for reference. The game and all related rights belong to their owners.",
    ok: "Got it",
  },
  player: {
    label: "Music player",
    mode: { sequence: "Play in order", shuffle: "Shuffle", repeat: "Repeat one" },
    modeTitle: (mode: string) => `Play mode: ${mode}`,
    previous: "Previous track",
    next: "Next track",
    loading: "Loading",
    pause: "Pause",
    play: "Play",
    progress: "Playback position",
    volume: "Volume",
    errors: { timeout: "The audio took too long to load. Please try again.", play: "Couldn't play this audio." },
  },
  home: {
    intro: "Seeking immortals between Chinese myth and everyday life",
    body: "Xunxian builds an Eastern world in the style of classic Chinese animation, home to gods and demons, magic artifacts and spirit beasts, as well as towns, villages and the bustle of ordinary life. Its music and sound effects follow the turns of day and night, region, class and story. This archive gathers those scattered sounds so they can be searched and heard again.",
    all: "All audio",
    music: "Music",
    sounds: "Sound effects",
    totalHint: (hours: string, mib: string) => `${hours} hours · ${mib} MiB`,
    hours: (hours: string) => `${hours} hours`,
  },
  pagination: {
    label: "Pagination",
    previous: "Previous",
    next: "Next",
    input: (pages: number) => `Page number, ${pages} pages in total. Type a number and press Enter to jump.`,
    page: (input: ReactNode, pages: number) => <>Page {input} of {pages}</>,
    perPage: (size: number) => ` · ${size} per page`,
  },
  chips: { all: "All", more: "More" },
  empty: {
    title: "No matching audio",
    hint: <>Try part of a file name, such as <code>boss</code> or <code>night</code>, or pick another category.</>,
    reset: "Clear search and filters",
  },
  library: {
    filters: "Search and filters",
    rules: "Category rules",
    rulePanel: "Regex category rules",
    patternLabel: "File name regex",
    save: "Save changes",
    add: "Add rule",
    cancel: "Cancel",
    currentRules: "Current rules",
    importJson: "Import JSON",
    exportJson: "Export JSON",
    editRule: (name: string) => `Edit rule ${name}`,
    deleteRule: (name: string) => `Delete rule ${name}`,
    editTitle: "Edit rule",
    deleteTitle: "Delete rule",
    errors: {
      notObject: "The file doesn't contain a valid JSON object.",
      unsupported: "This file format or version isn't supported.",
      ruleInvalid: (index: number) => `Rule ${index} is malformed.`,
      ruleMissing: (index: number) => `Rule ${index} is missing a name or regex.`,
      ruleRegex: (index: number) => `Rule ${index} has an invalid regex.`,
      defaultMissing: "The default rules file is missing.",
      defaultFailed: (message?: string) => (message ? `Couldn't load the default rules: ${message}` : "Couldn't load the default rules."),
      regex: (message?: string) => (message ? `Invalid regex: ${message}` : "Invalid regular expression."),
      importFailed: (message?: string) => (message ? `Import failed: ${message}` : "Import failed: couldn't read the file."),
    },
    imported: (added: number, updated: number) => `Import complete: ${added} added, ${updated} updated.`,
  },
  music: {
    search: "Search file names or tags…",
    count: (shown: string, total: string) => `${shown} / ${total} tracks`,
    ruleCount: (count: number) => `${count} tracks`,
    nameLabel: "Tag name",
    namePlaceholder: "e.g. Town music",
    patternPlaceholder: "^world_ or /.*night.*$/i",
    fillBoth: "Enter a tag name and a regular expression.",
    hint: <>Enter a regex; matching ignores case by default. The full <code>/.*night.*$/i</code> form also works.</>,
    list: "Music list",
    head: { track: "Track", tags: "Tags", length: "Length" },
  },
  sounds: {
    search: "Search file names or categories…",
    count: (shown: string, total: string) => `${shown} / ${total} sounds`,
    ruleCount: (count: number) => `${count} sounds`,
    filterSettings: "Filters",
    minDuration: (seconds: number) => `≥ ${seconds}s`,
    duration: "Sound length",
    durationAtLeast: "Length ≥",
    seconds: "sec",
    nameLabel: "Category name",
    namePlaceholder: "e.g. Character voices",
    patternPlaceholder: "^boss or /.*qimen.*$/i",
    fillBoth: "Enter a category name and a regular expression.",
    hint: <>Enter a regex such as <code>^boss</code> (the i flag is added for you), or the full form <code>/.*qimen.*$/i</code>, which is used as is.</>,
    loadFailed: "Couldn't load the sound. Please try again later.",
    list: "Sound list",
    loadingName: (name: string) => `Loading ${name}`,
    play: (name: string) => `Play ${name}`,
    playTitle: "Click to play",
    filterTag: (tag: string) => `Filter by ${tag}`,
    tagSeparator: ", ",
    copy: (name: string) => `Copy file name ${name}`,
    copyTitle: "Copy file name",
    copied: "Copied",
    errors: {
      timeout: "The sound took too long to load. Please try again.",
      play: "Couldn't play this sound.",
      copy: "Couldn't copy the file name. Check the browser's clipboard permission.",
    },
  },
};

export const messages: Record<Locale, Messages> = { zh, en };
