export type AudioVariant = {
  key: string;
  format: string;
  mimeType: string;
};

export type TrackAudio = {
  preferredKey: string;
  variants: AudioVariant[];
};

export type Track = {
  id: string;
  kind: "music" | "sound";
  title: string;
  originalName: string;
  durationMs: number;
  category: string;
  reviewStatus: "auto" | "reviewed" | "needs_review";
  tags: string[];
  audio: TrackAudio;
  technical: { sampleRate: number | null; channels: number | null; size: number };
};

export type CatalogSummary = {
  version: number;
  generatedAt: string;
  counts: { music: number; sound: number; total: number };
  categoryCounts: Record<string, number>;
};

export function formatTime(milliseconds: number) {
  if (!milliseconds) return "--:--";
  const total = Math.round(milliseconds / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function resolveAudioUrl(key: string) {
  const localHost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const mediaOrigin = localHost ? "http://localhost:8787" : "";
  const response = await fetch(`${mediaOrigin}/api/audio-url?key=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error("本地音频服务未启动");
  const data = await response.json() as { url: string };
  return data.url;
}

export function selectPlayableAudioKey(audio: TrackAudio, canPlayType: (mimeType: string) => string) {
  const ordered = [
    ...audio.variants.filter((variant) => variant.key === audio.preferredKey),
    ...audio.variants.filter((variant) => variant.key !== audio.preferredKey),
  ];
  return ordered.find((variant) => canPlayType(variant.mimeType) !== "")?.key ?? audio.preferredKey;
}
