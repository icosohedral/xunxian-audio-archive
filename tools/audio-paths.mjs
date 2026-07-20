import { createHash } from "node:crypto";
import { posix } from "node:path";

export const AUDIO_RELEASE = "v1";
export const TRANSCODE_VERSION = 1;

export function normalizeSourceRelative(value) {
  const normalized = value.replaceAll("\\", "/").normalize("NFC");
  if (!/^(music|sound)\/[^/]+\.(ogg|wav)$/i.test(normalized)) {
    throw new Error(`Unsupported audio source path: ${value}`);
  }
  if (normalized.includes("\0") || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe audio source path: ${value}`);
  }
  return normalized;
}

export function stableAudioIdentity(sourceRelative) {
  const source = normalizeSourceRelative(sourceRelative);
  const kind = source.startsWith("music/") ? "music" : "sound";
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
  return {
    id: `${kind === "music" ? "mus" : "snd"}_${hash}`,
    hash,
    kind,
    source,
  };
}

export function audioObjectKey(sourceRelative, format) {
  if (format !== "opus" && format !== "mp3") throw new Error(`Unsupported output format: ${format}`);
  const identity = stableAudioIdentity(sourceRelative);
  return posix.join("audio", AUDIO_RELEASE, identity.kind, identity.hash.slice(0, 2), `${identity.hash}.${format}`);
}

export function outputRelativePath(sourceRelative, format) {
  return audioObjectKey(sourceRelative, format).replace(/^audio\//, "");
}
