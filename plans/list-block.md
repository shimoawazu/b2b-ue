# Plan: List Block (b2b-ue)

## Overview

The `list` block dynamically renders child pages under a configurable root path — equivalent to the AEM Core Components List component. Authors configure it in Universal Editor; the block fetches and renders pages at runtime from the appropriate data source depending on environment.

---

## Two-Environment Strategy

| Environment | Data source | Pages shown |
|---|---|---|
| Author (`adobeaemcloud.com`) | Sling GET `.2.json` on JCR path | All pages (drafts + published) |
| Local dev (`localhost:3000`) | `/{rootPath}/query-index.json` via ffetch | Published only |
| Preview (`*.aem.page`) | `/{rootPath}/query-index.json` via ffetch | Published only |
| Live (`*.aem.live`) | `/{rootPath}/query-index.json` via ffetch | Published only |

### Author path resolution

The EDS rootPath (e.g. `/en/news`) maps to a JCR path by extracting the content root prefix from `window.location.pathname` and appending the rootPath segments after the language code.

Example: `window.location.pathname = /content/b2b-ue/us/en/home.html`, `rootPath = /en/news`
→ JCR target: `/content/b2b-ue/us/en/news.2.json`

---

## Author-Tier Image Strategy

### Problem (old approach — removed)

The original implementation fetched each article's rendered HTML to parse the `og:image` meta tag:

```js
// BAD — N full server-side page renders blocking the author request queue
await Promise.all(pages.map(async (page) => {
  const resp = await fetch(`${page.jcrPath}.html`);
  const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
  page.image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
}));
```

With 10 news articles this fires 10 simultaneous full-page renders on the AEM author, saturating the request queue and blocking the entire page load in Universal Editor and preview mode.

### Solution (current approach)

The featured image is stored as a **flat `featuredImage` property on `jcr:content`** via a `reference` field in the page-metadata Article tab. Since `.2.json` (depth=2) already returns all `jcr:content` properties, the image is available for free — no extra requests:

```js
// GOOD — zero extra fetches, image is already in the .2.json response
const image = content.featuredImage || '';
```

On the published/EDS side, `og:image` in `query-index.json` already contains the image URL — no change needed.

### Author workflow

Authors set the featured image once per article page in UE → page properties → Article tab → Featured Image field. The list block reads it automatically.

---

## Locale-Aware Root Path

The block automatically localizes `rootPath` to match the current page locale before fetching. This means a single block configuration works across all 8 language variants without any per-locale authoring.

### `localizeRootPath(rootPath)` logic

| Authored value | Current page locale | Resolved path |
|---|---|---|
| `/en/news` | `ja` | `/ja/news` |
| `/news` | `ja` | `/ja/news` |
| `/ja/news` | `ja` | `/ja/news` (unchanged) |
| `/en/products` | `zh` | `/zh/products` |

**Rule:** If the first path segment matches `[a-z]{2,4}` (a language code), it is replaced with the current locale. Otherwise, the current locale is prepended.

The current locale is read from `document.documentElement.lang` (set by `scripts.js`) with a fallback to the first segment of `window.location.pathname`.

### Author-tier path resolution

After localization, `resolveJcrRoot` maps the localized EDS path to the correct JCR content path on the author tier using `window.location.pathname`.

---

## Block Configuration (Universal Editor)

| Field | Index | Type | Default | Description |
|---|---|---|---|---|
| `rootPath` | 0 | text | `/news` | EDS path whose children to list. Locale prefix is auto-applied — author as `/news` or `/en/news`; both work on any locale |
| `sortBy` | 1 | select | `alphabetical` | `alphabetical` \| `lastModified` \| `listOrder` |
| `showDescription` | 2 | boolean | false | Include page description |
| `showImage` | 3 | boolean | false | Include featured image |
| `showDate` | 4 | boolean | false | Include last modified date |
| `limit` | 5 | number | 0 | Max items (0 = no limit) |
| `paginate` | 6 | boolean | false | Enable pagination |
| `pageSize` | 7 | number | 5 | Items per page |
| `urlState` | 8 | boolean | false | Persist page in `?page=N` URL |
| `listStyle` | 9 | select | `card` | `card` \| `small` \| `medium` \| `news-featured` \| `footer-nav` |
| `readMoreText` | 10 | text | — | Read-more label (news-featured only) |
| `heading` | 11 | text | — | Column heading (footer-nav only) |

**Field index stability is critical.** Adding new fields must always append at the end (highest index). Inserting at the beginning or middle shifts all subsequent indices and breaks every existing list block in JCR — AEM renders properties in model field order, and `readConfig` reads by positional index.

---

## List Styles

| Value | Layout |
|---|---|
| `card` | Responsive grid (1→2→3 columns), 16:9 image above text |
| `small` | Compact vertical rows with small square thumbnail |
| `medium` | Vertical rows with wider left-side image, border + hover shadow |
| `news-featured` | First item featured (large), rest secondary. Shows image, category badge, date, description, read-more link |
| `footer-nav` | Plain link list with gold column heading. No image/date/description. Used in footer fragment |

---

## Sort Options

| Mode | Author (JCR) | EDS (query-index) |
|---|---|---|
| `alphabetical` | `jcr:content['jcr:title']` | `title` field |
| `lastModified` | `jcr:content['cq:lastModified']` | `lastModified` field |
| `listOrder` | `jcr:content.listOrder` (numeric) | `listOrder` field |

`listOrder`: numeric values sort ascending; pages without a value sort alphabetically at the end.

---

## EDS Query Index

The block uses a **path-scoped index** (`/{rootPath}/query-index.json`) for small payloads. Falls back to the full language index (`/{lang}/query-index.json`) with path-prefix filtering if no scoped index exists.

A `helix-query.yaml` entry is required per section per language for scoped indexing.
The `<<: *base-site` anchor merge must be at the **index level**, not inside `properties:` —
placing it inside `properties:` merges the entire `site-en` mapping into the properties
section, producing invalid property definitions and an empty/missing index:

```yaml
# CORRECT — merge at index level, inherits all properties from *base-site
news-en:
  <<: *base-site
  include:
    - '/en/news/**'
  target: /en/news/query-index.json

# WRONG — merges include/exclude/target/properties keys INTO properties section
news-en:
  include:
    - '/en/news/**'
  target: /en/news/query-index.json
  properties:
    <<: *base-site   # ← do NOT do this
```

The `listOrder` and `category` properties must be added to the `&base-site` anchor so all
language indices inherit them:

```yaml
listOrder:
  select: head > meta[name="listorder"]
  value: attribute(el, "content")
category:
  select: head > meta[name="category"]
  value: attribute(el, "content")
```

---

## page-metadata Model (Article Tab)

The following fields in `models/_component-models.json` → `page-metadata` support the list block:

| Field | Type | Purpose |
|---|---|---|
| `featuredImage` | reference | Thumbnail for list cards. Stored flat on `jcr:content` — read directly from `.2.json` without extra fetches |
| `cq:tags` | aem-tag | Category badge on news-featured cards |
| `category` | text | Plain-text fallback for category (used by query index) |
| `listOrder` | number | Explicit sort order for `listOrder` sort mode |
| `hideInNav` | boolean | Exclude from dynamic navigation (not directly used by list block) |

---

## Files

| File | Role |
|---|---|
| `blocks/list/list.js` | Block decorator — `readConfig`, two-env fetch, sort, render |
| `blocks/list/list.css` | Styles for all list styles |
| `blocks/list/_list.json` | Block definition + template defaults (models section NOT used by build) |
| `models/_component-models.json` | `list` model fields (authoritative source) + `page-metadata` Article tab fields |
| `models/_component-filters.json` | `list` registered in section components |

---

## Known Limitations

- Only **direct children** of `rootPath` are listed (`.2.json` depth=2, one level of children).
- `rootPath` is auto-localized at runtime — authoring `/en/news` on a `/ja` page will correctly fetch `/ja/news`. However, the scoped query index (`/{lang}/news/query-index.json`) must exist for each locale in `helix-query.yaml` for scoped fetching to work; otherwise the block falls back to the full language index.
- `featuredImage` must be set explicitly by the author per page. The list block does not auto-derive it from the page's hero or first image block.
- On EDS, a `helix-query.yaml` scoped index entry must exist for each section path. Without one, the block falls back to the full language index (higher payload, slower).
- The list is **JS-rendered** — invisible to crawlers that do not execute JavaScript (most AI/AIO crawlers). Article discoverability depends on sitemap and static internal links.
- `urlState=true` uses `?page=N` — multiple list blocks on the same page would conflict. Use only on single-list pages.
- In the UE author iframe, `history.pushState` is a no-op; pagination works visually but URL won't update.
- `footer-nav` style does not display images, dates, or descriptions regardless of config.

### Query index requires publish, not just preview

**Pages must be published to live for the query index to be updated.** Previewing a page
does not trigger index generation. This means:

- A previewed article (`*.aem.page` 200) will **not** appear in the news listing until
  it is also published to live (`*.aem.live` 200).
- The `query-index.json` file itself does not exist until at least one page under the
  covered path has been published.

Source: [https://www.aem.live/developer/indexing](https://www.aem.live/developer/indexing)
> *"Pages are indexed when they are published. To remove pages from index, they have to be unpublished."*

**To publish via admin API** (without the Sidekick):
```bash
curl -X POST "https://admin.hlx.page/live/satoshiinoue/b2b-ue/main/en/news/spectralink-7000"
curl -X POST "https://admin.hlx.page/live/satoshiinoue/b2b-ue/main/en/news"
```

**To force a re-index** of an already-published page (e.g. after fixing `helix-query.yaml`):
```bash
curl -X POST "https://admin.hlx.page/index/satoshiinoue/b2b-ue/main/en/news/spectralink-7000"
```

There is no preview-tier-only index endpoint. The `/index` admin API operates against
live-published content only (`indexedUrl` always points to `*.aem.live`).
See: [https://www.aem.live/docs/admin.html](https://www.aem.live/docs/admin.html)
