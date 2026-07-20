import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  AUDIO_RELEASE,
  TRANSCODE_VERSION,
  audioObjectKey,
  outputRelativePath,
  stableAudioIdentity,
} from "./audio-paths.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "original_data");
const generatedRoot = join(projectRoot, "generated");
const audioRoot = join(generatedRoot, "audio");
const manifestPath = join(generatedRoot, "manifests", `audio-${AUDIO_RELEASE}.json`);
const reportsRoot = join(generatedRoot, "reports");

function parseArgs(argv) {
  const options = {
    force: false,
    formats: ["opus", "mp3"],
    jobs: Math.max(1, Math.min(4, Math.floor(cpus().length / 2))),
    limit: null,
  };
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--force") options.force = true;
    else if (arg.startsWith("--formats=")) options.formats = arg.slice(10).split(",").filter(Boolean);
    else if (arg.startsWith("--jobs=")) options.jobs = Number(arg.slice(7));
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice(8));
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.formats.length || options.formats.some((format) => !["opus", "mp3"].includes(format))) {
    throw new Error("--formats must contain opus, mp3, or both");
  }
  options.formats = [...new Set(options.formats)];
  if (!Number.isInteger(options.jobs) || options.jobs < 1 || options.jobs > 16) {
    throw new Error("--jobs must be an integer between 1 and 16");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return options;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stderr);
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`));
    });
  });
}

async function assertTool(command) {
  await run(command, ["-version"]);
}

async function sha256(path) {
  const handle = await open(path, "r");
  const hash = createHash("sha256");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

async function probeDurationMs(path) {
  let output = "";
  await new Promise((resolvePromise, reject) => {
    const child = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      path,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(`ffprobe exited with ${code}: ${stderr.trim()}`)));
  });
  const duration = Number(output.trim());
  if (!Number.isFinite(duration) || duration < 0) throw new Error(`Invalid duration reported for ${path}`);
  return Math.round(duration * 1000);
}

async function scanSources() {
  const sources = [];
  for (const kind of ["music", "sound"]) {
    const directory = join(sourceRoot, kind);
    for (const name of (await readdir(directory)).sort()) {
      if (![".ogg", ".wav"].includes(extname(name).toLowerCase())) continue;
      const sourceRelative = `${kind}/${name}`;
      const identity = stableAudioIdentity(sourceRelative);
      const absolute = join(directory, name);
      const info = await stat(absolute);
      if (!info.isFile()) continue;
      sources.push({ ...identity, absolute, size: info.size, mtimeMs: Math.round(info.mtimeMs) });
    }
  }
  const ids = new Set();
  for (const source of sources) {
    if (ids.has(source.id)) throw new Error(`Stable audio ID collision: ${source.id}`);
    ids.add(source.id);
  }
  return sources;
}

async function readPreviousManifest() {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return new Map();
    return new Map(parsed.items.map((item) => [item.source.relativePath, item]));
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

function ffmpegArgs(source, format, temporaryPath) {
  const bitrate = source.kind === "music"
    ? (format === "opus" ? "112k" : "128k")
    : (format === "opus" ? "64k" : "96k");
  const codecArgs = format === "opus"
    ? ["-c:a", "libopus", "-b:a", bitrate, "-vbr", "on", "-compression_level", "10"]
    : ["-c:a", "libmp3lame", "-b:a", bitrate, "-write_xing", "1"];
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", source.absolute,
    "-map", "0:a:0", "-vn", "-map_metadata", "-1",
    ...codecArgs,
    temporaryPath,
  ];
}

async function transcodeVariant(source, format) {
  const outputRelative = outputRelativePath(source.source, format);
  const outputAbsolute = join(audioRoot, outputRelative);
  await mkdir(dirname(outputAbsolute), { recursive: true });
  const temporaryPath = join(dirname(outputAbsolute), `.${source.hash}-${process.pid}-${Date.now()}.${format}`);
  try {
    await run("ffmpeg", ffmpegArgs(source, format, temporaryPath));
    const info = await stat(temporaryPath);
    if (!info.isFile() || info.size === 0) throw new Error("FFmpeg produced an empty output");
    const durationMs = await probeDurationMs(temporaryPath);
    await rename(temporaryPath, outputAbsolute);
    return {
      format,
      mimeType: format === "opus" ? "audio/ogg; codecs=opus" : "audio/mpeg",
      key: audioObjectKey(source.source, format),
      relativePath: `audio/${outputRelative}`,
      size: info.size,
      sha256: await sha256(outputAbsolute),
      durationMs,
    };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function existingVariant(source, format, previous, sourceHash, force) {
  if (force || !previous || previous.transcodeVersion !== TRANSCODE_VERSION || previous.source.sha256 !== sourceHash) return null;
  const variant = previous.variants?.find((entry) => entry.format === format);
  if (!variant) return null;
  const expectedKey = audioObjectKey(source.source, format);
  if (variant.key !== expectedKey) return null;
  const absolute = join(generatedRoot, variant.relativePath);
  try {
    const info = await stat(absolute);
    if (!info.isFile() || info.size !== variant.size) return null;
    return variant;
  } catch {
    return null;
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await Promise.all([assertTool("ffmpeg"), assertTool("ffprobe")]);
  let sources = await scanSources();
  const fullSourceCount = sources.length;
  if (options.limit !== null) sources = sources.slice(0, options.limit);
  const previous = await readPreviousManifest();
  const failures = [];
  let completed = 0;
  let transcoded = 0;
  let reused = 0;
  const startedAt = new Date().toISOString();

  console.log(`Audio transcode ${AUDIO_RELEASE}: ${sources.length}/${fullSourceCount} sources, ${options.formats.join("+")}, ${options.jobs} jobs`);
  const items = await mapLimit(sources, options.jobs, async (source) => {
    try {
      const sourceHash = await sha256(source.absolute);
      const sourceDurationMs = await probeDurationMs(source.absolute);
      const previousItem = previous.get(source.source);
      const variants = [];
      for (const format of options.formats) {
        const cached = await existingVariant(source, format, previousItem, sourceHash, options.force);
        if (cached) {
          variants.push(cached);
          reused++;
        } else {
          const variant = await transcodeVariant(source, format);
          const tolerance = Math.max(500, Math.round(sourceDurationMs * 0.02));
          if (Math.abs(variant.durationMs - sourceDurationMs) > tolerance) {
            throw new Error(`Duration mismatch for ${format}: source=${sourceDurationMs}ms output=${variant.durationMs}ms`);
          }
          variants.push(variant);
          transcoded++;
        }
      }
      completed++;
      if (completed % 100 === 0 || completed === sources.length) {
        console.log(`[${completed}/${sources.length}] ${source.source}`);
      }
      return {
        id: source.id,
        kind: source.kind,
        transcodeVersion: TRANSCODE_VERSION,
        source: {
          relativePath: source.source,
          size: source.size,
          mtimeMs: source.mtimeMs,
          sha256: sourceHash,
          durationMs: sourceDurationMs,
        },
        preferredKey: variants.find((variant) => variant.format === "opus")?.key ?? variants[0].key,
        variants,
      };
    } catch (error) {
      failures.push({ source: source.source, error: error instanceof Error ? error.message : String(error) });
      console.error(`FAILED ${source.source}: ${failures.at(-1).error}`);
      return null;
    }
  });

  await mkdir(reportsRoot, { recursive: true });
  const failureCsv = ["source,error", ...failures.map((failure) => `${csvEscape(failure.source)},${csvEscape(failure.error)}`)].join("\n");
  await writeFile(join(reportsRoot, "transcode-failures.csv"), `${failureCsv}\n`);

  const successfulItems = items.filter(Boolean);
  const totalOutputBytes = successfulItems.flatMap((item) => item.variants).reduce((sum, variant) => sum + variant.size, 0);
  const summary = [
    "# Audio transcode size summary",
    "",
    `- Release: ${AUDIO_RELEASE}`,
    `- Sources selected: ${sources.length} of ${fullSourceCount}`,
    `- Successful sources: ${successfulItems.length}`,
    `- Failed sources: ${failures.length}`,
    `- Variants transcoded: ${transcoded}`,
    `- Variants reused: ${reused}`,
    `- Generated size: ${(totalOutputBytes / 1048576).toFixed(3)} MiB`,
    "",
  ].join("\n");
  await writeFile(join(reportsRoot, "size-summary.md"), summary);

  if (failures.length) {
    console.error(`Transcode failed for ${failures.length} source(s). Manifest was not replaced.`);
    process.exitCode = 1;
    return;
  }

  const manifest = {
    format: "xunxian-audio-transcode-manifest",
    version: 1,
    release: AUDIO_RELEASE,
    transcodeVersion: TRANSCODE_VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    complete: sources.length === fullSourceCount,
    sourceCount: successfulItems.length,
    formats: options.formats,
    items: successfulItems,
  };
  await writeJsonAtomic(manifestPath, manifest);
  console.log(`Done: ${successfulItems.length} sources, ${transcoded} transcoded, ${reused} reused, ${(totalOutputBytes / 1048576).toFixed(3)} MiB`);
  console.log(`Manifest: ${relative(projectRoot, manifestPath)}`);
}

await main();
