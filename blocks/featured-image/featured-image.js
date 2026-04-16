/**
 * Featured Image block — displays the article hero image.
 *
 * If an `image` reference field is set on the block, it displays
 * an optimized picture. Otherwise it renders a gradient placeholder
 * sized to the design spec.
 *
 * Page property sync: the `featuredImage` field in Page Properties
 * is the single source of truth used by the list block for thumbnails.
 * Set the same image there so list cards and the article hero stay
 * in sync. See plans/article-page.md for details.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const picture = block.querySelector('picture');

  if (picture) {
    const img = picture.querySelector('img');
    if (img) {
      const optimized = createOptimizedPicture(
        img.src,
        img.alt || '',
        false,
        [{ width: '1200' }],
      );
      moveInstrumentation(img, optimized.querySelector('img'));
      picture.replaceWith(optimized);
    }
    return;
  }

  // No image set — show gradient placeholder
  const placeholder = document.createElement('div');
  placeholder.className = 'featured-image-placeholder';
  while (block.firstChild) block.firstChild.remove();
  block.append(placeholder);
}
