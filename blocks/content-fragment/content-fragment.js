import { executePersistedQuery } from '../../scripts/aem-graphql.js';

/** Fields that are metadata — not rendered as spec rows. */
const META_FIELDS = new Set([
  '_path', 'productName', 'series', 'category',
  'shortDescription', 'heroImage',
]);

/** Human-readable labels for known spec field names. */
const LABELS = {
  measurementUncertainty: 'Measurement uncertainty',
  protectionRating: 'Protection rating',
  operatingTemperature: 'Operating temperature',
  industrialProtocols: 'Industrial protocols',
  calibrationStandard: 'Calibration standard',
  compliance: 'Compliance',
  reportTemplates: 'Report templates',
};

function renderSpecTable(container, item, style) {
  container.className = `content-fragment-spec ${style || 'dark'}`;

  if (item.productName) {
    const heading = document.createElement('h3');
    heading.className = 'content-fragment-product-name';
    heading.textContent = item.productName;
    container.append(heading);
  }

  const table = document.createElement('div');
  table.className = 'content-fragment-table';

  Object.entries(item).forEach(([key, value]) => {
    if (META_FIELDS.has(key) || !value) return;

    const row = document.createElement('div');
    row.className = 'content-fragment-row';

    const label = document.createElement('span');
    label.className = 'content-fragment-label';
    label.textContent = LABELS[key] || key;

    const val = document.createElement('span');
    val.className = 'content-fragment-value';
    val.textContent = value;

    row.append(label, val);
    table.append(row);
  });

  container.append(table);
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const getCell = (i) => rows[i]?.querySelector(':scope > div:last-child');

  const cfPath = getCell(0)?.textContent?.trim();
  const queryPath = getCell(1)?.textContent?.trim();
  const variableName = getCell(2)?.textContent?.trim() || 'path';
  const display = getCell(3)?.textContent?.trim() || '';

  if (!cfPath || !queryPath) {
    block.textContent = '';
    const msg = document.createElement('p');
    msg.className = 'content-fragment-placeholder';
    msg.textContent = 'Select a Content Fragment and persisted query.';
    block.append(msg);
    return;
  }

  // Loading state
  block.textContent = '';
  const loading = document.createElement('p');
  loading.className = 'content-fragment-loading';
  loading.textContent = 'Loading…';
  block.append(loading);

  const item = await executePersistedQuery(queryPath, { [variableName]: cfPath });
  block.textContent = '';

  if (!item) {
    const err = document.createElement('p');
    err.className = 'content-fragment-error';
    err.textContent = 'Could not load content fragment.';
    block.append(err);
    return;
  }

  if (display === 'debug') {
    const pre = document.createElement('pre');
    pre.className = 'content-fragment-debug';
    pre.textContent = JSON.stringify(item, null, 2);
    block.append(pre);
    return;
  }

  renderSpecTable(block, item, display);
}
