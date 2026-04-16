import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import ffetch from '../../scripts/ffetch.js';

import {
  getLanguage,
  getSiteName,
  PATH_PREFIX,
  computeLocalizedUrl,
} from '../../scripts/utils.js';

import { isAuthorEnvironment } from '../../scripts/scripts.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');
const siteName = await getSiteName();

const LANGS = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ja', label: 'JA', name: '日本語' },
  { code: 'zh', label: 'ZH', name: '中文（简体）' },
  { code: 'ko', label: 'KO', name: '한국어' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'ar', label: 'AR', name: 'العربية' },
];

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  const navSections = sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li');
  if (navSections && navSections.length > 0) {
    navSections.forEach((section) => {
      section.setAttribute('aria-expanded', expanded);
    });
  }
}

/**
 * Builds the logo element: anchor with logo image and optional brand name text.
 * @param {string} langCode
 * @param {string} logoUrl - URL to the logo image (can be a combined icon+text image)
 * @param {string} logoAlt - Alt text for the logo image
 * @param {string} brandName - Optional brand name text to display next to logo
 * @returns {HTMLAnchorElement}
 */
function makeLogoEl(langCode, logoUrl = '/icons/logo.svg', logoAlt = '', brandName = 'LUMINA NOVENTIS') {
  const a = document.createElement('a');
  a.className = 'nav-logo-link';
  a.href = `/${langCode}`;

  const logoImg = document.createElement('img');
  logoImg.src = logoUrl;
  logoImg.alt = logoAlt;
  logoImg.className = 'nav-logo-mark';
  if (!logoAlt) logoImg.setAttribute('aria-hidden', 'true');

  a.append(logoImg);

  // Only add brand name span if provided and not empty
  if (brandName) {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'nav-logo-name';
    nameSpan.textContent = brandName;
    a.append(nameSpan);
  }

  return a;
}

/**
 * Builds the mobile drawer and appends it to nav.
 * @param {Element} nav
 * @param {Element} navSections
 * @param {string} langCode
 * @param {string} logoUrl - Logo image URL
 * @param {string} logoAlt - Logo alt text
 * @param {string} brandName - Brand name text
 */
function buildMobileDrawer(nav, navSections, langCode, logoUrl, logoAlt, brandName) {
  const currentLang = getLanguage();
  const currentLangDef = LANGS.find((l) => l.code === currentLang) || { label: currentLang.toUpperCase(), name: currentLang };

  const drawer = document.createElement('div');
  drawer.className = 'nav-mobile-drawer';
  drawer.setAttribute('aria-hidden', 'true');

  // --- Header ---
  const drawerHeader = document.createElement('div');
  drawerHeader.className = 'nav-mobile-drawer-header';

  const drawerLogo = makeLogoEl(langCode, logoUrl, logoAlt, brandName);
  drawerLogo.className = 'nav-mobile-drawer-logo';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'nav-mobile-drawer-close';
  closeBtn.setAttribute('aria-label', 'Close navigation');

  // X icon SVG
  const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  closeSvg.setAttribute('viewBox', '0 0 14 14');
  closeSvg.setAttribute('width', '14');
  closeSvg.setAttribute('height', '14');
  closeSvg.setAttribute('fill', 'none');
  closeSvg.setAttribute('aria-hidden', 'true');
  const closeLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  closeLine1.setAttribute('x1', '1'); closeLine1.setAttribute('y1', '1');
  closeLine1.setAttribute('x2', '13'); closeLine1.setAttribute('y2', '13');
  closeLine1.setAttribute('stroke', 'white'); closeLine1.setAttribute('stroke-width', '1.5');
  closeLine1.setAttribute('stroke-linecap', 'round');
  const closeLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  closeLine2.setAttribute('x1', '13'); closeLine2.setAttribute('y1', '1');
  closeLine2.setAttribute('x2', '1'); closeLine2.setAttribute('y2', '13');
  closeLine2.setAttribute('stroke', 'white'); closeLine2.setAttribute('stroke-width', '1.5');
  closeLine2.setAttribute('stroke-linecap', 'round');
  closeSvg.append(closeLine1, closeLine2);
  closeBtn.append(closeSvg);

  closeBtn.addEventListener('click', () => toggleMenu(nav, navSections));

  drawerHeader.append(drawerLogo, closeBtn);
  drawer.append(drawerHeader);

  // --- Nav links ---
  const mobileLinks = document.createElement('ul');
  mobileLinks.className = 'nav-mobile-links';

  const sourceList = navSections.querySelectorAll('.default-content-wrapper > ul > li');
  sourceList.forEach((li) => {
    const sourceAnchor = li.querySelector('a');
    if (!sourceAnchor) return;

    const item = document.createElement('li');
    item.className = 'nav-mobile-link-item';

    const link = document.createElement('a');
    link.className = 'nav-mobile-link';
    link.href = sourceAnchor.href;
    link.textContent = sourceAnchor.textContent;

    // Right chevron SVG
    const chevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevronSvg.setAttribute('viewBox', '0 0 8 12');
    chevronSvg.setAttribute('width', '8');
    chevronSvg.setAttribute('height', '12');
    chevronSvg.setAttribute('fill', 'none');
    chevronSvg.setAttribute('aria-hidden', 'true');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'M1 1L7 6L1 11');
    chevronPath.setAttribute('stroke', 'rgba(255,255,255,0.3)');
    chevronPath.setAttribute('stroke-width', '1.5');
    chevronPath.setAttribute('stroke-linecap', 'round');
    chevronPath.setAttribute('stroke-linejoin', 'round');
    chevronSvg.append(chevronPath);
    link.append(chevronSvg);

    item.append(link);
    mobileLinks.append(item);
  });
  drawer.append(mobileLinks);

  // --- Language accordion ---
  const langAccordion = document.createElement('div');
  langAccordion.className = 'nav-mobile-lang-accordion';

  const langTrigger = document.createElement('button');
  langTrigger.type = 'button';
  langTrigger.className = 'nav-mobile-lang-trigger';

  const triggerLeft = document.createElement('div');
  triggerLeft.className = 'nav-mobile-lang-trigger-left';

  // Globe SVG
  const globeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  globeSvg.setAttribute('viewBox', '0 0 16 16');
  globeSvg.setAttribute('width', '16');
  globeSvg.setAttribute('height', '16');
  globeSvg.setAttribute('fill', 'none');
  globeSvg.setAttribute('aria-hidden', 'true');
  const globeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  globeCircle.setAttribute('cx', '8'); globeCircle.setAttribute('cy', '8');
  globeCircle.setAttribute('r', '6.5'); globeCircle.setAttribute('stroke', 'rgba(255,255,255,0.4)');
  globeCircle.setAttribute('stroke-width', '1.2');
  const globeEllipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  globeEllipse.setAttribute('cx', '8'); globeEllipse.setAttribute('cy', '8');
  globeEllipse.setAttribute('rx', '2.5'); globeEllipse.setAttribute('ry', '6.5');
  globeEllipse.setAttribute('stroke', 'rgba(255,255,255,0.4)'); globeEllipse.setAttribute('stroke-width', '1.2');
  const globeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  globeLine.setAttribute('x1', '1.5'); globeLine.setAttribute('y1', '8');
  globeLine.setAttribute('x2', '14.5'); globeLine.setAttribute('y2', '8');
  globeLine.setAttribute('stroke', 'rgba(255,255,255,0.4)'); globeLine.setAttribute('stroke-width', '1.2');
  globeSvg.append(globeCircle, globeEllipse, globeLine);

  const langLabel = document.createElement('span');
  langLabel.className = 'nav-mobile-lang-label';
  langLabel.textContent = 'LANGUAGE';

  triggerLeft.append(globeSvg, langLabel);

  const triggerRight = document.createElement('div');
  triggerRight.className = 'nav-mobile-lang-trigger-right';

  const currentCodeSpan = document.createElement('span');
  currentCodeSpan.className = 'nav-mobile-lang-current';
  currentCodeSpan.textContent = currentLangDef.label;

  // Chevron SVG
  const langChevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  langChevronSvg.setAttribute('viewBox', '0 0 10 6');
  langChevronSvg.setAttribute('width', '10');
  langChevronSvg.setAttribute('height', '6');
  langChevronSvg.setAttribute('fill', 'none');
  langChevronSvg.setAttribute('aria-hidden', 'true');
  langChevronSvg.classList.add('nav-mobile-lang-chevron');
  const langChevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  langChevronPath.setAttribute('d', 'M1 1L5 5L9 1');
  langChevronPath.setAttribute('stroke', 'rgba(255,255,255,0.4)');
  langChevronPath.setAttribute('stroke-width', '1.5');
  langChevronPath.setAttribute('stroke-linecap', 'round');
  langChevronSvg.append(langChevronPath);

  triggerRight.append(currentCodeSpan, langChevronSvg);
  langTrigger.append(triggerLeft, triggerRight);

  // Lang list
  const langList = document.createElement('div');
  langList.className = 'nav-mobile-lang-list';

  LANGS.forEach(({ code, label, name }) => {
    const isSelected = code === currentLang;
    const item = document.createElement('a');
    item.className = `nav-mobile-lang-item${isSelected ? ' is-selected' : ''}`;
    item.href = computeLocalizedUrl(code);

    const itemCode = document.createElement('span');
    itemCode.className = 'nav-mobile-lang-item-code';
    itemCode.textContent = label;

    const itemName = document.createElement('span');
    itemName.className = 'nav-mobile-lang-item-name';
    itemName.textContent = name;

    item.append(itemCode, itemName);

    if (isSelected) {
      const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkSvg.setAttribute('viewBox', '0 0 14 14');
      checkSvg.setAttribute('width', '12');
      checkSvg.setAttribute('height', '12');
      checkSvg.setAttribute('fill', 'none');
      checkSvg.setAttribute('aria-hidden', 'true');
      checkSvg.classList.add('nav-mobile-lang-item-check');
      const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      checkPath.setAttribute('d', 'M2 7L6 11L12 3');
      checkPath.setAttribute('stroke', '#e8b400');
      checkPath.setAttribute('stroke-width', '1.5');
      checkPath.setAttribute('stroke-linecap', 'round');
      checkPath.setAttribute('stroke-linejoin', 'round');
      checkSvg.append(checkPath);
      item.append(checkSvg);
    }

    langList.append(item);
  });

  langTrigger.addEventListener('click', () => {
    langAccordion.classList.toggle('is-open');
  });

  langAccordion.append(langTrigger, langList);
  drawer.append(langAccordion);

  // --- Contact CTA ---
  const ctaSection = document.createElement('div');
  ctaSection.className = 'nav-mobile-cta';

  // Try to get the contact href from nav-tools
  const navTools = nav.querySelector('.nav-tools');
  let contactHref = `/${langCode}/contact`;
  if (navTools) {
    const contactAnchor = navTools.querySelector('.cta-link.contact a');
    if (contactAnchor && contactAnchor.href) {
      contactHref = contactAnchor.getAttribute('href') || contactHref;
    }
  }

  const ctaBtn = document.createElement('a');
  ctaBtn.className = 'nav-mobile-cta-btn';
  ctaBtn.href = contactHref;
  ctaBtn.textContent = 'Contact Us';
  ctaSection.append(ctaBtn);

  drawer.append(ctaSection);
  nav.append(drawer);
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
async function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null
    ? !forceExpanded
    : nav.getAttribute('aria-expanded') === 'true';
  const hamburgerBtn = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = expanded || isDesktop.matches ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  if (hamburgerBtn) {
    hamburgerBtn.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  }

  // Toggle mobile drawer
  const drawer = nav.querySelector('.nav-mobile-drawer');
  if (drawer) {
    if (expanded || isDesktop.matches) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
    } else {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
    }
  }

  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    window.addEventListener('keydown', closeOnEscape);
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * Fetches nav pages from the AEM JCR when running in the author environment.
 * @param {string} langCode
 * @returns {Promise<Array>}
 */
async function fetchAuthorNavPages(langCode) {
  const pathname = window.location.pathname.replace(/\.html$/, '');
  const parts = pathname.split('/');
  const langIdx = parts.indexOf(langCode);
  if (langIdx === -1) return [];
  const contentRoot = parts.slice(0, langIdx + 1).join('/');

  try {
    const resp = await fetch(`${contentRoot}.2.json`);
    if (!resp.ok) return [];
    const json = await resp.json();

    const pages = [];
    Object.entries(json).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      if (value['jcr:primaryType'] !== 'cq:Page') return;
      const content = value['jcr:content'] || {};
      if (content.hideInNav === true || content.hideInNav === 'true') return;
      const title = content['jcr:title'] || key;
      pages.push({
        path: `/${langCode}/${key}`,
        title,
        navTitle: title,
        navOrder: parseInt(content.navOrder, 10) || 9999,
      });
    });

    return pages;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Dynamic nav: failed to fetch author page list', e);
    return [];
  }
}

/**
 * Populates the nav sections list dynamically.
 * @param {Element} navSections
 * @param {string} langCode
 */
async function populateDynamicNav(navSections, langCode) {
  const langRoot = `/${langCode}/`;
  let items;

  if (isAuthorEnvironment()) {
    items = await fetchAuthorNavPages(langCode);
  } else {
    const base = (window.hlx && window.hlx.codeBasePath) || '';
    const queryIndexUrl = `${base}${langRoot}query-index.json`;
    try {
      items = await ffetch(queryIndexUrl)
        .filter((page) => {
          if (page.hideInNav === 'true') return false;
          const relative = page.path.startsWith(langRoot)
            ? page.path.slice(langRoot.length)
            : null;
          return relative && !relative.includes('/') && relative.length > 0;
        })
        .all();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Dynamic nav: failed to fetch query index', e);
      return;
    }
  }

  if (!items || !items.length) return;

  items.sort((a, b) => {
    const oa = parseInt(a.navOrder, 10) || 9999;
    const ob = parseInt(b.navOrder, 10) || 9999;
    if (oa !== ob) return oa - ob;
    return (a.navTitle || a.title || '').localeCompare(b.navTitle || b.title || '');
  });

  const ul = document.createElement('ul');
  items.forEach(({ path, navTitle, title }) => {
    const li = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = path;
    anchor.textContent = navTitle || title;
    li.append(anchor);
    ul.append(li);
  });

  let wrapper = navSections.querySelector('.default-content-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'default-content-wrapper';
    navSections.append(wrapper);
  }
  const existingList = wrapper.querySelector('ul');
  if (existingList) existingList.replaceWith(ul);
  else wrapper.append(ul);
}

/**
 * Extracts logo configuration from the loaded nav fragment's first image
 * @param {Element} fragment The nav fragment element
 * @returns {Object} { logoUrl, logoAlt, brandName }
 */
function extractLogoFromFragment(fragment) {
  const firstImage = fragment.querySelector('img');

  if (firstImage) {
    return {
      logoUrl: firstImage.src,
      logoAlt: firstImage.alt || '',
      brandName: '',
    };
  }

  // No image found in fragment
  return {
    logoUrl: '',
    logoAlt: '',
    brandName: '',
  };
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const langCode = getLanguage();

  const isAuthor = isAuthorEnvironment();
  let navPath = `/${langCode}/nav`;

  if (isAuthor) {
    navPath = navMeta
      ? new URL(navMeta, window.location).pathname
      : `/content/${siteName}${PATH_PREFIX}/${langCode}/nav`;
  }

  // Load fragment first
  const fragment = await loadFragment(navPath);

  // Extract logo configuration from the loaded fragment's first image
  const { logoUrl, logoAlt, brandName } = extractLogoFromFragment(fragment);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment && fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  // Replace nav-brand content with logo element
  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    navBrand.replaceChildren(makeLogoEl(langCode, logoUrl, logoAlt, brandName));
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    // Dynamic nav: populate from query index when nav list is empty
    const existingNavList = navSections.querySelector('.default-content-wrapper > ul');
    if (!existingNavList || existingNavList.children.length === 0) {
      await populateDynamicNav(navSections, langCode);
    }

    navSections
      .querySelectorAll(':scope .default-content-wrapper > ul > li')
      .forEach((navSection) => {
        if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
        navSection.addEventListener('click', () => {
          if (isDesktop.matches) {
            const expanded = navSection.getAttribute('aria-expanded') === 'true';
            toggleAllNavSections(navSections);
            navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          }
        });
      });
  }

  // Build mobile drawer (after nav sections are populated)
  buildMobileDrawer(nav, navSections || document.createElement('div'), langCode, logoUrl, logoAlt, brandName);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  const hamburgerBtn = document.createElement('button');
  hamburgerBtn.type = 'button';
  hamburgerBtn.setAttribute('aria-controls', 'nav');
  hamburgerBtn.setAttribute('aria-label', 'Open navigation');
  const hamburgerIcon = document.createElement('span');
  hamburgerIcon.className = 'nav-hamburger-icon';
  hamburgerBtn.append(hamburgerIcon);
  hamburger.append(hamburgerBtn);
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.append(hamburger);

  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  function handleScroll() {
    if (window.scrollY > 0) {
      navWrapper.classList.add('scrolled');
    } else {
      navWrapper.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll);
  handleScroll();
}
