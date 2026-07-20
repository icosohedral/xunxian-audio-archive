import { createHash } from "node:crypto";
import { readdir, stat, mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { parseFile } from "music-metadata";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = join(root, "original_data");
const outputRoot = join(root, "apps/web/public/data");
const defaultRulesPath = join(root, "meta_data/default-category-rules.json");
const defaultMusicRulesPath = join(root, "meta_data/default-music-category-rules.json");
const transcodeManifestPath = join(root, "generated/manifests/audio-v1.json");
const deploymentMapPath = join(root, "meta_data/audio-deployment-v1.json");

function stableId(kind, filename) {
  const value = `${kind}/${filename}`;
  return `${kind === "music" ? "mus" : "snd"}_${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

function titleFrom(filename) {
  return filename.replace(extname(filename), "").replace(/[_-]+/g, " ");
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

async function readAudioDeployment() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(deploymentMapPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    try {
      const transcode = JSON.parse(await readFile(transcodeManifestPath, "utf8"));
      manifest = {
        format: "xunxian-audio-deployment-map",
        version: 1,
        release: transcode.release,
        sourceCount: transcode.sourceCount,
        items: transcode.items?.map((item) => ({
          id: item.id,
          preferredKey: item.preferredKey,
          variants: item.variants,
        })),
      };
    } catch (fallbackError) {
      if (fallbackError.code === "ENOENT") return null;
      throw fallbackError;
    }
  }
  if (manifest.format !== "xunxian-audio-deployment-map" || manifest.version !== 1 || manifest.release !== "v1" || manifest.sourceCount !== 6414 || !Array.isArray(manifest.items)) {
    throw new Error("Audio deployment map is incomplete or unsupported.");
  }
  const byId = new Map();
  for (const item of manifest.items) {
    if (!item || typeof item.id !== "string" || typeof item.preferredKey !== "string" || !Array.isArray(item.variants)) {
      throw new Error("Audio deployment map contains an invalid item.");
    }
    const kind = item.id.startsWith("mus_") ? "music" : item.id.startsWith("snd_") ? "sound" : null;
    const hash = item.id.slice(4);
    const keyPattern = kind ? new RegExp(`^audio/v1/${kind}/${hash.slice(0, 2)}/${hash}\\.(opus|mp3)$`) : null;
    if (!keyPattern || item.variants.length !== 2 || item.variants.some((variant) => !variant || typeof variant.key !== "string" || typeof variant.format !== "string" || typeof variant.mimeType !== "string" || !keyPattern.test(variant.key))) {
      throw new Error(`Audio deployment variants are invalid for ${item.id}.`);
    }
    if (!item.variants.some((variant) => variant.key === item.preferredKey)) throw new Error(`Preferred deployment key is missing for ${item.id}.`);
    if (byId.has(item.id)) throw new Error(`Duplicate ID in audio deployment map: ${item.id}`);
    byId.set(item.id, item);
  }
  return byId;
}

const deploymentById = await readAudioDeployment();

async function scan(kind) {
  const directory = join(sourceRoot, kind);
  const names = (await readdir(directory)).filter((name) => [".ogg", ".wav"].includes(extname(name).toLowerCase())).sort();
  return mapLimit(names, 16, async (filename) => {
    const absolute = join(directory, filename);
    const fileInfo = await stat(absolute);
    let metadata = { format: {} };
    try { metadata = await parseFile(absolute, { duration: true, skipCovers: true }); } catch {}
    const durationMs = Math.round((metadata.format.duration ?? 0) * 1000);
    const classification = kind === "music"
      ? { category: "music", reviewStatus: "auto" }
      : { category: "uncategorized", reviewStatus: "needs_review" };
    const sourceRelative = `${kind}/${filename}`;
    const id = stableId(kind, filename);
    const deployed = deploymentById?.get(id);
    if (deploymentById && !deployed) throw new Error(`Audio deployment map is missing ${sourceRelative}.`);
    const audio = deployed
      ? {
          preferredKey: deployed.preferredKey,
          variants: deployed.variants.map(({ key, format, mimeType }) => ({ key, format, mimeType })),
        }
      : {
          preferredKey: `source/${kind}/${filename}`,
          variants: [{ key: `source/${kind}/${filename}`, format: extname(filename).slice(1), mimeType: extname(filename).toLowerCase() === ".wav" ? "audio/wav" : "audio/ogg" }],
        };
    return {
      id,
      kind,
      title: titleFrom(filename),
      originalName: filename,
      durationMs,
      ...classification,
      tags: kind === "music" ? [classification.category] : [],
      audio,
      technical: {
        sampleRate: metadata.format.sampleRate ?? null,
        channels: metadata.format.numberOfChannels ?? null,
        size: fileInfo.size,
      },
    };
  });
}

await mkdir(outputRoot, { recursive: true });
const defaultRules = JSON.parse(await readFile(defaultRulesPath, "utf8"));
if (defaultRules.format !== "xunxian-sound-category-rules" || defaultRules.version !== 1 || !Array.isArray(defaultRules.rules)) {
  throw new Error("Default category rules use an unsupported format or version.");
}
for (const [index, rule] of defaultRules.rules.entries()) {
  if (!rule || typeof rule.id !== "string" || typeof rule.name !== "string" || typeof rule.pattern !== "string") {
    throw new Error(`Default category rule ${index + 1} is invalid.`);
  }
  new RegExp(rule.pattern, typeof rule.flags === "string" ? rule.flags : "i");
}
const defaultMusicRules = JSON.parse(await readFile(defaultMusicRulesPath, "utf8"));
if (defaultMusicRules.format !== "xunxian-music-category-rules" || defaultMusicRules.version !== 1 || !Array.isArray(defaultMusicRules.rules)) {
  throw new Error("Default music category rules use an unsupported format or version.");
}
for (const [index, rule] of defaultMusicRules.rules.entries()) {
  if (!rule || typeof rule.id !== "string" || typeof rule.name !== "string" || typeof rule.pattern !== "string") {
    throw new Error(`Default music category rule ${index + 1} is invalid.`);
  }
  new RegExp(rule.pattern, typeof rule.flags === "string" ? rule.flags : "i");
}
const [music, sound] = await Promise.all([scan("music"), scan("sound")]);
const categoryCounts = sound.reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] ?? 0) + 1 }), {});
const summary = {
  version: 1,
  generatedAt: new Date().toISOString(),
  counts: { music: music.length, sound: sound.length, total: music.length + sound.length },
  categoryCounts,
};
await Promise.all([
  writeFile(join(outputRoot, "catalog-summary.v1.json"), JSON.stringify(summary)),
  writeFile(join(outputRoot, "music.v1.json"), JSON.stringify(music)),
  writeFile(join(outputRoot, "sound.v1.json"), JSON.stringify(sound)),
  writeFile(join(outputRoot, "default-category-rules.v1.json"), JSON.stringify(defaultRules)),
  writeFile(join(outputRoot, "default-music-category-rules.v1.json"), JSON.stringify(defaultMusicRules)),
]);
console.log(`Catalog built: ${music.length} music tracks, ${sound.length} sound effects.`);
