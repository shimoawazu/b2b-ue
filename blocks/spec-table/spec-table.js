/**
 * Spec Table block.
 * Renders a key-value specification table (Epson-style).
 *
 * Authoring: standard table rows with two columns — label | value.
 * Any row whose first cell contains only bold text is treated as a section header.
 */
export default function decorate(block) {
  const table = document.createElement('table');
  table.className = 'spec-table-inner';

  const tbody = document.createElement('tbody');

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const tr = document.createElement('tr');

    const labelCell = cells[0];
    const valueCell = cells[1];

    const isHeader = labelCell && !valueCell;

    if (isHeader) {
      const th = document.createElement('th');
      th.colSpan = 2;
      th.className = 'spec-section-header';
      th.textContent = labelCell.textContent.trim();
      tr.append(th);
    } else {
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = labelCell?.textContent.trim() || '';
      const td = document.createElement('td');
      td.textContent = valueCell?.textContent.trim() || '';
      tr.append(th, td);
    }

    tbody.append(tr);
  });

  table.append(tbody);
  block.innerHTML = '';
  block.append(table);
}
