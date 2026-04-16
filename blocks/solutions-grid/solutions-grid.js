/**
 * Solutions Grid block.
 * Renders a 6-tile solution area grid (Anritsu-style).
 *
 * Authoring structure (one row per solution):
 *   Row 1: Icon image | Title | Short description
 *   Row 2: Icon image | Title | Short description
 *   ...
 */
export default function decorate(block) {
  const rows = [...block.children];
  block.innerHTML = '';

  rows.forEach((row) => {
    const cells = [...row.children];
    const tile = document.createElement('div');
    tile.className = 'solutions-tile';

    const icon = cells[0]?.querySelector('img, picture');
    const title = cells[1]?.textContent.trim();
    const desc = cells[2]?.textContent.trim();
    const link = cells[1]?.querySelector('a') || cells[2]?.querySelector('a');

    if (icon) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'solutions-tile-icon';
      iconWrap.append(icon.closest('picture') || icon);
      tile.append(iconWrap);
    }

    const body = document.createElement('div');
    body.className = 'solutions-tile-body';

    if (title) {
      const h3 = document.createElement('h3');
      h3.textContent = title;
      body.append(h3);
    }

    if (desc) {
      const p = document.createElement('p');
      p.textContent = desc;
      body.append(p);
    }

    tile.append(body);

    const wrapper = link ? document.createElement('a') : document.createElement('div');
    if (link) {
      wrapper.href = link.href;
      wrapper.className = 'solutions-tile-link';
    }
    wrapper.append(tile);
    block.append(wrapper);
  });
}
