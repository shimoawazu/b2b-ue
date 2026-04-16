import { moveInstrumentation } from '../../scripts/scripts.js';

function ueText(el, prop, label) {
  el.dataset.aueProp = prop;
  el.dataset.aueType = 'text';
  el.dataset.aueLabel = label;
  return el;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const getCell = (i) => rows[i]?.querySelector(':scope > div:last-child');

  // Field order: eyebrow(0), heading(1), subtitle(2), ctaText(3), ctaLink(4), style(5)
  const style = getCell(5)?.textContent?.trim() || '';
  if (style) block.classList.add(style);

  const inner = document.createElement('div');
  inner.className = 'section-header-inner';

  // Eyebrow — decorative lines only for default (centered) style
  const eyebrowText = getCell(0)?.textContent?.trim();
  if (eyebrowText) {
    const p = ueText(document.createElement('p'), 'eyebrow', 'Eyebrow');
    p.className = 'section-header-eyebrow';
    if (!style) {
      // default: symmetric gold lines on both sides
      const lineL = document.createElement('span');
      lineL.className = 'section-header-line';
      const lineR = document.createElement('span');
      lineR.className = 'section-header-line';
      p.append(lineL, eyebrowText, lineR);
    } else {
      // named variants: plain text — CSS handles any decoration
      p.textContent = eyebrowText;
    }
    inner.append(p);
  }

  // Heading
  const h2 = ueText(document.createElement('h2'), 'heading', 'Heading');
  h2.className = 'section-header-heading';
  h2.textContent = getCell(1)?.textContent?.trim() || '';
  inner.append(h2);

  // Subtitle — richtext, child JCR node, use moveInstrumentation
  const subtitleCell = getCell(2);
  if (subtitleCell?.innerHTML?.trim()) {
    const div = document.createElement('div');
    div.className = 'section-header-subtitle';
    moveInstrumentation(subtitleCell, div);
    div.innerHTML = subtitleCell.innerHTML;
    inner.append(div);
  }

  // CTA link (optional, primarily for dark-left variant)
  const ctaText = getCell(3)?.textContent?.trim();
  if (ctaText) {
    const a = ueText(document.createElement('a'), 'ctaText', 'CTA Text');
    a.className = 'section-header-cta';
    a.href = getCell(4)?.textContent?.trim() || '#';
    a.textContent = `${ctaText} →`;
    inner.append(a);
  }

  block.textContent = '';
  block.append(inner);
}
