import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Annotate a DOM element as a UE-editable text property.
 * AEM does not inject data-aue-prop on text/select/boolean/number property
 * cells — those are JCR properties on the block node, not child nodes.
 * For inline canvas editing the decorator must set these attributes explicitly.
 */
function ueText(el, prop, label) {
  el.dataset.aueProp = prop;
  el.dataset.aueType = 'text';
  el.dataset.aueLabel = label;
  return el;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const getCell = (i) => rows[i]?.querySelector(':scope > div:last-child');

  // Read variant (field 14) — apply as CSS class so CSS can target it.
  // 'cta' variant: no background image, two-column layout, stats card on right.
  const variant = getCell(14)?.textContent?.trim() || '';
  if (variant) block.classList.add(variant);
  const isCta = variant === 'cta';
  // centered variant: pure CSS gradient background, no photo, all text centred, no stats.
  const isCentered = variant === 'centered';

  // ── Background image ──────────────────────────────────────────────────────
  const bgDiv = document.createElement('div');
  bgDiv.className = 'hero-b2b-bg';
  const bgImg = getCell(0)?.querySelector('img');
  if (bgImg) {
    const optimized = createOptimizedPicture(bgImg.src, bgImg.alt || '', false, [
      { media: '(min-width: 900px)', width: '1440' },
      { width: '800' },
    ]);
    // reference field → child JCR node → carries data-aue-resource; must transfer it
    moveInstrumentation(bgImg, optimized.querySelector('img'));
    bgDiv.append(optimized);
  }

  // ── Content ───────────────────────────────────────────────────────────────
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-b2b-content';

  const preheaderText = getCell(1)?.textContent?.trim();
  if (preheaderText) {
    const p = ueText(document.createElement('p'), 'preheader', 'Preheader');
    p.className = 'hero-b2b-preheader';
    p.textContent = preheaderText;
    contentDiv.append(p);
  }

  const h1 = ueText(document.createElement('h1'), 'header', 'Headline');
  h1.className = 'hero-b2b-headline';
  h1.textContent = getCell(2)?.textContent?.trim() || '';
  contentDiv.append(h1);

  const descCell = getCell(3);
  const descDiv = document.createElement('div');
  descDiv.className = 'hero-b2b-description';
  // richtext field → child JCR node → carries data-aue-resource; must transfer it
  moveInstrumentation(descCell, descDiv);
  descDiv.innerHTML = descCell?.innerHTML || '';
  contentDiv.append(descDiv);

  // ── CTAs ──────────────────────────────────────────────────────────────────
  const ctasDiv = document.createElement('div');
  ctasDiv.className = 'hero-b2b-ctas';

  const cta1Text = getCell(4)?.textContent?.trim();
  if (cta1Text) {
    const a = ueText(document.createElement('a'), 'cta1Text', 'CTA 1 Text');
    a.className = 'hero-b2b-cta-primary';
    a.href = getCell(5)?.textContent?.trim() || '#';
    a.textContent = cta1Text;
    ctasDiv.append(a);
  }

  const cta2Text = getCell(6)?.textContent?.trim();
  if (cta2Text) {
    const a = ueText(document.createElement('a'), 'cta2Text', 'CTA 2 Text');
    a.className = 'hero-b2b-cta-secondary';
    a.href = getCell(7)?.textContent?.trim() || '#';
    // cta variant: no arrow decoration; default hero: append arrow
    a.textContent = isCta ? cta2Text : `${cta2Text} →`;
    ctasDiv.append(a);
  }
  contentDiv.append(ctasDiv);

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Default: horizontal bar below CTAs inside content.
  // CTA variant: vertical card to the right of content.
  const statsContainer = document.createElement('div');
  statsContainer.className = isCta ? 'hero-b2b-stats-card' : 'hero-b2b-stats';

  [
    [8, 'stat1Value', 'Stat 1 Value', 9, 'stat1Label', 'Stat 1 Label'],
    [10, 'stat2Value', 'Stat 2 Value', 11, 'stat2Label', 'Stat 2 Label'],
    [12, 'stat3Value', 'Stat 3 Value', 13, 'stat3Label', 'Stat 3 Label'],
  ].forEach(([vi, vProp, vLabel, li, lProp, lLabel]) => {
    const val = getCell(vi)?.textContent?.trim();
    if (!val) return;
    const statDiv = document.createElement('div');
    statDiv.className = 'hero-b2b-stat';

    const valSpan = ueText(document.createElement('span'), vProp, vLabel);
    valSpan.className = 'hero-b2b-stat-value';
    valSpan.textContent = val;

    const lblSpan = ueText(document.createElement('span'), lProp, lLabel);
    lblSpan.className = 'hero-b2b-stat-label';
    lblSpan.textContent = getCell(li)?.textContent?.trim() || '';

    statDiv.append(valSpan, lblSpan);
    statsContainer.append(statDiv);
  });

  // Default: stats sit inside content column.
  // CTA variant: stats card is a sibling of content, rendered on the right.
  // Centered variant: no stats at all.
  if (!isCta && !isCentered) contentDiv.append(statsContainer);

  // ── Assemble ──────────────────────────────────────────────────────────────
  block.textContent = '';
  if (isCta) {
    block.append(contentDiv, statsContainer);
  } else if (isCentered) {
    // bgDiv included so an authored image can show through the CSS gradient overlay
    block.append(bgDiv, contentDiv);
  } else {
    block.append(bgDiv, contentDiv);
  }
}
