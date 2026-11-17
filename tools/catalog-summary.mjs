import { extname } from "node:path";

function summarizeKind(items) {
  const formats = {};
  let durationMs = 0;
  let bytes = 0;
  for (const item of items) {
    const format = extname(item.originalName).slice(1).toUpperCase();
    formats[format] = (formats[format] ?? 0) + 1;
    durationMs += item.durationMs ?? 0;
    bytes += item.technical?.size ?? 0;
  }
  return { formats, durationMs, bytes };
}

/** Totals shown on the site (durations, sizes, formats), derived from catalog records. */
export function summarizeMedia(music, sound) {
  const musicSummary = summarizeKind(music);
  const soundSummary = summarizeKind(sound);
  return {
    durationMs: {
      music: musicSummary.durationMs,
      sound: soundSummary.durationMs,
      total: musicSummary.durationMs + soundSummary.durationMs,
    },
    bytes: {
      music: musicSummary.bytes,
      sound: soundSummary.bytes,
      total: musicSummary.bytes + soundSummary.bytes,
    },
    formats: { music: musicSummary.formats, sound: soundSummary.formats },
  };
}
