import { getLanguage, computeLocalizedUrl } from '../../scripts/utils.js';

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

export default function decorate(block) {
  const currentLang = getLanguage();
  const current = LANGS.find((l) => l.code === currentLang) || { label: currentLang.toUpperCase(), name: currentLang };

  // Trigger button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lang-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'listbox');

  const codeSpan = document.createElement('span');
  codeSpan.className = 'lang-btn-code';
  codeSpan.textContent = current.label;

  // Chevron SVG (DOM API)
  const chevronSvg = makeSvg('0 0 10 6', 10, 6, 'lang-btn-chevron');
  const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevronPath.setAttribute('d', 'M1 1L5 5L9 1');
  chevronPath.setAttribute('stroke', 'currentColor');
  chevronPath.setAttribute('stroke-width', '1.5');
  chevronPath.setAttribute('stroke-linecap', 'round');
  chevronSvg.append(chevronPath);
  btn.append(codeSpan, chevronSvg);

  // Dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'lang-dropdown';
  dropdown.setAttribute('role', 'listbox');

  const hdr = document.createElement('div');
  hdr.className = 'lang-dropdown-header';
  hdr.textContent = 'Select Language';
  dropdown.append(hdr);

  LANGS.forEach(({ code, label, name }) => {
    const isSelected = code === currentLang;
    const item = document.createElement('a');
    item.className = `lang-item${isSelected ? ' is-selected' : ''}`;
    item.href = computeLocalizedUrl(code);
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(isSelected));

    const itemCode = document.createElement('span');
    itemCode.className = 'lang-item-code';
    itemCode.textContent = label;

    const itemName = document.createElement('span');
    itemName.className = 'lang-item-name';
    itemName.textContent = name;

    item.append(itemCode, itemName);

    if (isSelected) {
      const checkSvg = makeSvg('0 0 14 14', 12, 12, 'lang-item-check');
      const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      checkPath.setAttribute('d', 'M2 7L6 11L12 3');
      checkPath.setAttribute('stroke', '#e8b400');
      checkPath.setAttribute('stroke-width', '1.5');
      checkPath.setAttribute('stroke-linecap', 'round');
      checkPath.setAttribute('stroke-linejoin', 'round');
      checkSvg.append(checkPath);
      item.append(checkSvg);
    }

    dropdown.append(item);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    dropdown.classList.toggle('is-open', !expanded);
    btn.classList.toggle('is-open', !expanded);
  });
  document.addEventListener('click', () => {
    btn.setAttribute('aria-expanded', 'false');
    dropdown.classList.remove('is-open');
    btn.classList.remove('is-open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      btn.setAttribute('aria-expanded', 'false');
      dropdown.classList.remove('is-open');
      btn.classList.remove('is-open');
    }
  });

  block.textContent = '';
  block.append(btn, dropdown);
}

function makeSvg(viewBox, w, h, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  return svg;
}
