# Product Spec — Content Fragment Model Plan

## Goal

Create a `product-spec` Content Fragment Model (the data schema/configuration
that defines what fields a product specification has) and bundle it in the content
package so it installs on AEM Author. Then create a sample Content Fragment instance
(actual product data for CMM Systems) using that model. Both the model configuration
and the sample content are packaged for any fresh install to be demo-ready.

**Two distinct things being packaged:**

| Concept | What it is | JCR location |
|---|---|---|
| **CF Model** (schema) | The field definitions — what a "product spec" contains | `/conf/b2b-ue/settings/dam/cfm/models/product-spec` |
| **CF Instance** (data) | An actual product's spec values | `/content/dam/b2b-ue/product-specs/cmm-systems` |

---

## Design Reference

**Paper node `1IF-0`** — spec table section from the CMM Systems product detail page.
7 key-value rows on a dark background:

| Label | Sample value |
|---|---|
| Measurement uncertainty | ≤ 0.05 µm (ISO 10360-2) |
| Protection rating | IP67 |
| Operating temperature | −10°C to +60°C |
| Industrial protocols | OPC-UA · EtherNet/IP · MQTT |
| Calibration standard | OIML & ISO Traceable |
| Compliance | FDA 21 CFR Part 11 · EU Annex 11 |
| Report templates | ISO/IEC 17025 compliant |

---

## Part 1 — CF Model Configuration (Schema)

### Reference: WKND project structure

The official `adobe/aem-guides-wknd-shared` project packages CF models at:
```
/conf/wknd-shared/settings/dam/cfm/models/{model-name}
```

This is the pattern we follow. Key facts from WKND:

- CF Model root node type is **`cq:Template`** (not `dam:ContentFragmentModel`)
- `jcr:content` is `cq:PageContent` with `cq:templateType="/libs/settings/dam/cfm/model-types/fragment"`
- Fields are dialog items under `jcr:content/model/cq:dialog/content/items/`
- Every intermediate directory (`settings/`, `dam/`, `cfm/`, `models/`) needs its own `.content.xml`

### Full JCR node hierarchy (every `.content.xml` needed)

```
/conf/b2b-ue/                                          ← sling:Folder (already exists, owned by QSC)
  settings/                                            ← sling:Folder
    dam/                                               ← cq:Page
      cfm/                                             ← cq:Page
        models/                                        ← cq:Page (lists child model nodes)
          product-spec/                                ← cq:Template (the model)
            _jcr_content/                              ← cq:PageContent
              model/                                   ← cq:PageContent (scaffolding)
                cq:dialog/                             ← nt:unstructured
                  content/                             ← nt:unstructured
                    items/                             ← nt:unstructured
                      {field-nodes}                    ← nt:unstructured (one per field)
```

### Field definitions

Each field is a child node under `items/` with these properties:

| Property | Purpose |
|---|---|
| `jcr:primaryType` | `nt:unstructured` |
| `sling:resourceType` | Widget type (see table below) |
| `fieldLabel` | Display name in CF editor |
| `name` | Property name on CF instances |
| `metaType` | Field category (`text-single`, `text-multi`, `number`, `enumeration`, etc.) |
| `valueType` | Data type (`string`, `long`, `double`, `string/multiline`, etc.) |
| `listOrder` | Ordering in the CF editor UI |
| `required` | `"on"` if required |

**Field type mapping:**

| Field type | `sling:resourceType` | `metaType` | `valueType` |
|---|---|---|---|
| Single-line text | `granite/ui/components/coral/foundation/form/textfield` | `text-single` | `string` |
| Multi-line text | `dam/cfm/admin/components/authoring/contenteditor/multieditor` | `text-multi` | `string` or `string/multiline` |
| Number (integer) | `granite/ui/components/coral/foundation/form/numberfield` | `number` | `long` |
| Number (decimal) | `granite/ui/components/coral/foundation/form/numberfield` | `number` | `double` |
| Enumeration (select) | `granite/ui/components/coral/foundation/form/select` | `enumeration` | `string` |
| Content ref (image) | `dam/cfm/models/editor/components/contentreference` | `reference` | `string/reference` |
| Fragment ref | `dam/cfm/models/editor/components/fragmentreference` | `fragment-reference` | `string/content-fragment` |
| Date | `dam/cfm/models/editor/components/datatypes/datepicker` | `date` | `calendar/datetime` |

### `product-spec` model fields

| # | Node name | `fieldLabel` | `name` | `metaType` | `valueType` | `required` |
|---|---|---|---|---|---|---|
| 1 | field-productName | Product Name | `productName` | `text-single` | `string` | `on` |
| 2 | field-series | Series | `series` | `text-single` | `string` | |
| 3 | field-category | Category | `category` | `text-single` | `string` | |
| 4 | field-shortDescription | Short Description | `shortDescription` | `text-multi` | `string/multiline` | |
| 5 | field-heroImage | Hero Image | `heroImage` | `reference` | `string/reference` | |
| 6 | field-measurementUncertainty | Measurement Uncertainty | `measurementUncertainty` | `text-single` | `string` | |
| 7 | field-protectionRating | Protection Rating | `protectionRating` | `text-single` | `string` | |
| 8 | field-operatingTemperature | Operating Temperature | `operatingTemperature` | `text-single` | `string` | |
| 9 | field-industrialProtocols | Industrial Protocols | `industrialProtocols` | `text-single` | `string` | |
| 10 | field-calibrationStandard | Calibration Standard | `calibrationStandard` | `text-single` | `string` | |
| 11 | field-compliance | Compliance | `compliance` | `text-single` | `string` | |
| 12 | field-reportTemplates | Report Templates | `reportTemplates` | `text-single` | `string` | |

---

## Part 2 — CF Instance (Sample Data)

CF instances are `dam:Asset` nodes with `contentFragment="{Boolean}true"`.
They live in the DAM, not under `/conf/`.

### JCR location

```
/content/dam/b2b-ue/product-specs/
  cmm-systems/                                ← dam:Asset
    _jcr_content/                             ← dam:AssetContent
      data/                                   ← nt:unstructured
        cq:model="/conf/b2b-ue/settings/dam/cfm/models/product-spec"
        master/                               ← nt:unstructured (field values)
          productName="CMM Systems"
          series="SpectraLink Series"
          category="Dimensional Metrology"
          shortDescription="Sub-micron coordinate measurement..."
          heroImage="/content/dam/b2b-ue/images/2-people-pc-preview.jpg"
          measurementUncertainty="≤ 0.05 µm (ISO 10360-2)"
          protectionRating="IP67"
          operatingTemperature="−10°C to +60°C"
          industrialProtocols="OPC-UA · EtherNet/IP · MQTT"
          calibrationStandard="OIML & ISO Traceable"
          compliance="FDA 21 CFR Part 11 · EU Annex 11"
          reportTemplates="ISO/IEC 17025 compliant"
      metadata/                               ← nt:unstructured
```

The `cq:model` property on the `data` node links the instance back to its model.
All field values are flat properties on the `master` node.

---

## Part 3 — Package Strategy

### The `/conf/b2b-ue` exclusion problem

Both packages currently strip ALL `/conf/b2b-ue` entries from site.zip
(`SITE_ZIP_SKIP_PREFIXES` in `build-packages.py`) to protect the QSC-owned
`franklin.delivery` proxy config at `/conf/b2b-ue/settings/cloudconfigs/`.

CF models live at `/conf/b2b-ue/settings/dam/cfm/models/` — a completely
different sub-tree from `cloudconfigs`.

### Solution: selective skip with a keep-list

Modify the skip logic in `build-packages.py`:

```python
SITE_ZIP_SKIP_PREFIXES = (
    "META-INF",
    "jcr_root/conf/b2b-ue",
)

# Sub-paths of conf/b2b-ue that SHOULD be kept (CF model config)
SITE_ZIP_KEEP_PREFIXES = (
    "jcr_root/conf/b2b-ue/settings/dam/cfm",
)
```

In the filter loop, check the keep-list before skipping:
```python
if any(item.filename.startswith(p) for p in SITE_ZIP_SKIP_PREFIXES):
    if not any(item.filename.startswith(k) for k in SITE_ZIP_KEEP_PREFIXES):
        skipped += 1
        continue
```

Apply the same logic in both `_cleaned_site_zip_bytes()` (template package)
and `build_fullinstall()` (full-install package).

### Filter additions

**Full-install package (`build-packages.py` `filter_xml`):**
```xml
<!-- CF models: merge — adds model definitions without touching QSC cloudconfigs -->
<filter root="/conf/b2b-ue/settings/dam/cfm" mode="merge"/>
```

**`site.zip` inner package (`_rewrite_site_zip_filter`):**
Add the same filter. Update the rewrite function to inject this filter
into site.zip's `filter.xml`.

**CF instance** — already covered by the existing
`<filter root="/content/dam/b2b-ue" mode="update"/>` filter. No change needed.

### Source files to add to site.zip

```
jcr_root/
  conf/b2b-ue/
    settings/
      .content.xml                                         ← sling:Folder
      dam/
        .content.xml                                       ← cq:Page
        cfm/
          .content.xml                                     ← cq:Page
          models/
            .content.xml                                   ← cq:Page (child refs)
            product-spec/
              .content.xml                                 ← cq:Template (THE MODEL)
  content/dam/b2b-ue/
    product-specs/
      .content.xml                                         ← sling:Folder
      cmm-systems/
        .content.xml                                       ← dam:Asset (THE INSTANCE)
        _jcr_content/
          .content.xml                                     ← dam:AssetContent + data/master
```

Note: every intermediate directory needs `.content.xml` to define the correct
`jcr:primaryType`. Missing intermediates will cause the package install to fail
or create wrong node types.

---

## Part 4 — Frontend Block

### New `product-spec` block

A dedicated block that renders a CF's spec fields as a styled key-value table.

**Block model (`models/_component-models.json`):**
```json
{
  "id": "product-spec",
  "fields": [
    {
      "component": "reference",
      "name": "specFragment",
      "label": "Product Spec Fragment",
      "multi": false
    },
    {
      "component": "select",
      "name": "theme",
      "label": "Theme",
      "valueType": "string",
      "options": [
        { "name": "Dark (default)", "value": "" },
        { "name": "Light", "value": "light" }
      ]
    }
  ]
}
```

**Block JS (`blocks/product-spec/product-spec.js`):**
- Read the CF reference path from the block's first cell
- Fetch CF data from AEM: `{cfPath}/_jcr_content/data/master.json`
- Render spec fields as key-value rows (skip `productName`, `series`,
  `category`, `shortDescription`, `heroImage` — those are metadata fields,
  not spec rows)

**CSS matches Paper node `1IF-0`:**
- Dark theme: `#001840` background, white values, muted labels, gold accent bar
- Light theme: white background, `#001428` values, `#e2e8f0` dividers

---

## Implementation Steps

### Phase 1 — CF Model (manual-first, then export)

The safest approach: create the model in AEM once, export the JCR XML, then
package it. This guarantees the XML matches the running AEM CS version.

1. Open CF Models console: Go to your AEM Author instance (set via `AEM_AUTHOR_HOST`)
   → Tools → Assets → Content Fragment Models → `b2b-ue`
2. Create new model `product-spec` with all 12 fields from the table above
3. Enable the model
4. Export via CRXDE Lite: navigate to
   `/conf/b2b-ue/settings/dam/cfm/models/product-spec` → download
5. Also export the intermediate nodes (`settings/`, `dam/`, `cfm/`, `models/`)
   to capture their correct `jcr:primaryType` values

### Phase 2 — Sample CF instance

1. In AEM Assets → `/content/dam/b2b-ue/` → create folder `product-specs`
2. Create new Content Fragment using `product-spec` model, name: `cmm-systems`
3. Fill in all field values from the design table
4. Export via CRXDE Lite

### Phase 3 — Package integration

1. Add exported model XML files to site.zip source
2. Add exported instance XML files to site.zip source
3. Update `build-packages.py`:
   - Add `SITE_ZIP_KEEP_PREFIXES` for CF model path
   - Update skip logic in `_cleaned_site_zip_bytes()` and `build_fullinstall()`
   - Add CF model filter to `filter_xml`
   - Update `_rewrite_site_zip_filter` to inject CF filter into site.zip

### Phase 4 — Frontend block

1. Create `blocks/product-spec/product-spec.js`, `.css`, `_product-spec.json`
2. Add model to `models/_component-models.json`
3. Add to section filter in `models/_component-filters.json`
4. Run `npm run build:json`

### Phase 5 — Build and verify

1. Run `python3 build-packages.py`
2. Install on AEM Author
3. Verify: CF model appears in CF Models console under `b2b-ue`
4. Verify: `cmm-systems` CF instance appears in DAM at `/content/dam/b2b-ue/product-specs/`
5. Verify: `product-spec` block is insertable in Universal Editor and renders the CF data

---

## Part 5 — Persisted GraphQL Queries

Content Fragment data is served to the frontend via AEM's GraphQL API.
Persisted queries (pre-saved, GET-cacheable queries) are the recommended
approach over ad-hoc POST queries.

### Schema auto-generation

AEM auto-generates a GraphQL schema from each CF model. For a model named
`product-spec`, the generated query entry points are:

| Query | Returns | Use case |
|---|---|---|
| `productSpecByPath(_path: String!)` | `item { ... }` (single) | Fetch one product spec by DAM path |
| `productSpecList(filter: ..., sort: ...)` | `items [ ... ]` (array) | List/filter multiple specs |

The GraphQL type is `ProductSpecModel`.

### GraphQL endpoint (packaged)

The GraphQL endpoint is bundled in the content package and installed
automatically. No manual creation needed.

**JCR path:** `/content/cq:graphql/b2b-ue/endpoint`
**Mapped conf:** `/conf/b2b-ue` (by naming convention)

See `plans/graphql-endpoint.md` for full JCR structure and packaging details.

### Persisted query (packaged)

The `product-spec-by-path` persisted query is also bundled in the content
package. It is stored in the JCR at:
```
/conf/b2b-ue/settings/graphql/persistentQueries/product-spec-by-path
```

The query text is stored as binary data (`_jcr_data.binary`). Both the endpoint
and persisted query are installed via package — they appear in the GraphiQL IDE
immediately after install.

**Query structure** (updated 2026-04-14 after model fix):
```graphql
query GetProductSpec($path: String!) {
  productSpecByPath(_path: $path) {
    item {
      _path
      productName
      series
      category
      shortDescription {
        plaintext
      }
      heroImage {
        ... on ImageRef {
          _authorUrl
          _publishUrl
        }
      }
      measurementUncertainty
      protectionRating
      operatingTemperature
      industrialProtocols
      calibrationStandard
      compliance
      reportTemplates
    }
  }
}
```

**Key notes:**
- `shortDescription` is a richtext field → query its `plaintext` property
- `heroImage` is a reference field → use `... on ImageRef { ... }` fragment to access image metadata

Persisted queries can also be created manually via GraphiQL IDE or cURL PUT:
```
PUT /graphql/persist.json/b2b-ue/<query-name>
```

### Executing a persisted query (client-side)

```
GET <AEM_HOST>/graphql/execute.json/b2b-ue/product-spec-by-path;path=<encoded-cf-path>
```

Variables are passed as semicolon-delimited key=value pairs with URL encoding:
```
GET /graphql/execute.json/b2b-ue/product-spec-by-path;path=%2Fcontent%2Fdam%2Fb2b-ue%2Fproduct-specs%2Fcmm-systems
```

### Publishing workflow on AEM Author

The persisted query must be published (replicated) to the Publish tier before
the EDS frontend can access it.

**On Author tier** — the endpoint and persisted query work immediately after
package install. The content-fragment block on the CMM Systems page should
load the spec data.

**Publishing to the delivery tier:**

The persisted query and CF instance must be published for the EDS delivery
site to access them.

1. Open GraphiQL IDE → select `b2b-ue` endpoint → select `product-spec-by-path`
   → click **Publish**
2. In AEM Assets → select the `cmm-systems` CF → click **Quick Publish**
3. Verify on Publish (use `AEM_PUBLISH_HOST` from `.env`):
   ```
   GET {AEM_PUBLISH_HOST}/graphql/execute.json/b2b-ue/product-spec-by-path;path=%2Fcontent%2Fdam%2Fb2b-ue%2Fproduct-specs%2Fcmm-systems
   ```

### Caching

Persisted queries use GET requests, making them cacheable at CDN and
Dispatcher layers:

| Layer | Header | Default |
|---|---|---|
| Browser | `cache-control: max-age` | 60s |
| CDN | `surrogate-control: max-age` | 7200s (2h) |
| CDN | `stale-while-revalidate` | 86400s (24h) |

Cache control can be set per query at creation time or globally via
Cloud Manager environment variables.

---

---

## Part 6 — Root Cause: Malformed CFM Model (GraphQL schema failure)

### Symptoms observed (2026-04-14)

| Symptom | Root cause |
|---|---|
| GraphQL introspection error: "QueryType must define one or more fields" | AEM cannot parse the model as a valid CFM → no query fields generated |
| Publish dialog shows "0 models" for Product Spec | Missing `jcr:mixinTypes="[cq:ReplicationStatus2]"` — AEM cannot track replication state |
| Model opens in new editor but **not** in classic editor | Missing `sling:resourceSuperType` / `sling:resourceType` on `jcr:content` |

### Diff against working reference (WKND CTA model)

The original `product-spec/.content.xml` was missing the following attributes/nodes
compared to the working `wknd-universal/settings/dam/cfm/models/cta` model:

**Root `<jcr:root>` node:**
- Missing `allowedPaths="[/content/dam/b2b-ue(/.*)?]"` — defines where CF instances can be created
- `status="enabled"` was incorrectly placed here (must be on `jcr:content`)
- Missing `xmlns:dam` and `xmlns:granite` namespace declarations

**`<jcr:content>` node:**
- Missing `jcr:mixinTypes="[cq:ReplicationStatus2]"` ← **critical**: enables publish/replication tracking
- Missing `sling:resourceSuperType="dam/cfm/models/console/components/data/entity"` ← **critical**: correct type hierarchy for DAM console + new editor
- Missing `sling:resourceType="dam/cfm/models/console/components/data/entity/default"` ← **critical**: correct resource type
- Missing `cq:scaffolding="/conf/b2b-ue/settings/dam/cfm/models/product-spec/jcr:content/model"` — back-reference to the scaffolding node
- Missing `cq:isDelivered="{Boolean}false"` and `isLocked="{Boolean}false"`
- Missing `<metadata jcr:primaryType="nt:unstructured"/>` child node
- Missing `<change-register jcr:primaryType="nt:unstructured"/>` child node

**`<model>` node:**
- `dataTypesConfig` path was `/mnt/overlay/settings/dam/cfm/models/formbuilderconfig`
  (missing the `/datatypes` suffix) — should be `.../formbuilderconfig/datatypes`
- Missing `cq:targetPath="/content/dam/b2b-ue"` — where fragment instances can be stored
- Missing `maxGeneratedOrder="12"`

**Field nodes (all):**
- Missing `renderReadOnly="false"` and `showEmptyInReadOnly="true"`
- Missing `maxlength="255"` on single-line text fields
- Missing `<granite:data jcr:primaryType="nt:unstructured"/>` child element
- `listOrder` used `{Long}` type hint; should be plain string (WKND format: `listOrder="1"`)

**`shortDescription` field specifically:**
- `valueType` was `"string"` → must be `"string/multiline"`
- Missing `cfm-element`, `checked`, `default-mime-type` attributes

**`heroImage` field specifically:**
- `valueType` was `"string"` → must be `"string/reference"`
- Missing `filter="hierarchy"`, `nameSuffix="contentReference"`, `rootPath="/content/dam"`, `showThumbnail="false"`
- `<granite:data>` needs `thumbnail-validation="cfm.validation.thumbnail.show"`

**`models/.content.xml` parent folder:**
- Was `sling:Folder` → changed to `cq:Page` (matching WKND pattern)
- Added `<jcr:content/>` and `<product-spec/>` child references

### Fix applied

`site.zip` was updated (via `fix-cfm-model.py`) with the corrected
`product-spec/.content.xml` and `models/.content.xml`. Then `build-packages.py`
was re-run to regenerate `b2b-ue-site-1.0.0.zip` and `b2b-ue-template-1.0.0.zip`.

---

## Open Questions

| Question | Impact |
|---|---|
| Does CF model install via package work if `/conf/b2b-ue` was created by QSC? Need to verify the intermediate nodes (`settings/dam/cfm/models`) don't conflict with existing nodes. | Test with `mode="merge"` — should be additive |
| Should we add more CF models for other product types (e.g. `optical-system`, `force-tester`)? Or is `product-spec` generic enough for all products? | Current model covers the spec table fields; product-specific fields could be added later |
| Should the intermediate conf nodes (`settings/dam/cfm/models`) use `mode="merge"` or `mode="update"` in the filter? WKND uses `mode="update"` on the full `/conf/wknd-shared` path. | `merge` is safer for our case since we only own the `dam/cfm` sub-tree |
| ~~Does AEM CS auto-create a GraphQL endpoint?~~ | **Resolved** — QSC does NOT create it. Now packaged at `/content/cq:graphql/b2b-ue/endpoint`. See `plans/graphql-endpoint.md`. |
