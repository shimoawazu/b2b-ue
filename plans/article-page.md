# Article Page — Structure & Implementation

## Page Structure

An article page is composed of the following sections, top to bottom:

```
section_breadcrumb  (no style)
  ├── breadcrumb block      — nav trail: Home › News › [Page Title]
  └── tag block             — category badge (PRODUCT LAUNCH, WHITE PAPER, etc.)

section              style="article-header"
  ├── title block           — <h1> article title
  └── text component        — meta row: "March 18, 2026 · Product Launch · 5 min read"

section_featured     style="article-hero"
  └── featured-image block  — hero image or gradient placeholder

section_body1        style="article-body"
  └── text component        — body paragraphs (richtext)

section_pullquote    style="article-pullquote"   [optional]
  └── pull-quote block      — pull-quote with gold left border

section_body2        style="article-body"        [optional, second body block]
  └── text component        — continued body paragraphs

section_related      style="related-articles"
  ├── text component        — "RELATED ARTICLES" label
  └── list block            — listStyle="related", rootPath="/en/news", limit="3"
```

---

## Blocks Used

### breadcrumb
- **Model field**: `parentLabel` (text) — display label for the parent crumb link, e.g. `News`
- **JS logic**: reads `parentLabel` from first block cell, derives href from URL segments,
  uses `document.querySelector('main h1')` or `document.title` for the current-page crumb
- **Rendering**: `<nav aria-label="Breadcrumb"><ol><li>...</li></ol></nav>`
- **CSS**: `padding: 20px 64px`, bottom border, `›` separator via `::before`

### tag
- **Model fields**: `category` (text), `variant` (select)
- **JS priority order**:
  1. Explicit `category` block field (set via UE Properties panel)
  2. `<meta name="category">` in page head (EDS delivery only)
  3. Fetch `{pagePath}.2.json` → read `cq:tags` or `category` property (AEM author tier)
- **Variant-to-label mapping**:
  | Variant | Badge label | Colors |
  |---|---|---|
  | `product-launch` | PRODUCT LAUNCH | Navy bg / gold text |
  | `white-paper` | WHITE PAPER | Blue bg / white text |
  | `company` | COMPANY | Dark navy bg / white text |
  | `industry-insight` | INDUSTRY INSIGHT | Green bg / white text |
  | `technical-note` | TECHNICAL NOTE | Blue bg / white text |

### featured-image
- **Model fields**: `image` (reference), `imageAlt` (text)
- **JS logic**: if a `<picture>` is present, optimizes it with `createOptimizedPicture`;
  otherwise renders a `.featured-image-placeholder` div (gradient blue, 360 px tall)
- **Page property sync**: the `featuredImage` reference field in **Page Properties → Article**
  tab is the source of truth for list-card thumbnails (used by the `list` block). Set the
  same image there so thumbnails stay in sync with the article hero. See note below.

### pull-quote  _(optional)_
- **Model field**: `text` (richtext)
- **Rendering**: `<blockquote class="pull-quote-text">` with 4 px gold left border
- **CSS**: `padding: 6px 0 6px 24px`, max-width 720 px, italic bold 20 px navy

### list (related articles)
- `listStyle="related"` — renders a compact horizontal card row (category, title, date)
- `rootPath="/en/news"` — scans all child pages of the news section
- `limit="3"` — shows up to 3 related articles
- Excludes the current page automatically (path comparison in `renderRelated()`)

---

## Section CSS Classes

| Class | File | Purpose |
|---|---|---|
| `.section.article-header` | styles.css | 44 px navy H1 + 13 px meta row, bottom border |
| `.section.article-hero` | styles.css | `padding: 0 64px 32px` for the hero image section |
| `.section.article-body` | styles.css | 720 px max-width, 16 px/1.75 body text |
| `.section.article-pullquote` | styles.css | Minimal wrapper padding for pull-quote |
| `.section.related-articles` | styles.css | Top border, `margin: 0 64px`, bottom padding |

---

## JCR Content Package Structure (per article)

```xml
<jcr:content
    jcr:title="Article Title"
    jcr:description="..."
    cq:tags="[b2b-ue:news-category/product-launch]"
    category="PRODUCT LAUNCH"
    listOrder="1"
    featuredImage="/content/dam/b2b-ue/...">

  <root>
    <section_breadcrumb>
      <breadcrumb model="breadcrumb" parentLabel="News"/>
      <tag model="tag" category="PRODUCT LAUNCH" variant="product-launch"/>
    </section_breadcrumb>

    <section style="article-header">
      <title model="title" title="Article Title"/>
      <text text="&lt;p&gt;March 18, 2026 · Product Launch · 5 min read&lt;/p&gt;"/>
    </section>

    <section_featured style="article-hero">
      <featured_image model="featured-image"/>
    </section_featured>

    <section_body1 style="article-body">
      <text text="&lt;p&gt;...&lt;/p&gt;"/>
    </section_body1>

    <section_pullquote style="article-pullquote">
      <pull_quote model="pull-quote" text="&lt;p&gt;...&lt;/p&gt;"/>
    </section_pullquote>

    <section_body2 style="article-body">
      <text text="&lt;p&gt;...&lt;/p&gt;"/>
    </section_body2>

    <section_related style="related-articles">
      <text text="&lt;p&gt;Related Articles&lt;/p&gt;"/>
      <list model="list" rootPath="/en/news" listStyle="related" limit="3" showDate="true"/>
    </section_related>
  </root>
</jcr:content>
```

---

## Featured Image + Page Property Sync

The `featured-image` block (`image` field) and the `featuredImage` page property
are **separate fields**. This is intentional — they serve different purposes:

| Field | Where set | Used by |
|---|---|---|
| `featured-image` block → `image` | Block Properties in UE canvas | Article page hero display |
| Page Properties → `featuredImage` | Page Properties panel (Article tab) | List block card thumbnails |

**Author workflow**: set the same DAM image in both places.

**Why not auto-sync?**  
There is no built-in AEM/EDS mechanism to propagate a block-level reference to a
`jcr:content` page property. Options if single-entry is important:

1. **Read from page property only** — remove the `image` field from the block model and
   have the `featured-image` JS fetch `{pagePath}.2.json` to read `featuredImage`. The
   block becomes a pure display component driven by a single page property. Downside:
   async fetch on every page load; no inline canvas editing of the image.

2. **List block fallback** — modify `list.js` so that when `featuredImage` is empty, it
   falls back to fetching the article page's first `<img>`. This avoids dual-entry but
   adds N extra network requests to every list page.

---

## Deployment Checklist

After any block/model change:
1. `npm run build:json` — regenerates `component-models.json`, `component-definition.json`, `component-filters.json`
2. **Commit & push to GitHub** — EDS and UE read ALL files (JS, CSS, JSON) from the GitHub-backed CDN
3. **Reinstall content package** in AEM Package Manager if article XML structure changed

> The UE properties panel and block rendering both depend on the GitHub-deployed versions
> of `component-models.json` and the block JS files. Local changes have no effect until pushed.
