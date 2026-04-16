# Header/Footer Logo Configuration — EDS+XWalk Fragment Pattern

## Overview

This document describes the correct pattern for configuring header and footer logos in the b2b-ue EDS+XWalk architecture. The pattern is based on how the reference demo (WKND Universal) implements header/footer, where logos are part of the fragment content, not separate block properties.

## Current Problem

- Header and footer are implemented as special decorators (not selectable blocks in Universal Editor)
- The sample nav and footer pages contain plain text/image/list blocks
- Logo configuration was unclear — attempted to add header/footer block properties to .content.xml files, which doesn't follow the EDS pattern
- Reference demo shows the correct pattern: **logos are image blocks within the nav/footer fragment pages**

## Architecture Pattern

### How It Works

1. **Fragment Pages** (`/content/b2b-ue/language-masters/{lang}/nav/` and `footer/`)
   - Contain plain content blocks: sections with image, text, list blocks
   - The **first image block** in each page is the logo
   - Remaining content is navigation, footer links, copyright text, etc.

2. **Page Footer Block** (the `<footer/>` node on pages)
   - Rendered on the page (e.g., home page)
   - Minimal/empty — just a marker for the decorator to apply to
   - Logo properties are NOT configured on this block

3. **Header/Footer Decorators** (`blocks/header/header.js`, `blocks/footer/footer.js`)
   - Apply to the footer/header block on the page
   - Load the fragment from `/nav` or `/footer` path
   - Extract logo from the loaded fragment's **first image block**
   - Combine logo with fragment content and render

### Fragment Content Structure

**nav/.content.xml:**
```
<section>
  <image> — Logo ONLY (used as header logo, no text block)
    image="/content/dam/b2b-ue/images/lumina-noventis-logo.svg"
    imageAlt="Lumina Noventis"
</section>
<section>
  <text> — Navigation menu <ul>
</section>
<section>
  <search> — Search block
</section>
```

**footer/.content.xml:**
```
<section_logo>
  <image> — Logo ONLY (used as footer logo, no text block)
    image="/content/dam/b2b-ue/images/lumina-noventis-logo.svg"
</section_logo>
<section_brand>
  <text> — Brand description
</section_brand>
<section_nav>
  <list> — Footer navigation lists
</section_nav>
```

## Implementation Changes

### 1. Update `blocks/header/header.js`

**Change:** Modify `extractLogoConfig()` to extract logo from the loaded fragment's first image, not from block properties.

**Current behavior:**
- Reads logo from block element's rendered cells or data attributes
- Does not use fragment content

**New behavior:**
- Load fragment first
- Find the first image block in the fragment
- Extract image URL and alt text as logo
- Fall back to data attributes if no image found

**Code change:**
```javascript
export default async function decorate(block) {
  const langCode = getLanguage();
  const siteName = await getSiteName();
  
  let navPath = `/${langCode}/nav`;
  if (isAuthor) {
    navPath = navMeta
      ? new URL(navMeta, window.location).pathname
      : `/content/${siteName}${PATH_PREFIX}/${langCode}/nav`;
  }
  
  // Load fragment FIRST
  const fragment = await loadFragment(navPath);
  
  // Extract logo from first image in loaded fragment
  const { logoUrl, logoAlt, brandName } = extractLogoFromFragment(fragment);
  
  // ... rest of decorator
}

function extractLogoFromFragment(fragment) {
  const firstImage = fragment.querySelector('img');
  
  if (firstImage) {
    return {
      logoUrl: firstImage.src,
      logoAlt: firstImage.alt || '',
      brandName: firstImage.closest('section')?.nextElementSibling?.textContent?.trim() || '',
    };
  }
  
  // Fallback to empty/default if no image found
  return {
    logoUrl: '',
    logoAlt: '',
    brandName: '',
  };
}
```

### 2. Update `blocks/footer/footer.js`

**Same change as header** — extract logo from fragment's first image block.

### 3. Update `content-source/jcr_root/content/b2b-ue/language-masters/en/nav/.content.xml`

**Add:** Image block at the start of the nav page with the bundled logo.

**Change:**
- Add a section with an image block as the first section
- Reference the bundled logo: `/content/dam/b2b-ue/images/lumina-noventis-logo.svg`
- Include imageAlt for accessibility

### 4. Update `content-source/jcr_root/content/b2b-ue/language-masters/en/footer/.content.xml`

**Add:** Image block at the start of the footer page with the bundled logo.

**Change:**
- Add a section with an image block as the first section in the footer page
- Reference the bundled logo: `/content/dam/b2b-ue/images/lumina-noventis-logo.svg`
- Include imageAlt for accessibility

### 5. Repeat for all languages

The same logo image block structure should be added to:
- `nav/.content.xml` for all 8 languages (en, ja, zh, ko, es, de, fr, ar)
- `footer/.content.xml` for all 8 languages

All languages use the same bundled logo path (`/content/dam/b2b-ue/images/lumina-noventis-logo.svg`), not language-specific logos.

## Files Modified

1. `blocks/header/header.js` — add `extractLogoFromFragment()` function, refactor decorator to load fragment first
2. `blocks/footer/footer.js` — add `extractLogoFromFragment()` function, refactor decorator to load fragment first
3. `content-source/jcr_root/content/b2b-ue/language-masters/en/nav/.content.xml` — add image block at start
4. `content-source/jcr_root/content/b2b-ue/language-masters/ja/nav/.content.xml` — add image block at start
5. `content-source/jcr_root/content/b2b-ue/language-masters/zh/nav/.content.xml` — add image block at start
6. `content-source/jcr_root/content/b2b-ue/language-masters/ko/nav/.content.xml` — add image block at start
7. `content-source/jcr_root/content/b2b-ue/language-masters/es/nav/.content.xml` — add image block at start
8. `content-source/jcr_root/content/b2b-ue/language-masters/de/nav/.content.xml` — add image block at start
9. `content-source/jcr_root/content/b2b-ue/language-masters/fr/nav/.content.xml` — add image block at start
10. `content-source/jcr_root/content/b2b-ue/language-masters/ar/nav/.content.xml` — add image block at start
11. `content-source/jcr_root/content/b2b-ue/language-masters/en/footer/.content.xml` — add image block at start (+ all other languages)
12. `content-source/jcr_root/content/b2b-ue/language-masters/*/footer/.content.xml` — add image block at start (all 8 languages)

## Benefits of This Approach

✅ **Follows EDS reference pattern** — matches WKND Universal implementation  
✅ **No header/footer block properties in .content.xml** — keeps fragment pages as plain content blocks  
✅ **Logo is editable via UE** — authors can change the image block in nav/footer pages  
✅ **Consistent across decorators** — both header and footer use same extraction pattern  
✅ **Fallback support** — data attributes still work if needed for special cases  

## Notes

- The bundled logo is `/content/dam/b2b-ue/images/lumina-noventis-logo.svg`
- **Logo image only** — the nav section contains ONLY the image block, no text block (removed to prevent horizontal squashing)
- All languages share the same logo image (not localized)
- If a page/language needs a different logo, it can be changed in that language's nav/footer page
- The old `extractLogoConfig()` function that reads from block properties can be removed or kept as a fallback
- Logo extraction happens in `extractLogoFromFragment()` which reads the first `<img>` element from the loaded fragment
