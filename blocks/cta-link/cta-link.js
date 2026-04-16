import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const getText = (i) => rows[i]?.querySelector(':scope > div:last-child')?.textContent?.trim() || '';

  const linkText = getText(0);
  const linkUrl = getText(1) || '#';
  const variant = getText(2);
  if (variant) block.classList.add(variant);

  const wrapper = document.createElement('div');
  wrapper.className = 'cta-link-inner';

  if (variant === 'search') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cta-link-search';
    btn.setAttribute('aria-label', 'Search');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '8.5'); circle.setAttribute('cy', '8.5');
    circle.setAttribute('r', '5.5'); circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '1.5');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '13'); line.setAttribute('y1', '13');
    line.setAttribute('x2', '18'); line.setAttribute('y2', '18');
    line.setAttribute('stroke', 'currentColor'); line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    svg.append(circle, line);
    btn.append(svg);
    wrapper.append(btn);
  } else if (variant === 'contact') {
    const a = document.createElement('a');
    a.className = 'cta-link-contact';
    a.href = linkUrl;
    a.textContent = linkText || 'Contact Us';
    wrapper.append(a);
  } else {
    const a = document.createElement('a');
    a.className = 'cta-link-anchor';
    a.href = linkUrl;
    a.textContent = linkText;
    const arrow = document.createElement('span');
    arrow.className = 'cta-link-arrow';
    arrow.textContent = '→';
    a.append(document.createTextNode(' '), arrow);
    wrapper.append(a);
  }

  rows.forEach((row) => moveInstrumentation(row, wrapper));
  block.textContent = '';
  block.append(wrapper);
}
