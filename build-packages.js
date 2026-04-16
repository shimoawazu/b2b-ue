#!/usr/bin/env node

/**
 * Build script — generates two AEM content packages from content-source/
 *
 *   b2b-ue-template-{VERSION}.zip
 *       Template-only package. Installs the Quick Site Creation template at
 *       /conf/global/site-templates/b2b-ue-1.0.0/.  Developer then creates the
 *       site manually via Sites → Create → Site from Template.
 *
 *   b2b-ue-site-{VERSION}.zip
 *       Full-install package. Installs the template + page content + DAM.
 *       /conf/b2b-ue is intentionally excluded — that conf is owned by Quick
 *       Site Creation and stores the franklin.delivery GitHub proxy config that
 *       serves component-*.json to Universal Editor. Touching it causes 404s.
 *       Use merge mode for /content/b2b-ue to preserve site-level properties.
 *
 * Usage:
 *     node build-packages.js                              # builds both
 *     node build-packages.js --version 1.2.0
 *     node build-packages.js --site-name acme-devices    # Workflow B: remap paths
 *     node build-packages.js --template-only
 *     node build-packages.js --site-only
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');

const CONTENT_SOURCE_DIR = 'content-source';
const CONTENT_PKG_DIR = 'content-package';
const SITE_ZIP_REL = 'jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip';
const DEFAULT_SITE_NAME = 'b2b-ue';
const DEFAULT_VERSION = '1.0.0';

// Prefixes inside site.zip to exclude when embedding in any output package.
const SITE_ZIP_SKIP_PREFIXES = [
  'META-INF',
  'jcr_root/conf/b2b-ue',
];

// Sub-paths of conf/b2b-ue that SHOULD be kept (CF model config).
const SITE_ZIP_KEEP_PREFIXES = [
  'jcr_root/conf/b2b-ue/settings/dam/cfm',
  'jcr_root/conf/b2b-ue/settings/graphql',
];

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    version: DEFAULT_VERSION,
    siteName: DEFAULT_SITE_NAME,
    templateOnly: false,
    siteOnly: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--version' && i + 1 < args.length) {
      result.version = args[i + 1];
      i += 1;
    } else if (args[i] === '--site-name' && i + 1 < args.length) {
      result.siteName = args[i + 1];
      i += 1;
    } else if (args[i] === '--template-only') {
      result.templateOnly = true;
    } else if (args[i] === '--site-only') {
      result.siteOnly = true;
    }
  }

  return result;
}

/**
 * Remap site name in XML content (Workflow B)
 */
function remapSiteName(content, fromName, toName) {
  if (fromName === toName) {
    return content;
  }

  const patterns = [
    [new RegExp(`/content/${fromName}/`, 'g'), `/content/${toName}/`],
    [new RegExp(`/content/dam/${fromName}/`, 'g'), `/content/dam/${toName}/`],
    [new RegExp(`/conf/${fromName}/`, 'g'), `/conf/${toName}/`],
    [new RegExp(`/content/_cq_graphql/${fromName}/`, 'g'), `/content/_cq_graphql/${toName}/`],
    [new RegExp(`/content/cq:tags/${fromName}/`, 'g'), `/content/cq:tags/${toName}/`],
  ];

  let result = content;
  patterns.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });

  return result;
}

/**
 * Recursively walk directory and return all file paths
 */
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

/**
 * Build site.zip from content-source/jcr_root/ with optional site name remapping
 */
async function buildSiteZip(siteName = DEFAULT_SITE_NAME) {
  const sourceJcr = path.join(CONTENT_SOURCE_DIR, 'jcr_root');

  if (!fs.existsSync(sourceJcr)) {
    throw new Error(`content-source/jcr_root/ not found: ${sourceJcr}`);
  }

  return new Promise((resolve, reject) => {
    const output = [];
    let fileCount = 0;
    let remappedCount = 0;

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => {
      output.push(chunk);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('end', () => {
      const buffer = Buffer.concat(output);

      if (siteName !== DEFAULT_SITE_NAME) {
        console.log(`    (built site.zip: ${fileCount} files, ${remappedCount} remapped to '${siteName}')`);
      } else {
        console.log(`    (built site.zip: ${fileCount} files)`);
      }

      resolve(buffer);
    });

    // Add jcr_root content
    const files = walkDir(sourceJcr);
    files.forEach((file) => {
      const arcPath = path.join('jcr_root', path.relative(sourceJcr, file));
      const arcPathNormalized = arcPath.replace(/\\/g, '/');

      if (path.basename(file) === '.content.xml' && siteName !== DEFAULT_SITE_NAME) {
        const content = fs.readFileSync(file, 'utf-8');
        const remapped = remapSiteName(content, DEFAULT_SITE_NAME, siteName);
        archive.append(remapped, { name: arcPathNormalized });
        remappedCount += 1;
      } else {
        archive.file(file, { name: arcPathNormalized });
      }
      fileCount += 1;
    });

    // Add META-INF/vault/filter.xml
    const filterXml = `<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
  <filter root="/content/${siteName}/language-masters" mode="merge"/>
  <filter root="/content/dam/${siteName}" mode="merge"/>
  <filter root="/content/cq:tags/${siteName}" mode="merge"/>
  <filter root="/content/_cq_graphql/${siteName}" mode="merge"/>
  <filter root="/conf/${siteName}/settings/dam/cfm" mode="merge"/>
  <filter root="/conf/${siteName}/settings/graphql" mode="merge"/>
</workspaceFilter>
`;
    archive.append(filterXml, { name: 'META-INF/vault/filter.xml' });

    // Add basic properties.xml
    const propertiesXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="name">b2b-ue-content</entry>
  <entry key="version">1.0.0</entry>
  <entry key="group">b2b-ue</entry>
  <entry key="description">B2B UE — Content package (generated from content-source)</entry>
  <entry key="requiresRoot">false</entry>
  <entry key="packageType">content</entry>
</properties>
`;
    archive.append(propertiesXml, { name: 'META-INF/vault/properties.xml' });

    // Add config.xml
    const configXml = `<?xml version="1.0" encoding="UTF-8"?>
<vaultfs version="1.1">
  <aggregates>
    <aggregate type="file" title="File Aggregate"/>
    <aggregate type="folder" title="Folder Aggregate"/>
  </aggregates>
  <mirrors/>
</vaultfs>
`;
    archive.append(configXml, { name: 'META-INF/vault/config.xml' });

    archive.finalize();
  });
}

/**
 * Write generated site.zip to content-package/
 */
async function writeSiteZipToTemplate(siteZipBuffer) {
  const siteZipPath = path.join(CONTENT_PKG_DIR, SITE_ZIP_REL);
  const dir = path.dirname(siteZipPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    fs.writeFile(siteZipPath, siteZipBuffer, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Rewrite site.zip's filter.xml for safe QSC embedding
 */
function rewriteSiteZipFilter(filterXml) {
  // Drop broad /conf/b2b-ue filter only — QSC owns cloudconfigs there
  let out = filterXml.replace(/\s*<filter root="\/conf\/b2b-ue"[^/]*\/>/, '');

  // Add targeted filters for CF models + GraphQL config (merge — additive only)
  const extraFilters = `
  <filter root="/conf/b2b-ue/settings/dam/cfm" mode="merge"/>
  <filter root="/conf/b2b-ue/settings/graphql" mode="merge"/>
  <filter root="/content/cq:graphql/b2b-ue" mode="merge"/>`;

  out = out.replace('</workspaceFilter>', `${extraFilters}\n</workspaceFilter>`);

  // Add mode="merge" to DAM filter
  out = out.replace(
    /<filter root="\/content\/dam\/b2b-ue"\s*\/>/,
    '<filter root="/content/dam/b2b-ue" mode="merge"/>',
  );

  return out;
}

/**
 * Build template package
 */
async function buildTemplate(version) {
  const out = `b2b-ue-template-${version}.zip`;

  if (fs.existsSync(out)) {
    fs.unlinkSync(out);
  }

  return new Promise((resolve, reject) => {
    const siteZipPath = path.join(CONTENT_PKG_DIR, SITE_ZIP_REL);

    // Read the site.zip and clean it
    const siteZipBuffer = fs.readFileSync(siteZipPath);
    const AdmZip = require('archiver');

    // Use archiver to read the existing zip and write a new one
    const tmpZipPath = path.join(CONTENT_PKG_DIR, 'site.zip.tmp');
    const output = [];

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => {
      output.push(chunk);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('end', async () => {
      const cleanedZipBuffer = Buffer.concat(output);

      // Now create the template package
      const finalOutput = [];
      const finalArchive = archiver('zip', { zlib: { level: 9 } });

      finalArchive.on('data', (chunk) => {
        finalOutput.push(chunk);
      });

      finalArchive.on('error', (err) => {
        reject(err);
      });

      finalArchive.on('end', () => {
        const finalBuffer = Buffer.concat(finalOutput);
        fs.writeFileSync(out, finalBuffer);

        const sizeKb = Math.floor(fs.statSync(out).size / 1024);
        console.log(`  [template]      ${out}  (${sizeKb} KB)`);
        resolve(out);
      });

      // Add all files from content-package/ except site.zip
      const pkgFiles = walkDir(CONTENT_PKG_DIR);
      pkgFiles.forEach((file) => {
        const arcPath = path.relative(CONTENT_PKG_DIR, file).replace(/\\/g, '/');

        if (arcPath === SITE_ZIP_REL.replace(/\\/g, '/')) {
          // Replace with cleaned version
          finalArchive.append(cleanedZipBuffer, { name: arcPath });
        } else if (!arcPath.includes('.tmp')) {
          finalArchive.file(file, { name: arcPath });
        }
      });

      finalArchive.finalize();
    });

    // To clean the site.zip, we need to unzip and filter it
    // For now, we'll just copy it as-is. A proper implementation would use unzipper.
    // This is a simplified version that works if META-INF is already correct.
    const pkgFiles = walkDir(CONTENT_PKG_DIR);
    pkgFiles.forEach((file) => {
      const arcPath = path.relative(CONTENT_PKG_DIR, file).replace(/\\/g, '/');

      if (arcPath === SITE_ZIP_REL.replace(/\\/g, '/')) {
        // For simplicity, just copy - the site.zip should already be properly structured
        archive.append(siteZipBuffer, { name: arcPath });
      } else if (!arcPath.includes('.tmp')) {
        archive.file(file, { name: arcPath });
      }
    });

    archive.finalize();
  });
}

/**
 * Build full-install package
 */
async function buildFullinstall(version) {
  const out = `b2b-ue-site-${version}.zip`;

  if (fs.existsSync(out)) {
    fs.unlinkSync(out);
  }

  const siteZipPath = path.join(CONTENT_PKG_DIR, SITE_ZIP_REL);

  if (!fs.existsSync(siteZipPath)) {
    throw new Error(`site.zip not found: ${siteZipPath}`);
  }

  const filterXml = `<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
  <!-- Site template: replace is safe — fixed, predictable structure -->
  <filter root="/conf/global/site-templates/b2b-ue-1.0.0" mode="replace"/>
  <!-- Page content: update — updates properties on existing nodes AND adds
       missing nodes, but does not delete author-created pages absent from the
       package.  This ensures package changes (e.g. new block properties) are
       applied on reinstall without wiping author work.  NEVER use replace here:
       it would wipe all author-created content on every reinstall. -->
  <filter root="/content/b2b-ue" mode="update"/>
  <!-- DAM assets: update — adds new assets and updates existing ones without
       deleting assets absent from the package. Merge was too conservative:
       it left new assets uninstalled on reinstall. Replace risks rollback. -->
  <filter root="/content/dam/b2b-ue" mode="update"/>
  <!-- Tag taxonomy: merge — adds new category tags without wiping author-created tags -->
  <filter root="/content/cq:tags/b2b-ue" mode="merge"/>
  <!-- CF models + GraphQL — targeted sub-paths of /conf/b2b-ue that do NOT
       touch the QSC-owned cloudconfigs.  Merge adds definitions without
       interfering with the franklin.delivery proxy config. -->
  <filter root="/conf/b2b-ue/settings/dam/cfm" mode="merge"/>
  <filter root="/conf/b2b-ue/settings/graphql" mode="merge"/>
  <!-- GraphQL endpoint — maps to /conf/b2b-ue by naming convention -->
  <filter root="/content/cq:graphql/b2b-ue" mode="merge"/>
  <!-- The rest of /conf/b2b-ue is intentionally omitted: owned by QSC.
       Touching cloudconfigs breaks the franklin.delivery GitHub proxy that serves
       component-models.json / component-filters.json to Universal Editor. -->
</workspaceFilter>
`;

  const propertiesXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="name">b2b-ue-site</entry>
  <entry key="version">${version}</entry>
  <entry key="group">b2b-ue</entry>
  <entry key="description">B2B UE — Full site install (template + content). Merge-safe reinstall.</entry>
  <entry key="requiresRoot">false</entry>
  <entry key="packageType">content</entry>
</properties>
`;

  return new Promise((resolve, reject) => {
    const output = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => {
      output.push(chunk);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('close', () => {
      console.log('  [DEBUG]         Archive closed, writing file...');
      const buffer = Buffer.concat(output);
      fs.writeFileSync(out, buffer);

      const sizeKb = Math.floor(fs.statSync(out).size / 1024);
      console.log(`  [full install]  ${out}  (${sizeKb} KB)`);
      resolve(out);
    });

    archive.on('warning', (err) => {
      console.log(`  [DEBUG]         Archive warning: ${err.message}`);
    });

    try {
      // Add META-INF
      archive.append(filterXml, { name: 'META-INF/vault/filter.xml' });
      archive.append(propertiesXml, { name: 'META-INF/vault/properties.xml' });
      const configPath = path.join(CONTENT_PKG_DIR, 'META-INF/vault/config.xml');
      if (fs.existsSync(configPath)) {
        const config = fs.readFileSync(configPath, 'utf-8');
        archive.append(config, { name: 'META-INF/vault/config.xml' });
      }

      // Add jcr_root from content-package/
      const pkgJcr = path.join(CONTENT_PKG_DIR, 'jcr_root');
      if (fs.existsSync(pkgJcr)) {
        const pkgFiles = walkDir(pkgJcr);
        pkgFiles.forEach((file) => {
          const arcPath = path.relative(CONTENT_PKG_DIR, file).replace(/\\/g, '/');
          archive.file(file, { name: arcPath });
        });
      }

      // Add content from site.zip (extract and filter, skip /conf/b2b-ue except CF models)
      const siteZip = new AdmZip(siteZipPath);
      let siteZipSkipped = 0;

      siteZip.getEntries().forEach((entry) => {
        const filename = entry.entryName;

        // Skip META-INF and broad /conf/b2b-ue, but keep CF models + GraphQL
        if (SITE_ZIP_SKIP_PREFIXES.some((p) => filename.startsWith(p))) {
          if (!SITE_ZIP_KEEP_PREFIXES.some((k) => filename.startsWith(k))) {
            siteZipSkipped += 1;
            return;
          }
        }

        // Extract entry and add to archive
        const content = entry.getData();
        archive.append(content, { name: filename });
      });

      if (siteZipSkipped) {
        console.log(`  [full install]  skipped ${siteZipSkipped} entries (conf/b2b-ue + META-INF)`);
      }

      // NOW finalize after all entries are added
      archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Main entry point
 */
async function main() {
  try {
    const args = parseArgs();

    console.log(`Building packages (version ${args.version})...`);

    // Step 1: Build site.zip from content-source/
    const siteName = args.siteName === DEFAULT_SITE_NAME
      ? ''
      : ` (site name: ${args.siteName})`;
    console.log(`  [step 1]        Generating site.zip from content-source/${siteName}`);

    const siteZipBuffer = await buildSiteZip(args.siteName);
    await writeSiteZipToTemplate(siteZipBuffer);

    // Step 2: Build packages
    console.log(`  [step 2]        Building packages...`);

    if (!args.siteOnly) {
      await buildTemplate(args.version);
    }

    if (!args.templateOnly) {
      await buildFullinstall(args.version);
    }

    console.log('Done.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
