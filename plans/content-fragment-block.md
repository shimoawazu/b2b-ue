# Content Fragment Block — EDS Implementation Plan

## Goal

Create a reusable `content-fragment` EDS block that retrieves and renders a
single Content Fragment via a persisted GraphQL query. The block is authored
in Universal Editor by selecting a CF reference, and at render time it fetches
the CF data from the AEM GraphQL endpoint.

This block is the delivery mechanism for the `product-spec` CF model
(see `plans/product-spec-cf.md`) but is designed to be model-agnostic —
it fetches whatever fields the persisted query returns.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Universal Editor (AEM Author)                           │
│                                                          │
│  Author selects a CF via reference picker                │
│  → CF path stored as block property                      │
│  → Block JS fetches CF via persisted query on author     │
│  → Renders spec table in the canvas                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  EDS Delivery (aem.live)                                 │
│                                                          │
│  Page HTML contains CF path in block markup              │
│  → Block JS fetches CF via persisted query on publish    │
│  → Renders spec table at CDN edge                        │
└──────────────────────────────────────────────────────────┘
```

### Data flow

1. Author places `content-fragment` block on page in UE
2. Author selects a CF instance (e.g. `cmm-systems`) via the reference field
3. Author selects a persisted query name (e.g. `product-spec-by-path`)
4. AEM stores the CF path and query name as block properties in JCR
5. EDS renders block markup with the CF path and query name as cell text
6. Block JS reads those cells, constructs the persisted query URL, fetches, renders

---

## Block Model

### UE fields (`models/_component-models.json`)

```json
{
  "id": "content-fragment",
  "fields": [
    {
      "component": "reference",
      "name": "fragment",
      "label": "Content Fragment",
      "multi": false
    },
    {
      "component": "text",
      "name": "query",
      "label": "Persisted Query Path",
      "valueType": "string",
      "description": "e.g. b2b-ue/product-spec-by-path"
    },
    {
      "component": "text",
      "name": "variableName",
      "label": "Query Variable Name",
      "valueType": "string",
      "description": "GraphQL variable that receives the CF path (default: path)"
    },
    {
      "component": "select",
      "name": "display",
      "label": "Display Style",
      "valueType": "string",
      "options": [
        { "name": "Spec Table — dark (Paper 1IF-0)", "value": "" },
        { "name": "Spec Table — light", "value": "light" },
        { "name": "Raw JSON (debug)", "value": "debug" }
      ]
    }
  ]
}
```

### Block definition (`blocks/content-fragment/_content-fragment.json`)

```json
{
  "definitions": [
    {
      "title": "Content Fragment",
      "id": "content-fragment",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block",
            "template": {
              "name": "Content Fragment",
              "model": "content-fragment",
              "variableName": "path"
            }
          }
        }
      }
    }
  ],
  "filters": []
}
```

The `variableName` defaults to `path` in the template so authors don't need
to fill it in for the common case.

---

## Block Markup (EDS-rendered HTML)

After AEM renders the page, the block markup arriving at the JS decorator:

```html
<div class="content-fragment">
  <div>
    <div>/content/dam/b2b-ue/product-specs/cmm-systems</div>  <!-- row 0: fragment ref -->
  </div>
  <div>
    <div>b2b-ue/product-spec-by-path</div>                     <!-- row 1: query path -->
  </div>
  <div>
    <div>path</div>                                             <!-- row 2: variable name -->
  </div>
  <div>
    <div></div>                                                 <!-- row 3: display style -->
  </div>
</div>
```

---

## Block Decorator (`blocks/content-fragment/content-fragment.js`)

### Pseudocode

```javascript
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Determine the AEM host for GraphQL requests.
 * - Author tier (Universal Editor): same origin as the page
 * - Delivery tier (EDS): the publish instance
 */
function getGraphQLHost() {
  if (window.location.hostname.includes('adobeaemcloud.com')) {
    // Author tier — use current origin
    return window.location.origin;
  }
  // EDS delivery — use the publish endpoint from environment
  return process.env.AEM_PUBLISH_HOST;
}

/**
 * Fetch CF data via a persisted GraphQL query.
 */
async function fetchFragment(queryPath, variableName, cfPath) {
  const host = getGraphQLHost();
  const encodedPath = encodeURIComponent(cfPath);
  const url = `${host}/graphql/execute.json/${queryPath};${variableName}=${encodedPath}`;

  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) return null;

  const json = await resp.json();
  // Persisted query response: { data: { <queryName>: { item: { ... } } } }
  // Extract the first query result regardless of query name
  const queryResult = Object.values(json.data || {})[0];
  return queryResult?.item || null;
}

/**
 * Render the CF fields as a spec table.
 * Skip metadata fields (productName, series, category, etc.)
 * and render only spec-type fields as key-value rows.
 */
function renderSpecTable(container, item, style) {
  // Metadata fields — not rendered as spec rows
  const META_FIELDS = new Set([
    '_path', 'productName', 'series', 'category',
    'shortDescription', 'heroImage',
  ]);

  // Human-readable labels for known spec field names
  const LABELS = {
    measurementUncertainty: 'Measurement uncertainty',
    protectionRating: 'Protection rating',
    operatingTemperature: 'Operating temperature',
    industrialProtocols: 'Industrial protocols',
    calibrationStandard: 'Calibration standard',
    compliance: 'Compliance',
    reportTemplates: 'Report templates',
  };

  container.className = `content-fragment-spec ${style || 'dark'}`;

  // Optional: render product name as heading if present
  if (item.productName) {
    const heading = document.createElement('h3');
    heading.className = 'content-fragment-product-name';
    heading.textContent = item.productName;
    container.append(heading);
  }

  const table = document.createElement('div');
  table.className = 'content-fragment-table';

  Object.entries(item).forEach(([key, value]) => {
    if (META_FIELDS.has(key) || !value) return;

    const row = document.createElement('div');
    row.className = 'content-fragment-row';

    const label = document.createElement('span');
    label.className = 'content-fragment-label';
    label.textContent = LABELS[key] || key;

    const val = document.createElement('span');
    val.className = 'content-fragment-value';
    val.textContent = value;

    row.append(label, val);
    table.append(row);
  });

  container.append(table);
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const getCell = (i) => rows[i]?.querySelector(':scope > div:last-child');

  const cfPath = getCell(0)?.textContent?.trim();
  const queryPath = getCell(1)?.textContent?.trim();
  const variableName = getCell(2)?.textContent?.trim() || 'path';
  const display = getCell(3)?.textContent?.trim() || '';

  if (!cfPath || !queryPath) {
    block.textContent = '';
    const msg = document.createElement('p');
    msg.textContent = 'Select a Content Fragment and persisted query.';
    msg.style.color = '#999';
    block.append(msg);
    return;
  }

  // Show loading state
  block.textContent = '';
  const loading = document.createElement('p');
  loading.textContent = 'Loading...';
  loading.style.color = '#999';
  block.append(loading);

  const item = await fetchFragment(queryPath, variableName, cfPath);
  block.textContent = '';

  if (!item) {
    const err = document.createElement('p');
    err.textContent = 'Could not load content fragment.';
    err.style.color = '#c00';
    block.append(err);
    return;
  }

  if (display === 'debug') {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(item, null, 2);
    pre.style.cssText = 'font-size:12px;overflow:auto;background:#f5f5f5;padding:16px;border-radius:4px;';
    block.append(pre);
    return;
  }

  renderSpecTable(block, item, display);
}
```

### Key design decisions

- **`async` decorator**: the `decorate` function is `async` because it fetches
  data. EDS supports async decorators — the block renders after the fetch completes.
- **Author vs. delivery host**: on author (`adobeaemcloud.com`), the fetch
  hits the same origin. On EDS delivery, it hits the publish instance. This may
  need CORS config on the publish Dispatcher (see open questions).
- **Model-agnostic rendering**: the block renders whatever fields the persisted
  query returns. The `META_FIELDS` set and `LABELS` map are specific to
  `product-spec` but can be extended or made configurable.
- **No `innerHTML`**: all DOM is built via `createElement`/`textContent` per
  the EDS/UE skill guidelines.

---

## Block CSS (`blocks/content-fragment/content-fragment.css`)

Matches **Paper node `1IF-0`** — stacked vertical layout (label above value),
not side-by-side. Each row shows the muted label on top, then the bold white
value below, separated by a thin divider line.

```css
/* ── Dark spec table (default — matches Paper 1IF-0) ── */
.content-fragment-spec.dark {
  background: #0c1118;
  padding: 48px 0;
}

.content-fragment-spec.dark .content-fragment-row {
  padding: 20px 0;
  border-bottom: 1px solid rgba(255 255 255 / 0.09);
}

.content-fragment-spec.dark .content-fragment-row:last-child {
  border-bottom: none;
}

.content-fragment-spec.dark .content-fragment-label {
  display: block;
  color: rgba(255 255 255 / 0.48);
  font-size: 13px;
  margin-bottom: 8px;
}

.content-fragment-spec.dark .content-fragment-value {
  display: block;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
```

---

## Publish Host Configuration

The block needs to know which AEM publish host to call from the EDS delivery
tier. Hardcoding the publish URL in JS is fragile. Options:

| Approach | Pros | Cons |
|---|---|---|
| **Hardcode in JS** | Simplest | Breaks across environments |
| **`window.aemPublishHost` in `scripts.js`** | Single config point | Still code-level config |
| **Site config via `/config.json`** | Already exists in some EDS setups | Extra fetch at page load |
| **Metadata tag** (`<meta name="aem-publish">`) | Author-configurable via page properties | Requires model field |

**Recommended for this project:** define `AEM_PUBLISH_HOST` as an environment variable
(via `.env` file) and read it in `scripts/aem-graphql.js` (a utility module).
All GraphQL-fetching blocks import from that single location. When moving between
environments, only the `.env` file changes.

```javascript
// scripts/aem-graphql.js
const AEM_PUBLISH_HOST = process.env.AEM_PUBLISH_HOST;

export function getGraphQLHost() {
  // Author tier — same origin (UE iframe serves from author)
  if (window.location.hostname.includes('adobeaemcloud.com')) {
    return window.location.origin;
  }
  return AEM_PUBLISH_HOST;
}

export async function executePersistedQuery(queryPath, variables = {}) {
  const host = getGraphQLHost();
  const params = Object.entries(variables)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join(';');
  const url = `${host}/graphql/execute.json/${queryPath}${params ? ';' + params : ''}`;

  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) return null;

  const json = await resp.json();
  const queryResult = Object.values(json.data || {})[0];
  return queryResult?.item || queryResult?.items || null;
}
```

---

## Implementation Steps

1. **Create `scripts/aem-graphql.js`** — shared utility for persisted query execution
2. **Create `blocks/content-fragment/content-fragment.js`** — block decorator
3. **Create `blocks/content-fragment/content-fragment.css`** — dark/light themes
4. **Create `blocks/content-fragment/_content-fragment.json`** — block definition
5. **Add model to `models/_component-models.json`** — 4 fields (fragment ref, query path, variable name, display style)
6. **Add to `models/_component-filters.json`** — add `content-fragment` to section filter
7. **Run `npm run build:json`**

### Prerequisites (from product-spec-cf.md plan)

Before the block can be tested, the following must exist on AEM Author:
- The `product-spec` CF model (Part 1 of product-spec-cf.md)
- The `cmm-systems` CF instance (Part 2)
- The `product-spec-by-path` persisted query (Part 5 — created and published via GraphiQL IDE)

---

## Testing Checklist

| Scenario | Expected |
|---|---|
| Block added in UE with no CF selected | "Select a Content Fragment and persisted query." placeholder |
| CF selected, query filled, dark display | Dark spec table renders with all spec fields from the CF |
| Switch display to "light" | Light theme applied |
| Switch display to "debug" | Raw JSON dump of CF data |
| Viewed on EDS delivery (`aem.live`) | Same spec table rendered, data fetched from publish tier |
| CF field updated in AEM, page reloaded in UE | Updated value appears (no cache on author) |
| Invalid query path entered | "Could not load content fragment." error message |

---

## CORS Considerations

On the **author tier**, the block JS runs inside the UE iframe which is
same-origin with the AEM author — no CORS issue.

On the **EDS delivery tier** (`*.aem.live`), the browser makes a cross-origin
fetch to the AEM publish instance. The AEM Publish Dispatcher must be
configured to allow:

- **Origin**: `https://main--b2b-ue--satoshiinoue.aem.live` (and `.aem.page`)
- **Path**: `/graphql/execute.json/*`
- **Method**: `GET`
- **Headers**: `Accept`, `Content-Type`

This is a Dispatcher vhost-level config on AEM CS, not an OSGi config.
If CORS is not configurable on this shared environment, an alternative is
to proxy the GraphQL request through a Franklin worker or Edge function.

---

## Open Questions

| Question | Impact |
|---|---|
| Is the AEM Publish Dispatcher CORS configurable for this environment, or is it a shared demo system? | If not configurable, need a proxy strategy for EDS delivery |
| Should the block support `productSpecList` queries (multiple CFs) in addition to `ByPath` (single)? | Current design handles single item; list support would need a different render path |
| Should the `query` field be a select dropdown (pre-populated with known queries) instead of free text? | Better UX but requires discovering available persisted queries — may need a custom UE widget |
| How does the block behave when the CF is not yet published to the Publish tier? | On delivery, the query returns null — show a graceful empty state |
