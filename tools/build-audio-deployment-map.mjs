import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "generated/manifests/audio-v1.json");
const deploymentPath = resolve(projectRoot, "meta_data/audio-deployment-v1.json");
const allowlistPath = resolve(projectRoot, "apps/web/worker/audio-allowlist.v1.json");

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`);
  await rename(temporaryPath, path);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.format !== "xunxian-audio-transcode-manifest" || manifest.version !== 1 || manifest.complete !== true || !Array.isArray(manifest.items)) {
  throw new Error("A complete audio transcode manifest is required.");
}

const ids = new Set();
const hashesByKind = { music: new Set(), sound: new Set() };
const items = manifest.items.map((item) => {
  if (!item || !/^(mus|snd)_[a-f0-9]{12}$/.test(item.id) || !["music", "sound"].includes(item.kind)) {
    throw new Error("Audio manifest contains an invalid ID or kind.");
  }
  if (ids.has(item.id)) throw new Error(`Duplicate audio ID: ${item.id}`);
  ids.add(item.id);
  const hash = item.id.slice(4);
  const expectedPrefix = item.kind === "music" ? "mus_" : "snd_";
  if (!item.id.startsWith(expectedPrefix)) throw new Error(`Audio ID kind mismatch: ${item.id}`);
  const keyPattern = new RegExp(`^audio/v1/${item.kind}/${hash.slice(0, 2)}/${hash}\\.(opus|mp3)$`);
  if (!Array.isArray(item.variants) || item.variants.length !== 2 || item.variants.some((variant) => !keyPattern.test(variant.key))) {
    throw new Error(`Invalid deployment variants for ${item.id}`);
  }
  if (!item.variants.some((variant) => variant.key === item.preferredKey)) throw new Error(`Preferred key is missing for ${item.id}`);
  hashesByKind[item.kind].add(hash);
  return {
    id: item.id,
    preferredKey: item.preferredKey,
    variants: item.variants.map(({ key, format, mimeType }) => ({ key, format, mimeType })),
  };
}).sort((left, right) => left.id.localeCompare(right.id));

const deployment = {
  format: "xunxian-audio-deployment-map",
  version: 1,
  release: "v1",
  sourceCount: items.length,
  items,
};
const allowlist = {
  format: "xunxian-audio-allowlist",
  version: 1,
  release: "v1",
  music: [...hashesByKind.music].sort(),
  sound: [...hashesByKind.sound].sort(),
};

if (items.length !== 6414 || allowlist.music.length !== 148 || allowlist.sound.length !== 6266) {
  throw new Error(`Unexpected audio counts: ${items.length} total, ${allowlist.music.length} music, ${allowlist.sound.length} sound`);
}

await Promise.all([
  writeJsonAtomic(deploymentPath, deployment),
  writeJsonAtomic(allowlistPath, allowlist),
]);
console.log(`Audio deployment map built: ${items.length} sources.`);
