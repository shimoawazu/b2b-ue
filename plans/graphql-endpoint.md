# GraphQL Endpoint & Persisted Queries — Package Configuration Plan

## Problem

The `content-fragment` block fetches CF data via AEM's persisted GraphQL
queries, but the b2b-ue project has no GraphQL endpoint configured. The
GraphiQL IDE shows no `b2b-ue` endpoint — only endpoints from other projects
(WKND-Universal, Automotive-UE, Ref Demo EDS).

Without an endpoint, persisted queries cannot be created or executed for the
`b2b-ue` configuration, and the content-fragment block shows "Could not load
content fragment."

## References

Structure verified against:
- `reference-demo-v2.7.5.zip` (`ref-demo-eds` project) — exported from an
  AEM CS instance (set via `AEM_AUTHOR_HOST` environment variable)
- `adobe/aem-guides-wknd-shared` GitHub repository
- [AEM GraphQL Endpoint docs](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/graphql-endpoint)
- [AEM Persisted Queries docs](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/persisted-queries)

## What Needs to Be Packaged

### 1. GraphQL Endpoint

**JCR path:** `/content/cq:graphql/b2b-ue/endpoint`

The folder name `b2b-ue` under `cq:graphql/` maps by convention to the Sites
configuration at `/conf/b2b-ue`. AEM resolves CF models from that conf when
the endpoint is queried. No explicit property pointing to `/conf/` is needed.

**Filesystem path in site.zip (colon-escaped):**
```
jcr_root/content/_cq_graphql/b2b-ue/
  .content.xml                               ← sling:Folder
  endpoint/
    .content.xml                             ← the endpoint node
```

**Parent folder `.content.xml`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="sling:Folder"/>
```

**Endpoint `.content.xml`** (matches ref-demo-eds):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
          xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="nt:unstructured"
    jcr:title="B2B UE"
    sling:resourceType="graphql/sites/components/endpoint"/>
```

### 2. Persisted Query: `product-spec-by-path`

**JCR path:** `/conf/b2b-ue/settings/graphql/persistentQueries/product-spec-by-path`

**Key finding from ref-demo:** all persisted queries are defined as **inline
child nodes** within `persistentQueries/.content.xml`. The binary query text
is stored separately in `{queryName}/_jcr_content/_jcr_data.binary`. The
inline XML uses `jcr:data="{Binary}\0"` as a placeholder that references the
external binary file.

**Filesystem path in site.zip:**
```
jcr_root/conf/b2b-ue/settings/graphql/
  .content.xml                                          ← cq:Page with <persistentQueries/>
  persistentQueries/
    .content.xml                                        ← cq:Page with query nodes inline
    product-spec-by-path/                               ← directory for binary data
      _jcr_content/
        _jcr_data.binary                                ← the actual GraphQL query text
```

**`graphql/.content.xml`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
    jcr:primaryType="cq:Page">
    <persistentQueries/>
</jcr:root>
```

**`persistentQueries/.content.xml`** (query defined inline, matches ref-demo):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
          xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="cq:Page">
    <jcr:content jcr:primaryType="nt:unstructured"/>
    <product-spec-by-path
        jcr:primaryType="nt:unstructured"
        sling:resourceType="graphql/persistent/query">
        <jcr:content
            jcr:data="{Binary}\0"
            jcr:mimeType="text/html"
            jcr:primaryType="nt:unstructured"
            sling:resourceType="graphql/persistent/query/content"/>
    </product-spec-by-path>
</jcr:root>
```

**`product-spec-by-path/_jcr_content/_jcr_data.binary`:**
```graphql
query GetProductSpec($path: String!) {
  productSpecByPath(_path: $path) {
    item {
      _path
      productName
      series
      category
      shortDescription
      heroImage
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

### 3. Filter entries

**Full-install package (`build-packages.py`):**
```xml
<filter root="/content/cq:graphql/b2b-ue" mode="merge"/>
<filter root="/conf/b2b-ue/settings/graphql" mode="merge"/>
```

**`SITE_ZIP_KEEP_PREFIXES` in `build-packages.py`:**
```python
SITE_ZIP_KEEP_PREFIXES = (
    "jcr_root/conf/b2b-ue/settings/dam/cfm",
    "jcr_root/conf/b2b-ue/settings/graphql",
)
```

## Implementation Steps

### Step 1 — Add GraphQL endpoint to site.zip

Add these entries:
- `jcr_root/content/_cq_graphql/b2b-ue/` (directory)
- `jcr_root/content/_cq_graphql/b2b-ue/.content.xml` (sling:Folder)
- `jcr_root/content/_cq_graphql/b2b-ue/endpoint/` (directory)
- `jcr_root/content/_cq_graphql/b2b-ue/endpoint/.content.xml` (endpoint node)

### Step 2 — Add persisted query to site.zip

Add these entries:
- `jcr_root/conf/b2b-ue/settings/graphql/.content.xml`
- `jcr_root/conf/b2b-ue/settings/graphql/persistentQueries/.content.xml`
- `jcr_root/conf/b2b-ue/settings/graphql/persistentQueries/product-spec-by-path/` (directory)
- `jcr_root/conf/b2b-ue/settings/graphql/persistentQueries/product-spec-by-path/_jcr_content/` (directory)
- `jcr_root/conf/b2b-ue/settings/graphql/persistentQueries/product-spec-by-path/_jcr_content/_jcr_data.binary`

### Step 3 — Update build-packages.py

- Add `"jcr_root/conf/b2b-ue/settings/graphql"` to `SITE_ZIP_KEEP_PREFIXES`
- Add `<filter root="/content/cq:graphql/b2b-ue" mode="merge"/>` to full-install filter XML
- Add `<filter root="/conf/b2b-ue/settings/graphql" mode="merge"/>` to full-install filter XML
- Update `_rewrite_site_zip_filter` to inject the GraphQL filters into site.zip

### Step 4 — Rebuild packages and verify

After install:
1. GraphQL endpoint `B2B UE` appears in the GraphQL endpoints console
2. `product-spec-by-path` query appears in GraphiQL IDE under the b2b-ue endpoint
3. The content-fragment block on the CMM Systems page loads the spec data

## Risks

- The persisted query references `productSpecByPath` which is auto-generated
  from the CF model name `product-spec`. If the model name or its GraphQL
  type mapping differs on this AEM CS version, the query will fail. Test by
  running the query in GraphiQL IDE after install.
- The endpoint must be **published** (replicated) to work on the publish tier.
  Package install on author does not auto-publish. Add a note to README.
