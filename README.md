# b2b-ue — B2B Theme Starter for AEM EDS + Universal Editor

A production-quality B2B website starter kit for Adobe Experience Manager Edge Delivery Services (EDS) + Universal Editor (XWalk). Ships as a standalone site for the fictional company **Lumina Noventis** (precision optics and measurement instruments).

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | `npm run build:json`, `npm run build:packages`, linting |
| AEM Cloud | CS 2024+ | Author instance + Universal Editor |
| AEM EDS | — | Content delivery via `main--b2b-ue--{org}.aem.page` |

---

## Quick Start

```bash
git clone https://github.com/SatoshiInoue/b2b-ue.git
cd b2b-ue
npm install
```

---

## Key Commands

```bash
# After editing any _*.json source file (block models, filters):
npm run build:json

# After updating content-package/ or site.zip:
npm run build:packages          # both packages
npm run build:packages:template # template-only package
npm run build:packages:site     # full-install package

# Lint JS + CSS:
npm run lint
```

---

## Content Package Build Process

### Overview

The content package system has two outputs, both generated from `content-package/` as the single source of truth:

| File | Use case |
|---|---|
| `b2b-ue-template-1.0.0.zip` | New environment setup — install, then create the site via Quick Site Creation wizard. Installs the full stack (pages, DAM, CFM models, GraphQL endpoint + persisted query) in one QSC step. |
| `b2b-ue-site-1.0.0.zip` | Dev iteration — reinstall at any time to push page content, DAM, CFM model, or GraphQL updates without touching QSC's GitHub proxy config. |

### Source of truth: `content-package/`

```
content-package/
  jcr_root/conf/global/site-templates/b2b-ue-1.0.0/
    .content.xml          ← template metadata
    site.zip              ← inner package: page content, DAM, CF models
    previews/             ← thumbnail for Quick Site Creation UI
  META-INF/vault/
    config.xml            ← Vault config (shared by both outputs)
    filter.xml            ← used only for template package
    properties.xml        ← used only for template package
```

**Never edit the output ZIPs directly.** Edit sources in `content-package/` and regenerate.

### Rebuilding `site.zip` (inner package)

`site.zip` contains the actual page content (`/content/b2b-ue/`), DAM assets (`/content/dam/b2b-ue/`), and site configuration (`/conf/b2b-ue/`). It is rebuilt via Python scripts when page content changes:

```bash
python3 /path/to/rebuild_site_zip.py   # rebuilds content-package/.../site.zip
npm run build:packages                  # regenerates both outer ZIPs
```

> **Note:** The rebuild scripts are separate from this repo (stored locally). If you need to update page content — adding blocks, editing homepage structure — edit the XML in the rebuild script, run it, then run `npm run build:packages`.

### Generating output packages

```bash
npm run build:packages
```

This runs `build-packages.py`, which:

1. **`b2b-ue-template-1.0.0.zip`** — installs the Quick Site Creation template. The embedded `site.zip` is cleaned at build time:
   - Broad `/conf/b2b-ue` replace filter is replaced with targeted merge sub-paths so QSC's GitHub proxy cloudconfig is never overwritten.
   - `/content/dam/b2b-ue` changed to `mode="merge"` to prevent a rollback if DAM assets already exist.
   - CFM models (`/conf/b2b-ue/settings/dam/cfm`), persisted queries (`/conf/b2b-ue/settings/graphql`), and the GraphQL endpoint (`/content/cq:graphql/b2b-ue`) are included so QSC installs the full headless stack in one step.

2. **`b2b-ue-site-1.0.0.zip`** — installs template + content + DAM + CFM models + GraphQL. Used for dev iteration after QSC has already set up `/conf/b2b-ue`. Uses:
   - `mode="update"` for `/content/b2b-ue` — preserves site-level properties written by Quick Site Creation
   - `mode="merge"` for DAM, tags, CFM, GraphQL sub-paths
   - **`/conf/b2b-ue` cloudconfigs are entirely excluded** — this sub-tree is owned by Quick Site Creation and stores the `franklin.delivery` GitHub proxy config that serves `component-models.json`, `component-filters.json`, `component-definition.json` to Universal Editor. Overwriting it causes 404s on component JSON.

### Two-approach workflow

**Approach 1 — Template → Quick Site Creation (recommended for new environments):**
1. Go to CRX Package Manager (`/crx/packmgr`)
2. Upload and install `b2b-ue-template-1.0.0.zip`
3. Go to AEM Sites console → **Create → Site from Template**
4. Select **B2B UE Starter** → fill in title, enter the GitHub repo URL → **Create**
5. QSC installs the embedded `site.zip`, which creates:
   - `/content/b2b-ue/` — all pages (8 languages)
   - `/content/dam/b2b-ue/` — DAM assets and the CMM Systems product spec CF instance
   - `/content/cq:graphql/b2b-ue` — GraphQL endpoint
   - `/conf/b2b-ue/settings/dam/cfm/models/product-spec` — ProductSpec Content Fragment Model
   - `/conf/b2b-ue/settings/graphql/persistentQueries/product-spec-by-path` — persisted query
6. QSC also writes the `franklin.delivery` proxy config to `/conf/b2b-ue`, which Universal Editor needs to load component models
7. **Post-install:** publish the ProductSpec CFM model (CF Models console → select Product Spec → Publish) and the persisted query (GraphiQL IDE → b2b-ue endpoint → product-spec-by-path → Publish) so the EDS delivery tier can use them

**Approach 2 — Full-install package (dev iteration / bulk updates):**
1. Go to CRX Package Manager → upload and install `b2b-ue-site-1.0.0.zip`
2. Reinstall at any time to push page content, DAM, CFM model, or GraphQL updates
3. Safe to reinstall repeatedly — uses merge/update modes that preserve QSC's GitHub proxy config at `/conf/b2b-ue/settings/cloudconfigs`
4. **Do not use this to set up a brand new environment** — it skips the QSC wizard, so `/conf/b2b-ue/settings/cloudconfigs` (the GitHub proxy) will not be configured and Universal Editor will fail to load component models. Run Approach 1 first.

> **After any package install that adds new DAM images — reprocess assets:**
> Package Manager bypasses the DAM ingestion workflow. The package includes basic image metadata (`dam:size`, `tiff:ImageWidth/Length` with correct JCR types), so Content Fragment references and Universal Editor properties panels work immediately. However, Dynamic Media delivery URLs and renditions (thumbnails, web-optimized) are not generated until reprocessing.
>
> **Fix:** AEM Assets (`/assets.html/content/dam/b2b-ue/images`) → select the assets showing "Processing…" → click **Reprocess Assets** in the toolbar → wait ~30 seconds. This generates Dynamic Media delivery URLs and renditions.
>
> This is a one-time step per environment whenever new images are added via package.

> **QSC reinstall — pre-flight check:** AEM's Quick Site Creation rejects site creation if any path containing the site name already exists under `/content/`. Before re-running QSC after a previous install, delete ALL of the following via CRXDE Lite:
> - `/content/b2b-ue`
> - `/content/dam/b2b-ue`
> - `/content/cq:graphql/b2b-ue`
> - `/content/cq:tags/b2b-ue`
> - `/conf/b2b-ue`
>
> Then reinstall the template package and re-run QSC.

> **Recovery from broken styles / component-*.json 404:** If `/conf/b2b-ue` was accidentally overwritten or deleted, delete it via CRXDE Lite, then follow the QSC reinstall procedure above to restore the GitHub proxy configuration.

---

## Frontend Development

Blocks live in `blocks/`. Each block has three files:

```
blocks/{name}/
  {name}.js          ← decorator: export default function decorate(block) {}
  {name}.css         ← styles
  _{name}.json       ← UE definitions only (NOT the source for component-models.json)
```

### Custom build workflow — not in the official boilerplate

> **This project uses a custom JSON build step that does not exist in the standard AEM EDS boilerplate.**
> The official boilerplate has a single flat `component-models.json` at the repo root with no build step.
> Here, that file is **generated** — never edit it directly.

The three root files AEM reads are generated by `npm run build:json`:

| Generated (do not edit) | Source (edit this) |
|---|---|
| `component-models.json` | `models/_component-models.json` |
| `component-definition.json` | `models/_component-definition.json` |
| `component-filters.json` | `models/_component-filters.json` |

**Critical:** `blocks/{name}/_{name}.json` contains a `models` array for documentation/tooling reference only. It is **not read by the build** and has no effect on `component-models.json`. To add or change a block's Universal Editor fields, always edit `models/_component-models.json`.

```bash
# Run after any change to models/_*.json or blocks/**/_*.json
npm run build:json
```

### Block inventory

| Block | Description |
|---|---|
| `header` | Dynamic navigation — fetches `/{lang}/nav` fragment |
| `footer` | Static footer — fetches `/{lang}/footer` fragment |
| `fragment` | Required by header + footer for `loadFragment()` |
| `hero-b2b` | Full-width hero with preheader, headline, dual CTAs, trust stats |
| `section-header` | Eyebrow + heading + subtitle with gold decorative lines |
| `cards` + `card` | Card grid — supports `solution-tile` style with SVG icon field |
| `cta-link` | Centered text link with gold underline |
| `list` | Dynamic page list with Card/Small/Medium styles, pagination |
| `solutions-grid` | 6-tile solution area grid |
| `spec-table` | Key-value specification table with RTL support |
| `content-fragment` | Fetches a Content Fragment via AEM GraphQL persisted query and renders a spec table. Requires: CF path, persisted query path (e.g. `b2b-ue/product-spec-by-path`), variable name (`path`), display style. |

---

## GraphQL / Content Fragments

### Setup

The `product-spec` Content Fragment Model and persisted query are installed automatically by both packages. After install, publish them so the EDS delivery tier can access them:

1. **Publish the CFM model:** CF Models console (`/mnt/overlay/dam/cfm/models/console/content/models.html/conf/b2b-ue`) → select **Product Spec** → **Publish**
2. **Publish the persisted query:** GraphiQL IDE (`/aem/graphiql.html`) → select **b2b-ue** endpoint → select `product-spec-by-path` → **Publish**

### Persisted query

| Property | Value |
|---|---|
| Endpoint | `/content/cq:graphql/b2b-ue/endpoint` |
| Query name | `product-spec-by-path` |
| Execute (author) | `/graphql/execute.json/b2b-ue/product-spec-by-path;path=/content/dam/b2b-ue/product-specs/cmm-systems` |
| Execute (publish) | Same path on host set in `AEM_PUBLISH_HOST` env var |

### GraphQL helper module

`scripts/aem-graphql.js` exports two functions used by the `content-fragment` block:

- `getGraphQLHost()` — returns the author origin when running in Universal Editor, or the publish host for EDS delivery.
- `executePersistedQuery(queryPath, variables)` — executes a persisted query and returns `item` or `items` from the result. Variable values are passed as semicolon-delimited parameters; slashes in JCR paths are kept unencoded as required by AEM's persisted query URL format.

### Content Fragment Model: ProductSpec

Defined at `/conf/b2b-ue/settings/dam/cfm/models/product-spec`. Fields:

| Field | Type | GraphQL |
|---|---|---|
| `productName` | Single-line text | `String` |
| `series` | Single-line text | `String` |
| `category` | Single-line text | `String` |
| `shortDescription` | Multi-line text | `{ plaintext }` |
| `heroImage` | Content reference | `{ ... on ImageRef { _authorUrl _publishUrl } }` |
| `measurementUncertainty` | Single-line text | `String` |
| `protectionRating` | Single-line text | `String` |
| `operatingTemperature` | Single-line text | `String` |
| `industrialProtocols` | Single-line text | `String` |
| `calibrationStandard` | Single-line text | `String` |
| `compliance` | Single-line text | `String` |
| `reportTemplates` | Single-line text | `String` |

Sample CF instance: `/content/dam/b2b-ue/product-specs/cmm-systems`

---

## Multi-Language

8 languages: `en`, `ja`, `zh`, `ko`, `es`, `de`, `fr`, `ar` (Arabic/RTL)

Arabic RTL is handled via `[dir="rtl"]` CSS scopes. The `ar` path sets `document.documentElement.dir = 'rtl'` in `scripts.js`.

---

## Design Reference

Design mockups (desktop 1440px + mobile 390px) are documented in:
- `docs/design/design-summary.md` — English
- `docs/design/design-summary-ja.md` — Japanese

Brand colors:

| Token | Value |
|---|---|
| Primary | `#003087` Deep navy |
| Secondary | `#0066cc` Mid blue (interactive/hover) |
| Accent | `#e8b400` Gold (CTAs, highlights) |
| Dark BG | `#001840` Footer/dark sections |
| Surface | `#f5f7fa` Light section backgrounds |

---

## Environment Setup

Create a `.env` file in the project root (see `.env.example`):

```bash
AEM_AUTHOR_HOST=https://author-p######-e#######.adobeaemcloud.com
AEM_PUBLISH_HOST=https://publish-p######-e#######.adobeaemcloud.com
```

## Repository

- **GitHub:** `SatoshiInoue/b2b-ue`
- **AEM Author:** Set via `AEM_AUTHOR_HOST` in `.env`
- **AEM Publish:** Set via `AEM_PUBLISH_HOST` in `.env`
- **EDS delivery:** `main--b2b-ue--SatoshiInoue.aem.page`
- **Content path:** `/content/b2b-ue/us/{lang}/`
- **DAM path:** `/content/dam/b2b-ue/`
