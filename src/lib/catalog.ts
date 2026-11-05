import type { CatalogDetail, CatalogManifest, CatalogSummary, SearchRecord } from "@/types/catalog";

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function isManifest(value: unknown): value is CatalogManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CatalogManifest>;
  return typeof candidate.version === "number" && Array.isArray(candidate.collections) &&
    typeof candidate.totalContent === "number";
}

export function isSummary(value: unknown): value is CatalogSummary {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CatalogSummary>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.detailUrl === "string";
}

export function isDetail(value: unknown): value is CatalogDetail {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CatalogDetail>;
  return typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.files);
}

export function isSearchRecord(value: unknown): value is SearchRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SearchRecord>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.collectionId === "string";
}

export function formatSize(bytes?: number) {
  if (!bytes || bytes < 1) return undefined;
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
