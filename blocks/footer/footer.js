import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { isAuthorEnvironment } from '../../scripts/scripts.js';

import {
  getLanguage, getSiteName, PATH_PREFIX,
} from '../../scripts/utils.js';

/**
 * Extracts logo configuration from the loaded footer fragment's first image
 * @param {Element} fragment The footer fragment element
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
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const langCode = getLanguage();
  const siteName = await getSiteName();
  const isAuthor = isAuthorEnvironment();

  let footerPath = `/${langCode}/footer`;

  if (isAuthor) {
    footerPath = footerMeta
      ? new URL(footerMeta, window.location).pathname
      : `/content/${siteName}${PATH_PREFIX}/${langCode}/footer`;
  }

  // Load fragment first
  const fragment = await loadFragment(footerPath);

  // Extract logo configuration from the loaded fragment's first image
  const { logoUrl, logoAlt, brandName } = extractLogoFromFragment(fragment);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  footer.className = 'footer-wrapper';
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  // Assign named classes to the first 3 sections
  const sections = [...footer.children];
  const sectionClasses = ['footer-brand', 'footer-nav', 'footer-bottom'];
  sections.forEach((section, i) => {
    if (i < sectionClasses.length) {
      section.classList.add(sectionClasses[i]);
    }
  });

  // Prepend logo to the brand section
  const brandSection = footer.querySelector('.footer-brand');
  if (brandSection) {
    // Remove any existing picture elements from the rendered fragment content
    const existingPicture = brandSection.querySelector('picture');
    if (existingPicture) {
      existingPicture.remove();
    }

    const logoLink = document.createElement('a');
    logoLink.className = 'footer-logo-link';
    logoLink.href = `/${langCode}`;

    const logoImg = document.createElement('img');
    logoImg.src = logoUrl || '/icons/logo.svg';
    logoImg.alt = logoAlt;
    logoImg.className = 'footer-logo-mark';
    if (!logoAlt) logoImg.setAttribute('aria-hidden', 'true');

    logoLink.append(logoImg);

    // Only add brand name span if provided and not empty
    if (brandName) {
      const logoName = document.createElement('span');
      logoName.className = 'footer-logo-name';
      logoName.textContent = brandName;
      logoLink.append(logoName);
    }

    brandSection.prepend(logoLink);
  }

  block.append(footer);
}
