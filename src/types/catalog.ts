export type CatalogSection = "movie" | "series";

export type Subtitle = {
  name: string;
  url: string;
  language?: string;
  format: "srt" | "vtt" | "ass" | "ssa";
  isExternal: boolean;
};

export type MediaFile = {
  id: string;
  name: string;
  url: string;
  extension: string;
  size?: number;
  quality?: string;
  group?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  subtitles?: Subtitle[];
  audioMetadata?: string[];
};

export type CatalogItem = {
  id: string;
  title: string;
  originalTitle?: string;
  year?: number;
  type: CatalogSection;
  section: string;
  sourceId: string;
  sourceUrl: string;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  quality?: string;
  language?: string;
  region?: string;
  dualAudio?: boolean;
  date?: string;
  searchTerms?: string[];
  files: MediaFile[];
  seasons?: { seasonNumber: number; episodes: MediaFile[] }[];
};

export type Catalog = {
  version: number;
  generatedAt: string | null;
  items: CatalogItem[];
};

export type CollectionManifest = {
  id: string;
  name: string;
  type: CatalogSection;
  category: string;
  itemCount: number;
  url: string;
  urls?: string[];
  size?: number;
  hash?: string;
};

export type CatalogManifest = {
  version: number;
  generatedAt: string | null;
  totalContent: number;
  collections: CollectionManifest[];
  search: { urls: string[]; size?: number; hash?: string };
};

export type CatalogSummary = Omit<CatalogItem, "files" | "seasons"> & {
  detailUrl: string;
};

export type CatalogDetail = CatalogItem & {
  collectionId: string;
};

export type SearchRecord = {
  id: string;
  title: string;
  originalTitle?: string;
  year?: number;
  collectionId: string;
  type: CatalogSection;
  language?: string;
  quality?: string;
  detailUrl: string;
};
