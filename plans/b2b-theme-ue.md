# Plan: B2B Theme — `b2b-ue` (AEM EDS + Universal Editor)

## Goal

Create a production-quality B2B website starter kit for AEM EDS + Universal Editor (XWalk). Standalone repository for the fictional company **Lumina Noventis** (precision measurement instruments). Ships with a preloaded AEM content package containing CF models, default content, 8-language structure, and a Quick Site Creation template.

Design reference sites: Industrial B2B product lineup pages, test & measurement solution tiles with mega-nav, enterprise services grid with product finder.

---

## Repository

- **GitHub**: `SatoshiInoue/b2b-ue`
- **AEM Author**: Set via `AEM_AUTHOR_HOST` environment variable
- **EDS delivery**: `main--b2b-ue--SatoshiInoue.aem.page`
- **Content path**: `/content/b2b-ue/language-masters/{lang}/`
- **DAM path**: `/content/dam/b2b-ue/`
- **Template**: `/conf/global/site-templates/b2b-ue-1.0.0/`

### Directory Structure

```
b2b-ue/
├── blocks/
│   ├── cards/           # Cards block + UE model
│   ├── footer/          # Footer (loadFragment-based)
│   ├── fragment/        # Fragment block — required by header + footer
│   ├── header/          # Dynamic navigation (header.js, navigation.js)
│   ├── hero/            # Hero block
│   ├── list/            # Dynamic list block with pagination
│   ├── solutions-grid/  # 6-tile solution grid
│   └── spec-table/      # Key-value specification table
├── models/
│   └── _component-models.json   # source — edit this, run npm run build:json
├── scripts/             # aem.js, scripts.js, utils.js, ffetch.js, dom-helpers.js
├── styles/              # styles.css, fonts.css
├── content-package/     # AEM content package source (do not edit generated ZIPs)
│   ├── META-INF/vault/  # filter.xml, properties.xml, config.xml
│   └── jcr_root/conf/global/site-templates/b2b-ue-1.0.0/
│       ├── .content.xml
│       ├── previews/
│       └── site.zip     # inner package — rebuilt by Python script
├── b2b-ue-site-template-1.0.0.zip   # outer AEM package — upload to Package Manager
├── component-models.json    # GENERATED — do not edit directly
├── component-filters.json   # GENERATED — do not edit directly
├── component-definition.json # GENERATED — do not edit directly
├── fstab.yaml
├── paths.json
└── helix-query.yaml
```

### Key Commands

```bash
npm run build:json   # Merge models/_*.json + blocks/**/_*.json → component-*.json
npm run lint         # JS + CSS lint
```

> Always run `npm run build:json` after editing `models/_component-models.json` or any `blocks/**/_*.json`.

---

## Multi-Language Structure

8 languages. Arabic is RTL.

| Code | Language | RTL? |
|---|---|---|
| `en` | English (primary) | No |
| `ja` | Japanese | No |
| `zh` | Simplified Chinese | No |
| `ko` | Korean | No |
| `es` | Spanish | No |
| `de` | German | No |
| `fr` | French | No |
| `ar` | Arabic | **Yes** |

JCR path: `/content/b2b-ue/language-masters/{lang}/`

Each language root has: home, nav, footer, search, products, solutions, about, news.

---

## Component Models (component-models.json)

Models defined in `models/_component-models.json`. Do NOT edit root `component-models.json`.

| ID | Status | Fields |
|---|---|---|
| `page-metadata` | ✅ Done | jcr:title, jcr:pagetitle, jcr:description, navOrder, hideInNav, listOrder |
| `image` | ✅ Done | image (reference), imageAlt |
| `title` | ✅ Done | title (text), titleType (h1–h6 select) |
| `button` | ✅ Done | link, linkText, linkTitle, linkType |
| `section` | ✅ Done | name, style (multiselect) |
| `card` | ✅ Done | image (reference), text (richtext) |
| `hero` | ✅ Done | image, imageAlt, text (richtext), herolayout (select), ctastyle (select) |
| `list` | ✅ Done | rootPath, sortBy, showDescription, showImage, showDate, limit, listStyle |
| `fragment` | ✅ Done | reference (aem-content) |

---

## Blocks

### Implemented

| Block | Status | Notes |
|---|---|---|
| `header` | ✅ Done | Dynamic nav via `navigation.js`; fetches `/{lang}/nav` fragment |
| `footer` | ✅ Done | Fetches `/{lang}/footer` fragment |
| `fragment` | ✅ Done | Required by header + footer for `loadFragment()` |
| `hero` | ✅ Done | Full-width, herolayout + ctastyle options |
| `cards` | ✅ Done | Card grid block; `card` model for UE |
| `list` | ✅ Done | Dynamic list with pagination, Card/Small/Medium styles |
| `solutions-grid` | ✅ Done | 6-tile solution area grid |
| `spec-table` | ✅ Done | Key-value specification table with section headers, RTL support |

### Planned

| Block | Priority | Description |
|---|---|---|
| `cta-banner` | Medium | Full-width CTA strip: headline + primary + secondary buttons |
| `product-detail` | Low | CF-backed product page: gallery, spec table, document downloads, related products |
| `product-list` | Low | CF-backed product listing with series/category filter tabs |
| `product-finder` | Low | "I am looking for…" dropdown filter widget |
| `json-ld` | Low | Injects Product/BreadcrumbList structured data |
| `language-switcher` | Low | Dropdown for 8 languages; placed in footer or header utility bar |

---

## Content Package

### Quick Site Creation Template

- Outer package: `b2b-ue-site-template-1.0.0.zip`
  - Installs to: `/conf/global/site-templates/b2b-ue-1.0.0/`
  - Template `.content.xml`: `name="b2b-ue"`, `jcr:title="B2B UE Starter"`
- Inner package: `site.zip`
  - Installs: `/content/b2b-ue/`, `/content/dam/b2b-ue/`, `/conf/b2b-ue/`
  - 8 language trees, nav/footer per language, 6 SVG brand assets as `dam:Asset`

### Rebuild Workflow

The inner `site.zip` is built via Python script (not via `vlt` or Maven):

```bash
python3 /tmp/rebuild_v4_final.py   # rebuilds site.zip
python3 /tmp/rebuild_outer_v3.py   # rebuilds b2b-ue-site-template-1.0.0.zip
git add content-package/ b2b-ue-site-template-1.0.0.zip
git commit && git push
```

Key Vault path rules (hard-won from debugging):
- `jcr:content` node → `_jcr_content/` (namespace escape: `ns:name` → `_ns_name`)
- `renditions` node (no namespace) → `renditions/` NOT `_renditions/`
- `dam:Asset` structure: `asset.svg/` → `_jcr_content/` → `renditions/` → `original` (raw bytes) + `original.dir/.content.xml`

### Install Steps

1. CRX Package Manager → upload `b2b-ue-site-template-1.0.0.zip` → Install
2. Sites console → Create → Site from Template → **B2B UE Starter**
3. Verify `/content/b2b-ue/` and `/content/dam/b2b-ue/images/` are created

### DAM Assets (SVG)

6 branded SVGs at `/content/dam/b2b-ue/images/`:
- `lumina-noventis-logo.svg` — logo (240×60, navy + gold)
- `hero-banner.svg` — dark gradient banner (1200×480)
- `card-innovation.svg` — blue radar icon (600×300)
- `card-sustainability.svg` — green leaf icon (600×300)
- `card-employer.svg` — gold star icon (600×300)
- `news-hero.svg` — article layout placeholder (600×200)

---

## Content Architecture

### CF Models

Defined in `/conf/b2b-ue/settings/dam/cfm/models/`:

| Model | Key Fields |
|---|---|
| `product` | productName (text), sku, category, description (text-multi), frequencyRange, datasheetUrl |
| `news-article` | title, publishDate, author, summary, body (text-multi), heroImage (reference) |

### Page Structure (EN)

**Home** (`/en`):
- Section 1: Hero (hero-banner.svg, "Measure What Matters" headline + CTA)
- Section 2: Title ("Shaping the Future of Measurement") + Cards (3: SpectraLink 5000 / Carbon-Neutral / Top 100 Best Places)
- Section 3: Title ("Four Decades of Engineering Excellence") + Text (about copy)
- Section 4: Title ("Latest from Lumina Noventis") + static news teasers (3 articles)

**Solutions** (`/en/solutions`): Solutions-grid block with 6 tiles

**Products** (`/en/products`): Product listing (planned: product-list block with CF integration)

**News** (`/en/news`): List block with Card style

**About** (`/en/about`): Text-based page with company information

---

## Known Issues / Debug History

| Issue | Root Cause | Fix |
|---|---|---|
| "Headline" on all components | `title`, `card`, `hero`, `list` models missing from `component-models.json` | Added models to `models/_component-models.json`, rebuilt |
| Site creation fails silently | `_renditions/` used instead of `renditions/` in Vault DAM paths | Changed to `renditions/` (no namespace prefix = no underscore) |
| Images not in DAM after install | SVGs stored as `nt:file` instead of `dam:Asset` | Converted to full `dam:Asset` → `dam:AssetContent` → `renditions/original` structure |
| Header/footer not loading | `blocks/fragment/fragment.js` missing; header.js + footer.js import `loadFragment` from it | Created `blocks/fragment/` by porting from finehotel-ue |
| Hero/List blank properties panel in UE | `hero` and `list` models missing from `component-models.json` | Added both models |
| Package showing UUID name in Package Manager | `META-INF/vault/properties.xml` missing from outer package | Added with `name`, `version`, `group` |

---

## Design Direction

### Brand: Lumina Noventis

Precision measurement instruments. Corporate, technical, trustworthy.

### CSS Variables

```css
:root {
  --brand-primary:   #003087;   /* Deep navy blue */
  --brand-secondary: #0066cc;   /* Mid blue — interactive/hover */
  --brand-accent:    #e8b400;   /* Gold — highlights */
  --color-text:      #1a1a1a;
  --color-surface:   #f5f7fa;
  --font-body:       'Inter', system-ui, sans-serif;
  --font-arabic:     'IBM Plex Arabic', 'Noto Sans Arabic', sans-serif;
}
```

### Breakpoints

| Name | Min-width |
|---|---|
| Tablet | 600px |
| Desktop | 900px |
| Wide | 1200px |

### RTL (Arabic)

- Path `/ar/` → `document.documentElement.dir = 'rtl'` set by `scripts.js`
- CSS uses `[dir="rtl"]` overrides throughout
- `spec-table.css`, hero, list all have RTL selectors

---

## Implementation Status

### Phase 1 — Repo scaffolding ✅ Complete
- Repo created from `aem-boilerplate-xwalk`
- Wired to AEM Author (`fstab.yaml`, `paths.json`)
- `scripts/utils.js`, dynamic header/nav, list block ported from finehotel-ue

### Phase 2 — Content package ✅ Complete
- JCR structure: 8 languages × (home, nav, footer, search, products, solutions, about, news)
- CF models: product, news-article
- Quick Site Creation template: outer + inner ZIP, previews
- DAM: 6 SVG brand assets as proper `dam:Asset` nodes

### Phase 3 — Core blocks ✅ Complete
- `hero` — done
- `solutions-grid` — done
- `spec-table` — done
- `fragment` — done (fixes header/footer loading)
- Global schema injection: not yet implemented

### Phase 4 — Product catalog blocks 🔲 Not started
- `product-detail`, `product-list` (CF GraphQL)
- `product-finder` widget

### Phase 5 — Content population 🔲 Partial
- EN pages: home, solutions, products, news, about — starter content only
- Non-EN: stub content ("Content coming soon")
- Full copywriting for all 8 languages: not done

### Phase 6 — Polish & packaging 🔲 Not started
- `language-switcher` block
- Theming pass
- Playwright smoke tests
- docs/ usage guide

---

## helix-query.yaml — Per-Language Indices

```yaml
base-site: &base-site
  target: /query-index.json
  properties:
    title: { select: head > meta[property="og:title"], value: attribute(el, "content") }
    description: { select: head > meta[name="description"], value: attribute(el, "content") }
    image: { select: head > meta[property="og:image"], value: attribute(el, "content") }
    lastModified: { select: head > meta[name="last-modified"], value: attribute(el, "content") }
    navOrder: { select: head > meta[name="navorder"], value: attribute(el, "content") }
    hideInNav: { select: head > meta[name="hideinnav"], value: attribute(el, "content") }
    listOrder: { select: head > meta[name="listorder"], value: attribute(el, "content") }

site-en:
  <<: *base-site
  include: ['/en', '/en/**']
  exclude: ['/en/nav', '/en/footer', '/en/search']
  target: /en/query-index.json

# Repeat for ja, zh, ko, es, de, fr, ar
```

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Standalone repo (not fork of finehotel-ue) | Clean branding, different content model, standalone installability |
| Python scripts for site.zip | No Maven/vlt toolchain needed; reproducible and version-controlled |
| Client-side JSON-LD | No edge-compute in EDS project context; standard EDS pattern |
| `mode="replace"` removed from filter | Not needed; site creation is clean when paths don't pre-exist |
| Arabic RTL from day 1 | Much harder to retrofit; use logical CSS properties from the start |

---

## Limitations

- **Sub-navigation**: dropdown menus out of scope for dynamic nav — top-level only
- **List block on Author**: requires EDS-published `query-index.json`; doesn't work in pure Author mode
- **CF translation**: Content Fragments have no native EDS translation integration
- **Real images**: SVG placeholders only; real product photos must be uploaded to DAM manually
