---
name: eds
description: AEM Edge Delivery Services (EDS) + Universal Editor (XWalk) development assistant for the finehotel-ue project. Use this skill whenever the user wants to: create or customize a block (JS decorator, CSS, JSON), edit component models or definitions, add fields to the Universal Editor property panel, change theming or CSS variables, update component filters, or run the JSON build pipeline. Trigger on phrases like "add a block", "new block", "customize hero", "add a field", "change theme", "edit model", "update filter", "build json", or anything related to AEM EDS block development.
---

# AEM EDS / XWalk Development Skill

Full documentation is in `docs/` (English) and `docs/ja/` (Japanese).

## Quick Reference

**Build command — run after any `_*.json` change:**
```bash
npm run build:json
```

**Never edit root `component-*.json`** — always edit source files in `models/` or `blocks/{name}/_{name}.json`.

---

## Workflow by Task

### Create a new block

1. Read `blocks/hero/hero.js` and `blocks/cards/cards.js` as pattern references
2. Create `blocks/{name}/{name}.js` — `export default function decorate(block) { ... }`
3. Create `blocks/{name}/{name}.css`
4. Create `blocks/{name}/_{name}.json` — definitions + filters only (the `models` section here is NOT used by the build)
5. Add the block's model fields to `models/_component-models.json` — this is the only file that feeds `component-models.json`
6. Add block name to `section` filter in `models/_component-filters.json`
7. Run `npm run build:json`

See `docs/block-development.md` for full patterns and field type reference.

### Add/edit a field in Universal Editor

**CRITICAL — build system architecture:**

`component-models.json` is generated **solely** from `models/_component-models.json`.
The `models` arrays inside `blocks/{name}/_{name}.json` are **NOT** read by the build.
They exist for documentation/tooling reference only and have no effect on the output.

| What you want to change | Where to edit |
|---|---|
| A block's UE property fields | `models/_component-models.json` — find or add the model by `"id"` |
| A block's definition/template defaults | `blocks/{name}/_{name}.json` → `definitions[].plugins.xwalk.page.template` |
| Section/component filter (what blocks are insertable) | `models/_component-filters.json` |

After any edit, run `npm run build:json`.

**Common mistake:** editing `blocks/{name}/_{name}.json` → `models` and wondering why
UE properties didn't change. Always edit `models/_component-models.json` for that.

See `docs/component-models.md` for all field component types.

### Add a new theme

1. Add `body.{theme-name} { --brand-*: ...; }` to `styles/styles.css`
2. Add `{ "name": "...", "value": "{theme-name}" }` to the `theme` select in `models/_component-models.json` **and** `models/_page.json` (both files)
3. Run `npm run build:json`

See `docs/theming.md` for CSS variable reference.

### Add a layout variant to an existing block (e.g. Hero)

1. Add option to the select field in `blocks/{name}/_{name}.json`
2. Add CSS for `.{block-name}.{variant-value} { ... }` in `{name}.css`
3. Run `npm run build:json` — no JS change needed if the decorator already does `block.classList.add(value)`

---

## Key Patterns

### Reading a config field and applying as CSS class

```javascript
export default function decorate(block) {
  const value = block.querySelector(':scope div:nth-child(N) > div')?.textContent?.trim() || 'default';
  block.classList.add(value);
  block.querySelector(':scope div:nth-child(N)')?.style.setProperty('display', 'none');
}
```

### Restructuring DOM — always use `moveInstrumentation`

```javascript
import { moveInstrumentation } from '../../scripts/scripts.js';

const li = document.createElement('li');
moveInstrumentation(row, li); // preserves data-aue-* attributes for Universal Editor
while (row.firstElementChild) li.append(row.firstElementChild);
```

### Universal Editor editability — how it works

`component-models.json` drives the **Properties panel** automatically. All model
fields appear there when you select a block — no JS changes needed.

For **inline canvas editing** (clicking directly on text in the WYSIWYG), UE looks
for `data-aue-prop` on DOM elements. AEM injects those onto the original rendered
cells at server-render time. The `title` block works without a decorator because
those cells are never modified.

**Never use `block.innerHTML = '...'` in a decorator.** It:
- discards every original cell (and their AEM-injected `data-aue-*` attributes)
- triggers a full DOM re-parse (performance cost)
- creates an XSS surface when interpolating content values (especially URLs) into strings

**Always use DOM API** (`createElement`, `appendChild`, `textContent`) with
`moveInstrumentation` to transfer the original cell's UE attributes to the new element.

#### Pattern A — restructure without creating new content nodes (preferred)
When the new element can wrap the original cell's children, move them in.
The original children keep their UE attributes. See `blocks/cards/cards.js`.

```javascript
const li = document.createElement('li');
moveInstrumentation(row, li);         // transfer row's data-aue-* to li
while (row.firstElementChild) li.append(row.firstElementChild);  // preserve children
```

#### Pattern B — rebuild with different semantics (complex blocks like hero)
`text`, `select`, `boolean`, and `number` fields are JCR **properties** on the block
node — AEM does **not** inject `data-aue-prop` on their rendered cells. Calling
`moveInstrumentation` on those cells copies nothing useful.

For inline canvas editing of text properties, the decorator must **explicitly** set
`data-aue-prop`, `data-aue-type`, and `data-aue-label` on the new elements via DOM API:

```javascript
// Helper keeps it DRY across many fields
function ueText(el, prop, label) {
  el.dataset.aueProp = prop;
  el.dataset.aueType = 'text';
  el.dataset.aueLabel = label;
  return el;
}

const h1 = ueText(document.createElement('h1'), 'header', 'Headline');
h1.className = 'my-headline';
h1.textContent = headlineCell?.textContent?.trim() || '';
contentDiv.append(h1);
```

`moveInstrumentation` is still needed for `reference`/`richtext` fields because
those create child JCR nodes with a dynamic `data-aue-resource` path:

```javascript
moveInstrumentation(bgImg, optimized.querySelector('img')); // reference
moveInstrumentation(descCell, descDiv);                     // richtext
```

Use CSS `::before`/`::after` for purely decorative elements (overlays, dividers,
accent bars) — keeps the JS lean and those nodes out of the UE content tree.
See `blocks/hero-b2b/` for a complete example.

### Optimizing images

```javascript
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const pic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
moveInstrumentation(img, pic.querySelector('img'));
img.closest('picture').replaceWith(pic);
```

### Author-tier data fetching — never fetch per-page HTML

When a block needs to display data from child pages on the AEM author tier, always use
a single `.2.json` Sling GET request. **Never** fire per-page `.html` fetches to parse
meta tags — each one triggers a full server-side page render on the author, saturating
the request queue and blocking the entire page load in Universal Editor.

**Wrong — N full page renders:**
```js
// fetches page.html for every child just to read og:image — do NOT do this
await Promise.all(pages.map(async (page) => {
  const resp = await fetch(`${page.jcrPath}.html`);
  const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
  page.image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
}));
```

**Correct — image as a flat JCR page property:**
```js
// Add a `reference` field to page-metadata in _component-models.json.
// Authors set it once in UE page properties.
// It's already in the .2.json response — zero extra requests.
const image = content.featuredImage || '';
```

The rule: any data needed by a listing block must be **a flat property on `jcr:content`**
(set via a page-metadata model field) so it's available in the `.2.json` depth-2 response.
See `plans/list-block.md` for the full rationale and the `featuredImage` implementation.

---

## Block JSON Skeleton

`blocks/{name}/_{name}.json` — definitions + filters only:
```json
{
  "definitions": [{
    "title": "My Block", "id": "my-block",
    "plugins": { "xwalk": { "page": {
      "resourceType": "core/franklin/components/block/v1/block",
      "template": { "name": "My Block", "model": "my-block" }
    }}}
  }],
  "filters": []
}
```

`models/_component-models.json` — add the model entry here (the ONLY place it takes effect):
```json
{
  "id": "my-block",
  "fields": [
    { "component": "text",      "name": "title",  "label": "Title",  "valueType": "string" },
    { "component": "richtext",  "name": "text",   "label": "Body",   "valueType": "string" },
    { "component": "reference", "name": "image",  "label": "Image",  "multi": false },
    { "component": "select",    "name": "style",  "label": "Style",
      "options": [{ "name": "Default", "value": "" }, { "name": "Dark", "value": "dark" }] }
  ]
}
```
