import { getPathDetails } from '../../scripts/utils.js';

function formatLabel(slug) {
  return slug
    .replace(/\.html$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Breadcrumb block.
 * Configured with a single `parentLabel` text field (e.g. "News") — UE authors
 * set this once on the block. The block auto-derives the parent href from the
 * current URL, and uses the page's <h1> as the current-page crumb label.
 *
 * Gracefully degrades to URL-slug labels when the block is added without config.
 */
export default function decorate(block) {
  const { prefix, suffix, langCode } = getPathDetails();
  const base = prefix ? `${prefix}/${langCode}` : `/${langCode}`;

  // Read authored parent label from the block's first cell (text JCR property)
  const firstCell = block.querySelector(':scope > div:first-child > div');
  const configuredLabel = firstCell?.textContent?.trim() || '';

  // Derive path segments from suffix (strip .html, split)
  const segments = suffix.replace(/\.html$/, '').split('/').filter(Boolean);

  // Build parent crumbs (all segments except the last)
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  const ol = document.createElement('ol');

  let cumPath = base;
  for (let i = 0; i < segments.length - 1; i += 1) {
    cumPath += `/${segments[i]}`;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = cumPath;
    // Use configured label for the immediate parent (first parent segment)
    a.textContent = (i === segments.length - 2 && configuredLabel)
      ? configuredLabel
      : formatLabel(segments[i]);
    li.append(a);
    ol.append(li);
  }

  // Current page crumb — prefer the page's h1 over document.title
  if (segments.length > 0) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.setAttribute('aria-current', 'page');
    const h1 = document.querySelector('main h1') || document.querySelector('h1');
    const pageTitle = h1?.textContent?.trim()
      || document.title.split('|')[0].trim()
      || formatLabel(segments[segments.length - 1]);
    span.textContent = pageTitle;
    li.append(span);
    ol.append(li);
  }

  nav.append(ol);

  // Replace block content
  while (block.firstChild) block.firstChild.remove();
  block.append(nav);
}
