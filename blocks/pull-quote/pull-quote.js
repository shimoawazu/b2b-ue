import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Pull Quote block — wraps the richtext cell in a <blockquote>.
 * Preserves UE instrumentation via moveInstrumentation.
 */
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;

  const quote = document.createElement('blockquote');
  quote.className = 'pull-quote-text';
  moveInstrumentation(cell, quote);
  while (cell.firstChild) quote.append(cell.firstChild);

  while (block.firstChild) block.firstChild.remove();
  block.append(quote);
}
