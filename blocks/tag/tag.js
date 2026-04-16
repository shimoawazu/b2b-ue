/**
 * Tag block — displays a styled category badge.
 *
 * Priority order for badge data:
 *   1. Explicit `category` / `variant` block fields (set via UE Properties panel)
 *   2. `<meta name="category">` in page head (available on EDS delivery)
 *   3. Page JCR `.2.json` fetch — reads `cq:tags` or `category` property
 *      (used on AEM author tier where meta tags from page properties are not injected)
 */
import { isAuthorEnvironment } from '../../scripts/scripts.js';

const SLUG_TO_LABEL = {
  'product-launch': 'PRODUCT LAUNCH',
  'white-paper': 'WHITE PAPER',
  company: 'COMPANY',
  'industry-insight': 'INDUSTRY INSIGHT',
  'technical-note': 'TECHNICAL NOTE',
};

function parseTagSlug(rawTag) {
  // e.g. 'b2b-ue:news-category/product-launch' or '[b2b-ue:news-category/product-launch]'
  const tagId = String(rawTag)
    .replace(/^\[/, '').replace(/\]$/, '')
    .replace(/^[^:]+:/, ''); // strip namespace prefix
  const slug = tagId.split('/').pop() || '';
  return { slug, label: SLUG_TO_LABEL[slug] || slug.replace(/-/g, ' ').toUpperCase() };
}

function renderBadge(block, category, variant) {
  const slug = variant || category.toLowerCase().replace(/[\s/]+/g, '-');
  const badge = document.createElement('span');
  badge.className = `tag-badge tag-badge--${slug}`;
  badge.textContent = category;
  while (block.firstChild) block.firstChild.remove();
  block.append(badge);
}

export default async function decorate(block) {
  const rows = [...block.children];
  const get = (i) => rows[i]?.querySelector('div')?.textContent?.trim() || '';

  const category = get(0);
  const variant = get(1);

  // 1. Explicit block fields — fastest path
  if (category) {
    renderBadge(block, category, variant);
    return;
  }

  // 2. EDS delivery: flat `category` page property → <meta name="category">
  const metaCat = document.querySelector('meta[name="category"]')?.content?.trim();
  if (metaCat) {
    renderBadge(block, metaCat);
    return;
  }

  // 3. AEM author tier: fetch page JCR to read cq:tags or category
  if (isAuthorEnvironment()) {
    try {
      const pagePath = window.location.pathname.replace(/\.html$/, '');
      const resp = await fetch(`${pagePath}.2.json`);
      if (resp.ok) {
        const data = await resp.json();
        const jcr = data['jcr:content'] || data;

        // Try cq:tags (set via aem-tag picker in Page Properties)
        let rawTags = jcr['cq:tags'];
        if (Array.isArray(rawTags)) rawTags = rawTags[0];
        if (rawTags) {
          const { slug, label } = parseTagSlug(rawTags);
          renderBadge(block, label, slug);
          return;
        }

        // Fallback: plain category text property
        const cat = String(jcr.category || '').trim();
        if (cat) {
          renderBadge(block, cat);
          return;
        }
      }
    } catch {
      // silent fail — block stays hidden below
    }
  }

  block.style.setProperty('display', 'none');
}
