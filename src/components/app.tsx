"use client";

import { useEffect, useMemo, useState } from "react";
import { DHAKAFLIX_SOURCES } from "@/config/sources";
import { fetchJson, formatSize, isDetail, isManifest, isSearchRecord, isSummary } from "@/lib/catalog";
import type { CatalogDetail, CatalogManifest, CatalogSummary, CollectionManifest, MediaFile, SearchRecord } from "@/types/catalog";

type View = "home" | "movies" | "series" | "watchlist" | "diagnostics";
type HistoryEntry = { itemId: string; fileId: string; progress: number; updatedAt: number };
const icons = { play: "▶", search: "⌕", heart: "♡", check: "✓", arrow: "→", pulse: "◉" };
const summaryCache = new Map<string, CatalogSummary[]>();
const detailCache = new Map<string, CatalogDetail>();

export function App() {
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [view, setView] = useState<View>("home");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogSummary[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRecord[]>([]);
  const [selected, setSelected] = useState<CatalogDetail | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => readLocal<string[]>("dhakaflix:watchlist", []));
  const [history, setHistory] = useState<HistoryEntry[]>(() => readLocal<HistoryEntry[]>("dhakaflix:history", []));
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, "checking" | "online" | "offline">>({});

  useEffect(() => {
    fetchJson<unknown>("/catalog/manifest.json").then((value) => {
      if (!isManifest(value)) throw new Error("Invalid catalog manifest");
      setManifest(value);
      const first = value.collections.find((collection) => collection.itemCount > 0) || value.collections[0];
      if (first) void loadCollection(first);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load catalog manifest"));
  }, []);

  async function loadCollection(collection: CollectionManifest) {
    setCollectionId(collection.id); setError(null);
    try {
      let loaded = summaryCache.get(collection.id);
      if (!loaded) {
        const urls = collection.urls || [collection.url];
        const shards: CatalogSummary[][] = [];
        for (const url of urls) {
          try {
            const value = await fetchJson<unknown>(url);
            if (!Array.isArray(value) || !value.every(isSummary)) break;
            shards.push(value);
          } catch { break; }
        }
        loaded = shards.flat();
        summaryCache.set(collection.id, loaded);
      }
      setItems(loaded);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load collection"); }
  }

  useEffect(() => {
    if (!query.trim() || !manifest) return;
    const timer = window.setTimeout(() => {
      fetchJson<unknown>(manifest.search.urls[0]).then((value) => {
        if (!Array.isArray(value) || !value.every(isSearchRecord)) throw new Error("Invalid search index");
        const needle = query.trim().toLowerCase();
        setSearchResults(value.filter((item) => `${item.title} ${item.originalTitle || ""}`.toLowerCase().includes(needle)));
      }).catch(() => setSearchResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [manifest, query]);

  async function openItem(summary: Pick<CatalogSummary, "id" | "detailUrl">) {
    try {
      const cached = detailCache.get(summary.id);
      let detail = cached;
      if (!detail) {
        const value = await fetchJson<unknown>(summary.detailUrl);
        if (!isDetail(value)) throw new Error("Invalid detail record");
        detail = value;
        detailCache.set(summary.id, detail);
      }
      setSelected(detail);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load title"); }
  }

  function toggleWatchlist(id: string) {
    const next = watchlist.includes(id) ? watchlist.filter((value) => value !== id) : [...watchlist, id];
    setWatchlist(next); localStorage.setItem("dhakaflix:watchlist", JSON.stringify(next));
  }

  const visible = useMemo(() => query.trim() ? searchResults.filter((item) => view === "movies" ? item.type === "movie" : view === "series" ? item.type === "series" : view === "watchlist" ? watchlist.includes(item.id) : true) : items.filter((item) => view === "movies" ? item.type === "movie" : view === "series" ? item.type === "series" : view === "watchlist" ? watchlist.includes(item.id) : true), [items, query, searchResults, view, watchlist]);
  const activeCollection = manifest?.collections.find((collection) => collection.id === collectionId);

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => { setView("home"); setSelected(null); }}><span className="brand-mark">D</span><span>Dhaka<span className="brand-accent">Flix</span></span></button><nav className="main-nav" aria-label="Primary navigation"><button className={view === "home" ? "nav-link active" : "nav-link"} onClick={() => setView("home")}>Home</button><button className={view === "movies" ? "nav-link active" : "nav-link"} onClick={() => setView("movies")}>Movies</button><button className={view === "series" ? "nav-link active" : "nav-link"} onClick={() => setView("series")}>Series</button><button className={view === "watchlist" ? "nav-link active" : "nav-link"} onClick={() => setView("watchlist")}>Watchlist</button></nav><div className="top-actions"><label className="search-box"><span>{icons.search}</span><input aria-label="Search library" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all titles..." /></label><button className="icon-button" title="Diagnostics" onClick={() => setView("diagnostics")}>{icons.pulse}</button></div></header>
    {selected ? <Detail item={selected} isSaved={watchlist.includes(selected.id)} onBack={() => setSelected(null)} onToggle={() => toggleWatchlist(selected.id)} history={history} /> : view === "diagnostics" ? <Diagnostics statuses={diagnostics} setStatuses={setDiagnostics} /> : <main>{view === "home" && <Hero total={manifest?.totalContent || 0} onExplore={() => { const first = manifest?.collections.find((collection) => collection.itemCount > 0) || manifest?.collections[0]; if (first) void loadCollection(first); setView("movies"); }} />}{error && <div className="error-banner">{error}</div>}<div className="content-wrap"><div className="section-heading"><div><p className="eyebrow">{query ? "SEARCHING ALL COLLECTIONS" : activeCollection?.name || "YOUR LIBRARY"}</p><h1>{query ? "Search results" : view === "home" ? "Browse the latest" : view === "watchlist" ? "Your watchlist" : `${view === "movies" ? "Movies" : "Series"} library`}</h1></div><span className="catalog-count">{query ? searchResults.length : view === "home" ? manifest?.totalContent || 0 : activeCollection?.itemCount ?? visible.length} titles</span></div>{!query && manifest && view !== "watchlist" && <div className="collection-tabs">{manifest.collections.map((collection) => <button key={collection.id} className={collection.id === collectionId ? "collection-tab active" : "collection-tab"} onClick={() => void loadCollection(collection)}>{collection.name}<small>{collection.itemCount}</small></button>)}</div>}{visible.length ? <div className="card-grid">{visible.slice(0, 100).map((item) => <MediaCard key={item.id} item={item} saved={watchlist.includes(item.id)} onOpen={() => void openItem(item)} onToggle={() => toggleWatchlist(item.id)} />)}</div> : <EmptyState query={query} manifest={manifest} />}</div></main>}<footer className="footer"><span><strong>DhakaFlix</strong> · {manifest ? `${manifest.totalContent.toLocaleString()} catalog records` : "loading catalog manifest"}</span><button onClick={() => setView("diagnostics")}>Check connectivity {icons.arrow}</button></footer>
  </div>;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value as T;
  } catch {
    return fallback;
  }
}

function Hero({ total, onExplore }: { total: number; onExplore: () => void }) { return <section className="hero"><div className="hero-glow" /><div className="hero-copy"><p className="eyebrow">BDIX MEDIA LIBRARY · SHARDED CATALOG</p><h2>Entertainment,<br /><em>closer to home.</em></h2><p className="hero-description">A lightweight catalog browser that loads only the manifest and the collection you choose. Playback always stays direct to the original BDIX source.</p><div className="hero-actions"><button className="primary-button" onClick={onExplore}>{icons.play} Explore library</button><button className="secondary-button">{total.toLocaleString()} titles indexed</button></div></div><div className="hero-stat"><span className="stat-number">{total ? total.toLocaleString() : "—"}</span><span>titles<br />indexed</span></div></section>; }
function MediaCard({ item, saved, onOpen, onToggle }: { item: CatalogSummary | SearchRecord; saved: boolean; onOpen: () => void; onToggle: () => void }) { return <article className="media-card"><button className="poster" onClick={onOpen} aria-label={`Open ${item.title}`}><div className="poster-noise" /><span className="poster-initial">{item.title.slice(0, 1).toUpperCase()}</span><span className="play-overlay">{icons.play}</span><span className="type-badge">{item.type}</span></button><div className="card-meta"><div><h3>{item.title}</h3><p>{item.year || "Year unknown"} <span>·</span> {item.quality || "Source quality"}</p></div><button className={saved ? "save-button saved" : "save-button"} onClick={onToggle} aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}>{saved ? icons.check : icons.heart}</button></div></article>; }
function Detail({ item, isSaved, onBack, onToggle, history }: { item: CatalogDetail; isSaved: boolean; onBack: () => void; onToggle: () => void; history: HistoryEntry[] }) { const [file, setFile] = useState<MediaFile | null>(null); return <main className="detail-page"><button className="back-button" onClick={onBack}>← Back to library</button><div className="detail-layout"><div className="detail-poster poster"><span className="poster-initial">{item.title.slice(0, 1)}</span></div><div className="detail-copy"><p className="eyebrow">{item.section} · {item.type}</p><h1>{item.title}</h1><p className="detail-facts">{item.year || "Year unknown"} <span>·</span> {item.quality || "Original quality"} <span>·</span> {item.language || "Language varies"}</p><p className="detail-overview">{item.overview || "Metadata will appear here when the source provides it. Playback uses the original configured BDIX URL."}</p><div className="hero-actions"><button className="primary-button" onClick={() => setFile(item.files[0] || null)} disabled={!item.files.length}>{icons.play} {item.files.length ? "Play now" : "No media found"}</button><button className="secondary-button" onClick={onToggle}>{isSaved ? icons.check : icons.heart} {isSaved ? "Saved" : "Watchlist"}</button></div><div className="source-note"><span className="status-dot" /> Direct source · {item.sourceUrl}</div></div></div>{file && <Player item={item} file={file} history={history} onClose={() => setFile(null)} />}{item.files.length > 1 && <div className="episode-list"><h2>Available files <span>{item.files.length}</span></h2>{item.files.map((entry) => <button className="episode-row" key={entry.id} onClick={() => setFile(entry)}><span className="episode-number">{entry.episodeNumber ?? "—"}</span><span>{entry.name}</span><small>{entry.extension.toUpperCase()} {formatSize(entry.size) || ""}</small></button>)}</div>}</main>; }
function Player({ item, file, history, onClose }: { item: CatalogDetail; file: MediaFile; history: HistoryEntry[]; onClose: () => void }) { return <div className="player-panel"><div className="player-header"><span>Now playing · {file.name}</span><button onClick={onClose}>Close</button></div><video controls playsInline src={file.url} poster={item.posterUrl} onTimeUpdate={(event) => { const video = event.currentTarget; if (video.currentTime > 5) localStorage.setItem("dhakaflix:history", JSON.stringify([{ itemId: item.id, fileId: file.id, progress: video.currentTime, updatedAt: Date.now() }, ...history.filter((entry) => entry.fileId !== file.id)].slice(0, 100))); }} /><div className="player-help">Unsupported browser format? Open <a href={file.url} target="_blank" rel="noreferrer">the original URL</a> in VLC or MPV.</div></div>; }
function EmptyState({ query, manifest }: { query: string; manifest: CatalogManifest | null }) { return <div className="empty-state"><div className="empty-icon">◌</div><h2>{query ? "No titles found" : manifest ? "No titles in this collection" : "Loading catalog"}</h2><p>{query ? `Nothing matched “${query}”. Try a different title or spelling.` : "Choose another collection or refresh the catalog from a BDIX-connected computer."}</p></div>; }
function Diagnostics({ statuses, setStatuses }: { statuses: Record<string, "checking" | "online" | "offline">; setStatuses: React.Dispatch<React.SetStateAction<Record<string, "checking" | "online" | "offline">>> }) { async function check(id: string, url: string) { setStatuses((current) => ({ ...current, [id]: "checking" })); try { await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(6000) }); setStatuses((current) => ({ ...current, [id]: "online" })); } catch { setStatuses((current) => ({ ...current, [id]: "offline" })); } } return <main className="diagnostics-page"><div className="section-heading"><div><p className="eyebrow">NETWORK TOOLS</p><h1>BDIX diagnostics</h1><p className="page-intro">Tests run from your browser. Reachability does not guarantee CORS, mixed-content, or range-request support.</p></div></div><div className="diagnostic-list">{DHAKAFLIX_SOURCES.map((source) => <div className="diagnostic-row" key={source.id}><span className={statuses[source.id] === "online" ? "status-dot online" : statuses[source.id] === "offline" ? "status-dot offline" : "status-dot"} /><div><strong>{source.name}</strong><small>{source.url}</small></div><span className="diagnostic-status">{statuses[source.id] || "Not tested"}</span><button className="secondary-button small-button" onClick={() => void check(source.id, source.url)}>Test source</button></div>)}</div><div className="warning-box"><strong>Browser boundary</strong><p>Private HTTP sources may be blocked from an HTTPS deployment. DhakaFlix never proxies media through Vercel.</p></div></main>; }
