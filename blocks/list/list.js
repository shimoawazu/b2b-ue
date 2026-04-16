import ffetch from '../../scripts/ffetch.js';
import { createOptimizedPicture } from '../../scripts/aem.js';
import { isAuthorEnvironment } from '../../scripts/scripts.js';

/**
 * Reads the block's authored field values from its DOM rows.
 * Each row maps to one model field in definition order:
 *   0: rootPath, 1: sortBy, 2: showDescription, 3: showImage, 4: showDate,
 *   5: limit, 6: paginate, 7: pageSize, 8: urlState, 9: listStyle,
 *   10: readMoreText, 11: heading
 * @param {Element} block
 * @returns {{ rootPath: string, sortBy: string, showDescription: boolean,
 *   showImage: boolean, showDate: boolean, limit: number,
 *   paginate: boolean, pageSize: number, urlState: boolean, listStyle: string,
 *   readMoreText: string, heading: string }}
 */
function readConfig(block) {
  const rows = [...block.children];
  const get = (i) => rows[i]?.textContent?.trim() || '';
  return {
    rootPath: localizeRootPath(get(0) || '/news'),
    sortBy: get(1) || 'alphabetical',
    showDescription: get(2) === 'true',
    showImage: get(3) === 'true',
    showDate: get(4) === 'true',
    limit: parseInt(get(5), 10) || 0,
    paginate: get(6) === 'true',
    pageSize: parseInt(get(7), 10) || 5,
    urlState: get(8) === 'true',
    listStyle: get(9) || 'card',
    readMoreText: get(10) || '',
    heading: get(11) || '',
  };
}

/**
 * Returns the locale of the current page.
 * Prefers document.documentElement.lang (set by scripts.js), then falls back to
 * the first path segment of window.location.pathname.
 * @returns {string} e.g. "ja", "en", "ar"
 */
function getCurrentLocale() {
  const htmlLang = document.documentElement.lang;
  if (htmlLang) return htmlLang.split('-')[0].toLowerCase();
  const seg = window.location.pathname.replace(/^\//, '').split('/')[0];
  return seg || 'en';
}

/**
 * Replaces (or prepends) the locale segment in rootPath so it always
 * matches the current page locale. This allows a single block configuration
 * (e.g. authored as "/en/news" or simply "/news") to work across all locales.
 *
 * Examples on the /ja page:
 *   "/en/news"  → "/ja/news"   (lang segment replaced)
 *   "/news"     → "/ja/news"   (locale prepended)
 *   "/ja/news"  → "/ja/news"   (already correct, no change)
 *
 * @param {string} rootPath  Authored path, e.g. "/en/news" or "/news"
 * @returns {string}
 */
function localizeRootPath(rootPath) {
  const locale = getCurrentLocale();
  const normalized = rootPath.startsWith('/') ? rootPath : `/${rootPath}`;
  const parts = normalized.replace(/^\//, '').split('/');
  // If the first segment looks like a language code (2–4 lowercase letters), replace it
  if (/^[a-z]{2,4}$/.test(parts[0])) {
    parts[0] = locale;
    return `/${parts.join('/')}`;
  }
  // No lang prefix — prepend the current locale
  return `/${locale}${normalized}`;
}

/**
 * Derives the language code (e.g. "en") from an EDS rootPath (e.g. "/en/news").
 * @param {string} rootPath
 * @returns {string}
 */
function getLangFromPath(rootPath) {
  return rootPath.replace(/^\//, '').split('/')[0] || 'en';
}

/**
 * Maps an EDS rootPath (e.g. "/en/news") to a JCR content path for use on the author tier.
 * The author URL follows /content/{site}/{country}/{lang}/...; we locate the lang segment
 * and reconstruct the path by appending the rootPath's sub-path after the lang code.
 * @param {string} rootPath  e.g. "/en/news"
 * @param {string} langCode  e.g. "en"
 * @returns {string|null} JCR path, or null if mapping fails
 */
function resolveJcrRoot(rootPath, langCode) {
  // Strip .html so /en.html is treated the same as /en/sub/page.html
  const pathname = window.location.pathname.replace(/\.html$/, '');
  const parts = pathname.split('/');
  const langIdx = parts.indexOf(langCode);
  if (langIdx === -1) return null;
  const contentRoot = parts.slice(0, langIdx + 1).join('/');

  // Strip the leading "/{lang}" from rootPath to get the sub-path (e.g. "/news")
  const subPath = rootPath.replace(new RegExp(`^\\/${langCode}`), '');
  return `${contentRoot}${subPath}`;
}

/**
 * Fetches child pages from the AEM JCR on the author tier.
 * Uses the Sling GET servlet (.2.json) — a single request returns all child
 * page metadata including the featuredImage property set via page properties.
 * No per-page HTML fetches are needed.
 * @param {string} rootPath  EDS-style path, e.g. "/en/news"
 * @param {string} langCode
 * @returns {Promise<Array>}
 */
async function fetchAuthorListPages(rootPath, langCode) {
  const jcrRoot = resolveJcrRoot(rootPath, langCode);
  if (!jcrRoot) return [];

  try {
    const resp = await fetch(`${jcrRoot}.2.json`);
    if (!resp.ok) return [];
    const json = await resp.json();

    const pages = [];
    Object.entries(json).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      if (value['jcr:primaryType'] !== 'cq:Page') return;
      const content = value['jcr:content'] || {};
      const title = content['jcr:title'] || key;
      const lastModifiedRaw = content['cq:lastModified'] || content['jcr:lastModified'] || '';

      // Derive category: prefer cq:tags (AEM tagging), fall back to plain text property.
      // cq:tags stores IDs like "b2b-ue:news-category/product-launch" → "PRODUCT LAUNCH"
      let category = '';
      const cqTags = content['cq:tags'];
      if (Array.isArray(cqTags) && cqTags.length > 0) {
        const tagId = String(cqTags[0]);
        const slug = tagId.split('/').pop() || tagId.split(':').pop() || '';
        category = slug.replace(/-/g, ' ').toUpperCase();
      } else if (typeof cqTags === 'string' && cqTags) {
        const slug = cqTags.split('/').pop() || cqTags.split(':').pop() || '';
        category = slug.replace(/-/g, ' ').toUpperCase();
      } else {
        category = content.category || '';
      }

      // featuredImage is a reference property set directly on jcr:content via the
      // page-metadata "Article" tab in Universal Editor. Reading it here costs nothing
      // extra — it's already in the .2.json response. No per-page HTML fetch needed.
      const image = content.featuredImage || '';

      pages.push({
        path: `${rootPath}/${key}`,
        title,
        description: content['jcr:description'] || '',
        image,
        category,
        lastModified: lastModifiedRaw ? new Date(lastModifiedRaw).getTime() / 1000 : 0,
        listOrder: parseInt(content.listOrder, 10) || null,
      });
    });

    return pages;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('List block: failed to fetch author page list', e);
    return [];
  }
}

/**
 * Fetches published pages from the EDS query index.
 * First tries a scoped index at {rootPath}/query-index.json (small, fast).
 * Falls back to /{lang}/query-index.json with path-prefix filtering if the scoped index
 * returns a 404 (i.e. no dedicated index exists for that path yet).
 * @param {string} rootPath  e.g. "/en/news"
 * @param {string} langCode  e.g. "en"
 * @returns {Promise<Array>}
 */
async function fetchPublishedListPages(rootPath, langCode) {
  const base = (window.hlx && window.hlx.codeBasePath) || '';

  // Try scoped index first
  const scopedUrl = `${base}${rootPath}/query-index.json`;
  try {
    const probe = await fetch(scopedUrl, { method: 'HEAD' });
    if (probe.ok) {
      const items = await ffetch(scopedUrl).filter((p) => p.path !== rootPath).all();
      return items.map((p) => ({
        path: p.path,
        title: p.navTitle || p.title || '',
        description: p.description || '',
        image: p.image || '',
        category: p.category || '',
        lastModified: p.lastModified || 0,
        listOrder: p.listOrder ? parseInt(p.listOrder, 10) : null,
      }));
    }
  } catch (e) {
    // scoped index unavailable — fall through to full index
  }

  // Fallback: full language index filtered by path prefix
  const langIndexUrl = `${base}/${langCode}/query-index.json`;
  try {
    const items = await ffetch(langIndexUrl)
      .filter((p) => p.path && p.path.startsWith(`${rootPath}/`))
      .all();
    return items.map((p) => ({
      path: p.path,
      title: p.navTitle || p.title || '',
      description: p.description || '',
      image: p.image || '',
      category: p.category || '',
      lastModified: p.lastModified || 0,
      listOrder: p.listOrder ? parseInt(p.listOrder, 10) : null,
    }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('List block: failed to fetch query index', e);
    return [];
  }
}

/**
 * Sorts pages by the configured mode.
 * - alphabetical:  ascending by title
 * - lastModified:  descending by lastModified timestamp (newest first)
 * - listOrder:     numeric listOrder ascending, then alphabetical for pages with no value
 * @param {Array} pages
 * @param {string} sortBy
 * @returns {Array}
 */
function sortPages(pages, sortBy) {
  const sorted = [...pages];
  if (sortBy === 'lastModified') {
    sorted.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
  } else if (sortBy === 'listOrder') {
    sorted.sort((a, b) => {
      const oa = a.listOrder !== null ? a.listOrder : 9999;
      const ob = b.listOrder !== null ? b.listOrder : 9999;
      if (oa !== ob) return oa - ob;
      return (a.title || '').localeCompare(b.title || '');
    });
  } else {
    // alphabetical (default)
    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
  return sorted;
}

/**
 * Formats a Unix timestamp (seconds) as a localised date string.
 * @param {number} ts
 * @returns {string}
 */
function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(document.documentElement.lang || 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Returns a gray placeholder div for the image slot.
 * Used when showImage is true but no image URL is available,
 * or as an onerror fallback when the image fails to load.
 * @returns {Element}
 */
function createImagePlaceholder() {
  const ph = document.createElement('div');
  ph.className = 'list-item-image list-item-image-placeholder';
  return ph;
}

/**
 * Builds and returns the <ul> list element from the page array.
 * @param {Array} pages
 * @param {{ showDescription: boolean, showImage: boolean, showDate: boolean }} config
 * @returns {Element}
 */
function renderList(pages, config) {
  const { showDescription, showImage, showDate } = config;
  const ul = document.createElement('ul');
  ul.className = 'list-items';

  pages.forEach((page) => {
    const li = document.createElement('li');
    li.className = 'list-item';

    const a = document.createElement('a');
    a.href = page.path;

    if (showImage) {
      if (page.image) {
        const pic = createOptimizedPicture(page.image, page.title, false, [{ width: '400' }]);
        pic.classList.add('list-item-image');
        // If the image URL is broken or fails to load, fall back to the gray placeholder
        const img = pic.querySelector('img');
        if (img) {
          img.addEventListener('error', () => { pic.replaceWith(createImagePlaceholder()); }, { once: true });
        }
        a.append(pic);
      } else {
        a.append(createImagePlaceholder());
      }
    }

    const body = document.createElement('div');
    body.className = 'list-item-body';

    const heading = document.createElement('h3');
    heading.textContent = page.title;
    body.append(heading);

    if (showDescription && page.description) {
      const desc = document.createElement('p');
      desc.className = 'list-item-description';
      desc.textContent = page.description;
      body.append(desc);
    }

    if (showDate && page.lastModified) {
      const dateEl = document.createElement('p');
      dateEl.className = 'list-item-date';
      const time = document.createElement('time');
      [time.dateTime] = new Date(page.lastModified * 1000).toISOString().split('T');
      time.textContent = formatDate(page.lastModified);
      dateEl.append(time);
      body.append(dateEl);
    }

    a.append(body);
    li.append(a);
    ul.append(li);
  });

  return ul;
}

/**
 * Renders the "news-featured" layout: first card is featured (larger),
 * the rest are secondary. Always shows image, category badge, date, title,
 * description, and an optional read-more link. Mobile: secondary cards go horizontal.
 * @param {Array} pages
 * @param {string} readMoreText  Label for the read-more link; empty string hides the link.
 * @returns {Element}
 */
function renderNewsFeatured(pages, readMoreText) {
  const ul = document.createElement('ul');
  ul.className = 'list-news-grid';

  pages.forEach((page, idx) => {
    const li = document.createElement('li');
    li.className = idx === 0 ? 'list-news-item list-news-featured' : 'list-news-item';

    const a = document.createElement('a');
    a.href = page.path;

    // Image area
    const imgDiv = document.createElement('div');
    imgDiv.className = 'list-news-image';

    if (page.image) {
      const widths = idx === 0
        ? [{ media: '(min-width: 900px)', width: '700' }, { width: '500' }]
        : [{ media: '(min-width: 900px)', width: '450' }, { width: '360' }];
      const pic = createOptimizedPicture(page.image, page.title || '', false, widths);
      const img = pic.querySelector('img');
      if (img) {
        img.addEventListener('error', () => { pic.replaceWith(createImagePlaceholder()); }, { once: true });
      }
      imgDiv.append(pic);
    } else {
      imgDiv.append(createImagePlaceholder());
    }

    // Category badge — inside image area (top-left)
    if (page.category) {
      const badge = document.createElement('span');
      badge.className = 'list-news-badge';
      badge.dataset.category = page.category.toLowerCase().replace(/[\s/]+/g, '-');
      badge.textContent = page.category.toUpperCase();
      imgDiv.append(badge);
    }

    a.append(imgDiv);

    // Text body
    const body = document.createElement('div');
    body.className = 'list-news-body';

    if (page.lastModified) {
      const dateEl = document.createElement('p');
      dateEl.className = 'list-news-date';
      const time = document.createElement('time');
      [time.dateTime] = new Date(page.lastModified * 1000).toISOString().split('T');
      time.textContent = formatDate(page.lastModified);
      dateEl.append(time);
      body.append(dateEl);
    }

    const heading = document.createElement('h3');
    heading.className = 'list-news-title';
    heading.textContent = page.title || '';
    body.append(heading);

    if (page.description) {
      const desc = document.createElement('p');
      desc.className = 'list-news-description';
      desc.textContent = page.description;
      body.append(desc);
    }

    if (readMoreText) {
      const readMore = document.createElement('p');
      readMore.className = 'list-news-readmore';
      readMore.textContent = readMoreText;
      body.append(readMore);
    }

    a.append(body);
    li.append(a);
    ul.append(li);
  });

  return ul;
}

/**
 * Builds the pagination nav (Prev / Page N of M / Next).
 * @param {number} currentPage  0-based current page index
 * @param {number} totalPages
 * @param {function} onChange  called with the new 0-based page index
 * @returns {Element}
 */
function buildPaginationControls(currentPage, totalPages, onChange) {
  const nav = document.createElement('nav');
  nav.className = 'list-pagination';
  nav.setAttribute('aria-label', 'List pagination');

  const prev = document.createElement('button');
  prev.className = 'list-pagination-btn list-pagination-prev';
  prev.textContent = '← Previous';
  prev.disabled = currentPage === 0;
  prev.addEventListener('click', () => onChange(currentPage - 1));

  const info = document.createElement('span');
  info.className = 'list-pagination-info';
  info.textContent = `Page ${currentPage + 1} of ${totalPages}`;

  const next = document.createElement('button');
  next.className = 'list-pagination-btn list-pagination-next';
  next.textContent = 'Next →';
  next.disabled = currentPage === totalPages - 1;
  next.addEventListener('click', () => onChange(currentPage + 1));

  nav.append(prev, info, next);
  return nav;
}

/**
 * Renders the list with pagination controls, managing page state either via
 * a URL query param (?page=N) or an in-memory variable depending on urlState.
 * @param {Array} pages
 * @param {{ pageSize: number, urlState: boolean }} config
 * @param {Element} block
 */
function renderPaginatedList(pages, config, block) {
  const { pageSize, urlState } = config;
  const totalPages = Math.ceil(pages.length / pageSize);

  function getPageFromUrl() {
    const p = parseInt(new URLSearchParams(window.location.search).get('page'), 10) || 1;
    return Math.max(1, Math.min(p, totalPages)) - 1; // clamp, convert to 0-based
  }

  let currentPage = 0;

  function onPageChange(newPage) {
    if (urlState) {
      const params = new URLSearchParams(window.location.search);
      if (newPage === 0) {
        params.delete('page');
      } else {
        params.set('page', newPage + 1); // URL is 1-based
      }
      const query = params.toString();
      window.history.pushState(null, '', query ? `?${query}` : window.location.pathname);
    } else {
      currentPage = newPage;
    }
    // eslint-disable-next-line no-use-before-define
    render(newPage);
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function render(page) {
    // Remove previous list and controls, leave other block children intact
    block.querySelectorAll('.list-items, .list-news-grid, .list-pagination').forEach((el) => el.remove());

    const slice = pages.slice(page * pageSize, (page + 1) * pageSize);
    if (config.listStyle === 'news-featured') {
      block.append(renderNewsFeatured(slice, config.readMoreText));
    } else {
      block.append(renderList(slice, config));
    }

    if (totalPages > 1) {
      block.append(buildPaginationControls(page, totalPages, onPageChange));
    }
  }

  if (urlState) {
    window.addEventListener('popstate', () => render(getPageFromUrl()));
    render(getPageFromUrl());
  } else {
    render(currentPage);
  }
}

/**
 * Renders the "related" layout: compact text-only rows used for related articles.
 * Each row shows category tag, title, and date. Excludes the current page.
 * @param {Array} pages
 * @returns {Element}
 */
function renderRelated(pages) {
  const currentPath = window.location.pathname
    .replace(/\.html$/, '')
    .replace(/\/content\/[^/]+\/(?:[^/]+\/)?/, '/'); // normalise author path to EDS path

  const ul = document.createElement('ul');
  ul.className = 'list-related-items';

  pages
    .filter((p) => !currentPath.endsWith(p.path) && !p.path.endsWith(currentPath))
    .forEach((page) => {
      const li = document.createElement('li');
      li.className = 'list-related-item';

      const a = document.createElement('a');
      a.href = page.path;

      if (page.category) {
        const tag = document.createElement('span');
        tag.className = 'list-related-category';
        tag.textContent = page.category.toUpperCase();
        a.append(tag);
      }

      const title = document.createElement('h3');
      title.className = 'list-related-title';
      title.textContent = page.title;
      a.append(title);

      if (page.lastModified) {
        const dateEl = document.createElement('span');
        dateEl.className = 'list-related-date';
        const time = document.createElement('time');
        [time.dateTime] = new Date(page.lastModified * 1000).toISOString().split('T');
        time.textContent = formatDate(page.lastModified);
        dateEl.append(time);
        a.append(dateEl);
      }

      li.append(a);
      ul.append(li);
    });

  return ul;
}

/**
 * Renders a footer navigation column with a gold heading and plain links.
 * @param {string} headingText  Column heading (uppercased); falls back to rootPath last segment.
 * @param {string} rootPath     EDS root path, used as fallback heading source.
 * @param {Array}  pages        Array of page objects with path and title.
 * @returns {Element}
 */
function renderFooterNav(headingText, rootPath, pages) {
  const col = document.createElement('div');
  col.className = 'footer-nav-col';

  const label = headingText
    ? headingText.toUpperCase()
    : (rootPath.split('/').filter(Boolean).pop() || '').toUpperCase();

  const heading = document.createElement('p');
  heading.className = 'footer-nav-heading';
  heading.textContent = label;
  col.append(heading);

  const ul = document.createElement('ul');
  ul.className = 'footer-nav-links';

  pages.forEach((page) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = page.path;
    a.textContent = page.title;
    li.append(a);
    ul.append(li);
  });

  col.append(ul);
  return col;
}

/**
 * List block decorator.
 * Reads config from the block's authored rows, fetches child pages from the appropriate
 * data source (JCR on author, query index on EDS), sorts them, and renders the list.
 * @param {Element} block
 */
export default async function decorate(block) {
  const config = readConfig(block);
  const {
    heading, rootPath, sortBy, limit, paginate, pageSize, listStyle,
  } = config;
  const langCode = getLangFromPath(rootPath);

  // Add style and sort-mode classes for CSS targeting
  block.classList.add(`list-style-${listStyle}`);
  block.classList.add(`list-sortby-${sortBy}`);

  // Clear the raw config rows before rendering
  block.textContent = '';

  let pages;
  if (isAuthorEnvironment()) {
    pages = await fetchAuthorListPages(rootPath, langCode);
  } else {
    pages = await fetchPublishedListPages(rootPath, langCode);
  }

  if (!pages || !pages.length) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = 'No pages found.';
    block.append(empty);
    return;
  }

  const sorted = sortPages(pages, sortBy);
  const limited = limit > 0 ? sorted.slice(0, limit) : sorted;

  if (listStyle === 'footer-nav') {
    block.append(renderFooterNav(heading, rootPath, limited));
  } else if (listStyle === 'related') {
    block.append(renderRelated(limited));
  } else if (paginate && limited.length > pageSize) {
    renderPaginatedList(limited, config, block);
  } else if (listStyle === 'news-featured') {
    block.append(renderNewsFeatured(limited, config.readMoreText));
  } else {
    block.append(renderList(limited, config));
  }
}
