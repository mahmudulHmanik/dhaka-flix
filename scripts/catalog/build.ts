import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DHAKAFLIX_SOURCES, type DhakaFlixSource } from "../../src/config/sources";
import type { Catalog, CatalogDetail, CatalogItem, CatalogManifest, CatalogSummary, MediaFile, SearchRecord, Subtitle } from "../../src/types/catalog";

const root = path.join(process.cwd(), "public", "catalog");
const legacyPath = path.join(process.cwd(), "public", "catalog.json");
const maxShardBytes = Number(process.env.CATALOG_MAX_SHARD_BYTES || 2_000_000);
const videoExtensions = new Set([".mkv", ".mp4", ".m4v", ".avi", ".webm", ".mov", ".ts"]);
const subtitleExtensions = new Set([".srt", ".vtt", ".ass", ".ssa"]);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const concurrency = Number(process.env.CATALOG_CONCURRENCY || 5);
const timeoutMs = Number(process.env.CATALOG_TIMEOUT_MS || 8000);

type Entry = { name: string; url: string; directory: boolean; size?: number };
type GeneratedCollection = { source: DhakaFlixSource; items: CatalogItem[] };

async function fetchText(url: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "DhakaFlix-Catalog/2.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw new Error("Unreachable");
}

function parseListing(html: string, baseUrl: string): Entry[] {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const rawHref = match[1];
    const label = stripTags(match[2]).trim();
    if (!rawHref || rawHref === "../" || rawHref.startsWith("#") || !label) continue;
    let url: URL;
    try { url = new URL(rawHref, baseUrl); } catch { continue; }
    if (url.origin !== new URL(baseUrl).origin || seen.has(url.href)) continue;
    seen.add(url.href);
    entries.push({
      name: decodeName(label.replace(/\/$/, "")),
      url: url.href,
      directory: rawHref.endsWith("/") || label.endsWith("/"),
      size: parseSize(match[0].match(/(?:fb-s|size)[^>]*>([^<]+)/i)?.[1])
    });
  }
  return entries;
}

function stripTags(value: string) { return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, "\""); }
function decodeName(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
function parseSize(value?: string) {
  if (!value) return undefined;
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return undefined;
  return Math.round(Number(match[1]) * 1024 ** ["B", "KB", "MB", "GB", "TB"].indexOf(match[2].toUpperCase()));
}
function extension(name: string) { return path.extname(name).toLowerCase(); }
function stableId(value: string) { return createHash("sha256").update(value).digest("hex").slice(0, 20); }
function contentHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function cleanTitle(name: string) { return name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").replace(/\b(2160p|1080p|720p|480p|bluray|webrip|web-dl|dual audio)\b/gi, "").replace(/\s+/g, " ").trim(); }
function parsedYear(value: string) { const year = value.match(/\b(19|20)\d{2}\b/); return year ? Number(year[0]) : undefined; }
function parsedQuality(value: string) { return value.match(/\b(2160p|1080p|720p|480p|4k)\b/i)?.[1].toUpperCase(); }
function collectionSlug(id: string) { return id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(); }
function detailUrl(id: string) { return `/catalog/details/${id}.json`; }
function toSubtitle(entry: Entry): Subtitle { return { name: entry.name, url: entry.url, format: extension(entry.name).slice(1) as Subtitle["format"], isExternal: true }; }

async function mapLimit<T, R>(values: T[], worker: (value: T) => Promise<R>, limit: number): Promise<R[]> {
  const output: R[] = [];
  let cursor = 0;
  async function run() { while (cursor < values.length) { const index = cursor++; output[index] = await worker(values[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return output;
}

async function crawl(source: DhakaFlixSource): Promise<CatalogItem[]> {
  const queue = [source.url];
  const files: Entry[] = [];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const entry of parseListing(await fetchText(current), current)) {
      if (entry.directory && visited.size < 1000) queue.push(entry.url);
      else if (videoExtensions.has(extension(entry.name))) files.push(entry);
    }
  }
  const items = new Map<string, CatalogItem>();
  for (const file of files) {
    const base = file.url.slice(0, file.url.lastIndexOf("/") + 1);
    const nearby = parseListing(await fetchText(base), base);
    const title = cleanTitle(file.name);
    const media: MediaFile = {
      id: stableId(file.url), name: file.name, url: file.url, extension: extension(file.name).slice(1),
      size: file.size, quality: parsedQuality(file.name),
      subtitles: nearby.filter((entry) => subtitleExtensions.has(extension(entry.name)) &&
        cleanTitle(entry.name).toLowerCase().startsWith(title.toLowerCase())).map(toSubtitle)
    };
    const key = `${source.id}:${title.toLowerCase()}`;
    const existing = items.get(key);
    if (existing) existing.files.push(media);
    else {
      const id = stableId(`${source.id}:${title}`);
      items.set(key, {
        id, title, originalTitle: title, year: parsedYear(file.name),
        type: source.category === "Series" || source.category === "Korean" || source.category === "Anime" ? "series" : "movie",
        section: source.category, sourceId: source.id, sourceUrl: file.url,
        posterUrl: nearby.find((entry) => imageExtensions.has(extension(entry.name)))?.url,
        quality: media.quality, language: source.category, date: new Date().toISOString(),
        searchTerms: [title, source.name], files: [media]
      });
    }
  }
  return [...items.values()];
}

function summary(item: CatalogItem): CatalogSummary {
  const { files: _files, seasons: _seasons, ...metadata } = item;
  return { ...metadata, detailUrl: detailUrl(item.id) };
}

function detail(item: CatalogItem, collectionId: string): CatalogDetail {
  return { ...item, collectionId };
}

async function readPrevious(): Promise<{ manifest?: CatalogManifest; items: Map<string, CatalogItem> }> {
  const items = new Map<string, CatalogItem>();
  try {
    const old = JSON.parse(await readFile(legacyPath, "utf8")) as Catalog;
    for (const item of old.items || []) items.set(item.id, item);
    console.warn(`Migrating legacy catalog.json (${(await stat(legacyPath)).size} bytes)`);
  } catch { /* no legacy catalog */ }
  try {
    const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as CatalogManifest;
    for (const collection of manifest.collections) {
      const files = await readdir(path.join(root, "collections")).catch(() => []);
      for (const file of files.filter((name) => name.startsWith(`${collection.id}.`) && name.endsWith(".json"))) {
        const shard = JSON.parse(await readFile(path.join(root, "collections", file), "utf8")) as CatalogSummary[];
        for (const item of shard) {
          try {
            const full = JSON.parse(await readFile(path.join(root, "details", `${item.id}.json`), "utf8")) as CatalogDetail;
            items.set(full.id, full);
          } catch { /* incomplete shard is replaced when its source succeeds */ }
        }
      }
    }
    return { manifest, items };
  } catch { return { items }; }
}

async function writeJson(filePath: string, value: unknown) {
  const content = `${JSON.stringify(value)}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    const previous = await readFile(filePath, "utf8");
    if (previous === content) return { size: Buffer.byteLength(content), hash: contentHash(content), changed: false };
  } catch { /* new output */ }
  await writeFile(filePath, content);
  return { size: Buffer.byteLength(content), hash: contentHash(content), changed: true };
}

async function main() {
  const previous = await readPrevious();
  const results = await mapLimit(DHAKAFLIX_SOURCES, async (source): Promise<GeneratedCollection | null> => {
    try { const items = await crawl(source); console.log(`✓ ${source.name}: ${items.length} titles`); return { source, items }; }
    catch (error) { console.error(`✗ ${source.name}: ${error instanceof Error ? error.message : String(error)}`); return null; }
  }, concurrency);
  const generatedBySource = new Map(results.filter(Boolean).map((result) => [result!.source.id, result!]));
  const itemsBySource = new Map<string, CatalogItem[]>();
  for (const source of DHAKAFLIX_SOURCES) {
    const generated = generatedBySource.get(source.id);
    if (generated) itemsBySource.set(source.id, generated.items);
    else itemsBySource.set(source.id, [...previous.items.values()].filter((item) => item.sourceId === source.id));
  }

  const search: SearchRecord[] = [];
  const collections = [];
  for (const source of DHAKAFLIX_SOURCES) {
    const id = collectionSlug(source.id);
    const items = itemsBySource.get(source.id) || [];
    const summaries = items.map(summary);
    const chunks: CatalogSummary[][] = [];
    let chunk: CatalogSummary[] = [];
    for (const item of summaries) {
      const next = [...chunk, item];
      if (chunk.length && Buffer.byteLength(JSON.stringify(next)) > maxShardBytes) { chunks.push(chunk); chunk = [item]; }
      else chunk = next;
    }
    if (chunk.length || !chunks.length) chunks.push(chunk);
    let totalSize = 0;
    let firstHash = "";
    for (let index = 0; index < chunks.length; index += 1) {
      const fileName = chunks.length === 1 ? `${id}.json` : `${id}.${index + 1}.json`;
      const result = await writeJson(path.join(root, "collections", fileName), chunks[index]);
      totalSize += result.size;
      firstHash ||= result.hash;
    }
    for (const item of items) {
      await writeJson(path.join(root, "details", `${item.id}.json`), detail(item, id));
      search.push({ id: item.id, title: item.title, originalTitle: item.originalTitle, year: item.year, collectionId: id, type: item.type, language: item.language, quality: item.quality, detailUrl: detailUrl(item.id) });
    }
    const urls = chunks.map((_, index) => `/catalog/collections/${chunks.length === 1 ? `${id}.json` : `${id}.${index + 1}.json`}`);
    collections.push({ id, name: source.name, type: items[0]?.type || (source.category === "Series" ? "series" : "movie"), category: source.category, itemCount: items.length, url: urls[0], urls, size: totalSize, hash: firstHash });
  }
  const searchChunks: SearchRecord[][] = [];
  let searchChunk: SearchRecord[] = [];
  for (const record of search) {
    const next = [...searchChunk, record];
    if (searchChunk.length && Buffer.byteLength(JSON.stringify(next)) > maxShardBytes) {
      searchChunks.push(searchChunk);
      searchChunk = [record];
    } else searchChunk = next;
  }
  if (searchChunk.length || !searchChunks.length) searchChunks.push(searchChunk);
  const searchResults = [];
  for (let index = 0; index < searchChunks.length; index += 1) {
    const fileName = searchChunks.length === 1 ? "search.json" : `search.${index + 1}.json`;
    const result = await writeJson(path.join(root, "indexes", fileName), searchChunks[index]);
    searchResults.push({ url: `/catalog/indexes/${fileName}`, ...result });
  }
  const manifest: CatalogManifest = {
    version: 2, generatedAt: new Date().toISOString(), totalContent: search.length, collections,
    search: { urls: searchResults.map((result) => result.url), size: searchResults.reduce((total, result) => total + result.size, 0), hash: searchResults[0]?.hash }
  };
  await writeJson(path.join(root, "manifest.json"), manifest);
  const generatedFiles = collections.reduce((total, collection) => total + (collection.urls?.length || 1), 0) + searchResults.length + search.length;
  console.log(`Generated ${search.length} content records across ${collections.length} collections.`);
  console.log(`Generated ${generatedFiles} catalog files (details, collection shards, search shards, and manifest).`);
  console.log(`Maximum shard target: ${maxShardBytes} bytes; search shards: ${searchResults.length}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
