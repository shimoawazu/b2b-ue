# DAM Asset Metadata — Fix Package-Installed Images

## Problem

DAM images installed via content package are missing proper JCR type hints
on metadata properties. Specifically, `dam:size` is stored as a plain String
(`"220416"`) instead of a typed Long (`"{Long}220416"`). When the CF API
resolves a `heroImage` reference to such an image, it calls
`Property.getLong()` on `dam:size` and gets a ClassCastException:

```
java.lang.String cannot be cast to class java.lang.Long
```

This causes a 500 error on `/adobe/sites/cf/fragments/{uuid}?references=direct`,
which the new CF editor at `experience.adobe.com` surfaces as a 404.

The `aem-guides-wknd` project doesn't have this issue because their DAM assets
were exported from a real AEM instance where images were uploaded via the UI.
The DAM ingestion workflow extracts metadata with correct JCR types. Our images
were added to the package manually via Python scripts, which wrote `dam:size`
as an untyped XML attribute (defaulting to String in JCR).

## Root Cause in Code

The Python scripts that add images to `site.zip` write:
```xml
<metadata jcr:primaryType="nt:unstructured"
    dam:MIMEtype="image/jpeg"
    dam:size="220416"/>
```

This is missing `{Long}` on `dam:size`. JCR stores it as String. Should be:
```xml
<metadata jcr:primaryType="nt:unstructured"
    dam:MIMEtype="image/jpeg"
    dam:size="{Long}220416"/>
```

Additionally, the WKND project includes image dimension properties that the CF
API and Dynamic Media also expect as Long:
```xml
tiff:ImageWidth="{Long}1600"
tiff:ImageLength="{Long}899"
dc:format="image/jpeg"
```

## Current DAM Asset Structure (incomplete)

```
{image}.jpg/
  .content.xml                         ← dam:Asset (bare, no metadata inline)
  _jcr_content/
    .content.xml                       ← dam:AssetContent + metadata (String types!)
    renditions/
      .content.xml                     ← nt:folder
      original                         ← binary JPEG
      original.dir/.content.xml        ← nt:file with jcr:mimeType
```

## Target Structure

Match the WKND pattern: single `.content.xml` with metadata inline, proper
`{Long}` type hints, and image dimensions extracted at build time.

```
{image}.jpg/
  .content.xml                         ← dam:Asset + jcr:content + metadata (all inline)
  _jcr_content/
    renditions/
      original                         ← binary JPEG
      original.dir/.content.xml        ← nt:file with jcr:mimeType
```

### Target `.content.xml` structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="..." xmlns:dam="..." xmlns:nt="..." xmlns:tiff="..."
          xmlns:dc="..." xmlns:mix="..."
    jcr:mixinTypes="[mix:referenceable]"
    jcr:primaryType="dam:Asset">
    <jcr:content
        jcr:primaryType="dam:AssetContent">
        <metadata
            jcr:mixinTypes="[cq:Taggable]"
            jcr:primaryType="nt:unstructured"
            dam:MIMEtype="image/jpeg"
            dam:size="{Long}220416"
            dc:format="image/jpeg"
            tiff:ImageWidth="{Long}1000"
            tiff:ImageLength="{Long}667"/>
        <related jcr:primaryType="nt:unstructured"/>
    </jcr:content>
</jcr:root>
```

Key differences from current:
- `dam:size` uses `{Long}` type hint
- `tiff:ImageWidth` and `tiff:ImageLength` added with `{Long}`
- `dc:format` added as String
- `mix:referenceable` mixin on root (for UUID auto-assignment)
- `metadata` has `jcr:mixinTypes="[cq:Taggable]"`
- `related` child node added
- Consolidated into single inline `.content.xml` (WKND pattern)

## Implementation Plan

### Step 1 — Extract image metadata at build time

Add a helper function to `build-packages.py` (or a separate utility) that reads
a JPEG/PNG file and extracts:
- File size in bytes → `dam:size` `{Long}`
- Image width in pixels → `tiff:ImageWidth` `{Long}`
- Image height in pixels → `tiff:ImageLength` `{Long}`
- MIME type → `dam:MIMEtype` and `dc:format`

Use Python's `PIL` (Pillow) if available, or fall back to reading JPEG headers
manually. For PNG, the IHDR chunk contains dimensions. For JPEG, the SOF marker.
If neither PIL nor manual parsing is available, use `sips` (macOS) or `identify`
(ImageMagick) via subprocess.

### Step 2 — Fix existing image entries in site.zip

Update the Python script that adds images to site.zip to:
1. Read the source image file and extract metadata
2. Generate a single `.content.xml` with all metadata inline and proper type hints
3. Remove the separate `_jcr_content/.content.xml` (consolidate into root XML)
4. Keep `_jcr_content/renditions/original` (the binary) and `original.dir/.content.xml`

### Step 3 — Apply to all images

Fix all existing images in site.zip, not just `2-people-pc-preview.jpg`:
- `solutions-medical-preview.jpg`
- `2-people-pc-preview.jpg`
- `medical-lab-preview.jpg`
- `medical-lab-group-preview.jpg`
- `woman-pc-1-preview.jpg`
- Any SVG files (SVGs don't have pixel dimensions but still need `dam:size`)

### Step 4 — Restore heroImage in CF instance

After image metadata is fixed, restore the `heroImage` field value in the
`cmm-systems` CF instance:
```
heroImage="/content/dam/b2b-ue/images/2-people-pc-preview.jpg"
```

### Step 5 — Verify hero-b2b image references in sample pages

The hero-b2b block on home pages references `solutions-medical-preview.jpg`
and the products page references `2-people-pc-preview.jpg` as background
images. These are `reference` fields stored as `image` properties on the
hero_b2b block nodes in the page `.content.xml`. With proper `{Long}` typed
metadata on these DAM assets, both Universal Editor (author tier) and
the CF API will resolve these references without errors.

No changes needed to the page XML — the image references are already correct.
The fix is entirely on the DAM asset side (Steps 1–3).

### Step 6 — Update README

Change the reprocessing note from a hard requirement to a recommendation:
- Reprocessing is still needed for Dynamic Media delivery URLs (thumbnails, web renditions)
- But CF references will work immediately after package install without reprocessing

## Files to Modify

- `build-packages.py` — or a new `scripts/dam_metadata.py` utility
- All image `.content.xml` entries inside `site.zip`
- `cmm-systems` CF instance `.content.xml` (restore heroImage)
- `README.md` — soften reprocessing note

## Risks

- The `_jcr_content/.content.xml` split vs inline `.content.xml` migration could
  cause issues if existing installed nodes expect the split structure. Use
  `mode="update"` filter to merge, or document that a delete+reinstall is needed
  for the one-time migration.
- SVG files don't have tiff:ImageWidth/Length — handle these separately
  (only set dam:size and dc:format for SVGs).
