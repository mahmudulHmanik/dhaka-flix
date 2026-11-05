# DhakaFlix

DhakaFlix is a Vercel-hosted catalog and direct-play browser for the configured DhakaFlix BDIX sources. Vercel serves the application and generated JSON only; media URLs remain original source URLs and are requested by the visitor's browser.

## Local development

```bash
npm install
npm run dev
```

The committed catalog starts with a tiny empty manifest intentionally. A catalog must be generated from a computer connected to the BDIX network. The browser fetches only `public/catalog/manifest.json` on startup.

## Refreshing the catalog

```bash
npm run catalog:build
```

The crawler reads the typed source list in `src/config/sources.ts`, follows directory listings with bounded concurrency, and writes collection shards under `public/catalog/collections/`, detail records under `public/catalog/details/`, a compact search index under `public/catalog/indexes/`, and `public/catalog/manifest.json`. Collection shards target a maximum of 2 MB (`CATALOG_MAX_SHARD_BYTES` can override this). It keeps valid data for sources that fail and reports failures. If an older `public/catalog.json` exists, the next catalog build migrates it before replacing the monolith. Commit the generated JSON, then deploy to Vercel.

The UI loads a collection shard only when that collection is selected. Detail records, including episode/file metadata, load only when a title is opened. Search loads its compact index only after the user starts typing and does not include episode lists or media metadata. Loaded collection and detail records are kept in small in-memory caches to avoid duplicate parsing.

Playback is direct browser playback. MP4/WebM files supported by the browser use native controls; unsupported containers such as many MKV and AVI files expose their original URL for VLC/MPV. The app never proxies, transcodes, or streams media through Vercel.

## Browser limitations

The listed sources are private HTTP addresses. An HTTPS deployment may be blocked by mixed-content or private-network protections, and CORS/range support is controlled by each source server. The Diagnostics page tests reachability from the current browser and explains this boundary; it does not attempt to bypass browser security.

## Catalog size report

The former monolith was `public/catalog.json`, measured at 19,418,590 bytes (18.52 MiB), and contained complete content records with embedded media files and subtitles. The refactored output is data-dependent: run `npm run catalog:build` to print generated counts and inspect the generated shard sizes. The initial page request is the manifest only; no catalog content is bundled into the application.
