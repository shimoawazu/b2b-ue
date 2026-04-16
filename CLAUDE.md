# CLAUDE.md — b2b-ue

## Project

**b2b-ue** — B2B theme starter for AEM Edge Delivery Services (EDS) + Universal Editor (XWalk).

- **Content delivery:** AEM EDS (CDN edge)
- **Content authoring:** AEM Universal Editor
- **Content source:** AEM Author (`author-p161901-e1740392.adobeaemcloud.com`)
- **AEM content path:** `/content/b2b-ue/language-masters/{lang}/`
- **DAM path:** `/content/dam/b2b-ue/`

## Directory Structure

```
blocks/    # Block components — each has {name}.js, {name}.css, _{name}.json
models/    # UE component definition sources (_*.json) — edit these, not root files
scripts/   # Core scripts (aem.js, scripts.js, utils.js)
styles/    # Global styles and CSS variables (styles.css, fonts.css)
content-package/  # AEM content package source (jcr_root/ + META-INF/)
docs/      # Developer documentation
plans/     # Implementation plans
```

## Languages

8 languages: en, ja, zh (Simplified Chinese), ko, es, de, fr, ar (Arabic/RTL)

RTL is handled via `[dir="rtl"]` CSS scopes. The `ar` language sets `document.documentElement.dir = 'rtl'` in scripts.js.

## Key Commands

```bash
npm install          # Install dev dependencies
npm run build:json   # Merge models/_*.json + blocks/**/_*.json → component-*.json
npm run lint         # JS + CSS lint check
```

> Always run `npm run build:json` after editing any `_*.json` source file.

## Important Rules

- **Never edit root `component-*.json`** — generated files, overwritten by build
- **Block JSON source** = `blocks/{name}/_{name}.json` and `models/_*.json`
- **New block** = also add name to `section` filter in `models/_component-filters.json`
- **DOM restructuring** = always call `moveInstrumentation()` to preserve `data-aue-*` attributes
- **Block decorator** = `export default function decorate(block) { ... }`

## Content Package

The `content-package/` directory is a CRX content package source.
Build a ZIP for AEM Package Manager with:
```bash
cd content-package && zip -r ../b2b-ue-content-1.0.0.zip jcr_root META-INF
```
Install via `/crx/packmgr` on the AEM Author instance. No Maven required.

## Blocks Inventory

| Block | Source | Notes |
|---|---|---|
| `header` | Ported from finehotel-ue | Dynamic nav — empty `<ul>` in nav.html activates it |
| `list` | Ported from finehotel-ue | Card/Small/Medium styles, pagination |
| `footer` | Ported from finehotel-ue | Static footer |
| `hero` | Ported from finehotel-ue | Adapt for B2B |
| `solutions-grid` | New | 6-tile solution area grid |
| `spec-table` | New | Key-value specification table |

## Design Reference

- Seiko-Epson: product lineup comparison tables, series-based grouping
- Anritsu: solution area tiles, mega-nav, news card layout
- Konica Minolta EU: enterprise services grid, product finder widget
