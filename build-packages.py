#!/usr/bin/env python3
"""
Build script — generates two AEM content packages from content-source/

  b2b-ue-template-{VERSION}.zip
      Template-only package. Installs the Quick Site Creation template at
      /conf/global/site-templates/b2b-ue-1.0.0/.  Developer then creates the
      site manually via Sites → Create → Site from Template.

  b2b-ue-site-{VERSION}.zip
      Full-install package. Installs the template + page content + DAM.
      /conf/b2b-ue is intentionally excluded — that conf is owned by Quick
      Site Creation and stores the franklin.delivery GitHub proxy config that
      serves component-*.json to Universal Editor. Touching it causes 404s.
      Use merge mode for /content/b2b-ue to preserve site-level properties.

Usage:
    python3 build-packages.py                              # builds both
    python3 build-packages.py --version 1.2.0
    python3 build-packages.py --site-name acme-devices   # Workflow B: remap paths
    python3 build-packages.py --template-only
    python3 build-packages.py --site-only

Source of truth:
    content-source/                     # Human-readable source (git-tracked)
      jcr_root/
        content/b2b-ue/language-masters/
        content/dam/b2b-ue/
        conf/b2b-ue/settings/

    content-package/                    # Template packaging (partially generated)
      jcr_root/conf/global/site-templates/b2b-ue-1.0.0/
        site.zip                        # Generated from content-source/
      META-INF/vault/
        config.xml, filter.xml, properties.xml
"""

import argparse
import io
import os
import re
import zipfile

CONTENT_SOURCE_DIR = "content-source"
CONTENT_PKG_DIR = "content-package"
SITE_ZIP_REL = "jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip"
DEFAULT_SITE_NAME = "b2b-ue"

# Prefixes inside site.zip to exclude when embedding in any output package.
# - META-INF: rebuilt per package
# - conf/b2b-ue: entirely excluded from the cleaned site.zip used in the template
#   package.  /conf/b2b-ue is OWNED by Quick Site Creation — QSC writes the
#   franklin.delivery GitHub proxy config there as part of its own setup.
#   Including any /conf/b2b-ue content in site.zip can interfere with QSC's conf
#   creation (race condition or filter replace wiping the proxy config) and is the
#   primary cause of QSC not creating the site successfully.
SITE_ZIP_SKIP_PREFIXES = (
    "META-INF",
    "jcr_root/conf/b2b-ue",
)

# Sub-paths of conf/b2b-ue that SHOULD be kept (CF model config).
# The cloudconfigs sub-tree is still stripped (owned by QSC), but
# dam/cfm contains Content Fragment Model definitions we package.
SITE_ZIP_KEEP_PREFIXES = (
    "jcr_root/conf/b2b-ue/settings/dam/cfm",
    "jcr_root/conf/b2b-ue/settings/graphql",
)

DEFAULT_VERSION = "1.0.0"


def _remap_site_name(content: str, from_name: str, to_name: str) -> str:
    """
    Remap site name in XML content (Workflow B).

    Replaces:
    - /content/{from_name}/ → /content/{to_name}/
    - /content/dam/{from_name}/ → /content/dam/{to_name}/
    - /conf/{from_name}/ → /conf/{to_name}/
    - /content/_cq_graphql/{from_name}/ → /content/_cq_graphql/{to_name}/

    Preserves all other content and structure.
    """
    if from_name == to_name:
        return content

    # Replace all site name references in paths
    patterns = [
        (f'/content/{from_name}/', f'/content/{to_name}/'),
        (f'/content/dam/{from_name}/', f'/content/dam/{to_name}/'),
        (f'/conf/{from_name}/', f'/conf/{to_name}/'),
        (f'/content/_cq_graphql/{from_name}/', f'/content/_cq_graphql/{to_name}/'),
        (f'/content/cq:tags/{from_name}/', f'/content/cq:tags/{to_name}/'),
    ]

    for pattern_from, pattern_to in patterns:
        content = content.replace(pattern_from, pattern_to)

    return content


def _build_site_zip(site_name: str = DEFAULT_SITE_NAME) -> bytes:
    """
    Build site.zip from content-source/jcr_root/ with optional site name remapping.

    This function:
    1. Reads all files from content-source/jcr_root/
    2. For .content.xml files, remaps site names (b2b-ue → provided site_name)
    3. Adds META-INF/vault/ files with proper filters
    4. Returns the zipped bytes

    Workflow A: site_name = "b2b-ue" (default) — no remapping
    Workflow B: site_name = "acme-devices" — remaps all paths from b2b-ue → acme-devices
    """
    source_jcr = os.path.join(CONTENT_SOURCE_DIR, "jcr_root")

    if not os.path.isdir(source_jcr):
        raise FileNotFoundError(f"content-source/jcr_root/ not found: {source_jcr}")

    buf = io.BytesIO()
    file_count = 0
    remapped_count = 0

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # Add jcr_root content
        for root, _, files in os.walk(source_jcr):
            for fname in files:
                full = os.path.join(root, fname)
                # Archive path: relative to CONTENT_SOURCE_DIR (omit "jcr_root/")
                arc = os.path.join("jcr_root", os.path.relpath(full, source_jcr))
                file_count += 1

                # Remap site name in .content.xml files
                if fname == ".content.xml" and site_name != DEFAULT_SITE_NAME:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    remapped = _remap_site_name(content, DEFAULT_SITE_NAME, site_name)
                    z.writestr(arc, remapped)
                    remapped_count += 1
                else:
                    z.write(full, arc)

        # Add META-INF/vault/filter.xml for this site.zip
        filter_xml = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
  <filter root="/content/{site_name}/language-masters" mode="merge"/>
  <filter root="/content/dam/{site_name}" mode="merge"/>
  <filter root="/content/cq:tags/{site_name}" mode="merge"/>
  <filter root="/content/_cq_graphql/{site_name}" mode="merge"/>
  <filter root="/conf/{site_name}/settings/dam/cfm" mode="merge"/>
  <filter root="/conf/{site_name}/settings/graphql" mode="merge"/>
</workspaceFilter>
"""
        z.writestr("META-INF/vault/filter.xml", filter_xml)

        # Add basic properties.xml and config.xml to META-INF
        properties_xml = """\
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="name">b2b-ue-content</entry>
  <entry key="version">1.0.0</entry>
  <entry key="group">b2b-ue</entry>
  <entry key="description">B2B UE — Content package (generated from content-source)</entry>
  <entry key="requiresRoot">false</entry>
  <entry key="packageType">content</entry>
</properties>
"""
        z.writestr("META-INF/vault/properties.xml", properties_xml)

        # Config.xml (standard, can be copied from content-package or use default)
        config_xml = """\
<?xml version="1.0" encoding="UTF-8"?>
<vaultfs version="1.1">
  <aggregates>
    <aggregate type="file" title="File Aggregate"/>
    <aggregate type="folder" title="Folder Aggregate"/>
  </aggregates>
  <mirrors/>
</vaultfs>
"""
        z.writestr("META-INF/vault/config.xml", config_xml)

    if site_name != DEFAULT_SITE_NAME:
        print(f"    (built site.zip: {file_count} files, {remapped_count} remapped to '{site_name}')")
    else:
        print(f"    (built site.zip: {file_count} files)")

    return buf.getvalue()


def _write_site_zip_to_template(site_zip_bytes: bytes) -> None:
    """
    Write the generated site.zip to content-package/ for packaging.
    """
    site_zip_path = os.path.join(CONTENT_PKG_DIR, SITE_ZIP_REL)
    os.makedirs(os.path.dirname(site_zip_path), exist_ok=True)
    with open(site_zip_path, "wb") as f:
        f.write(site_zip_bytes)


def _read_src(rel_path: str) -> bytes:
    full = os.path.join(CONTENT_PKG_DIR, rel_path)
    with open(full, "rb") as f:
        return f.read()


def _cleaned_site_zip_bytes() -> bytes:
    """
    Return a cleaned site.zip for embedding in the template package.

    Changes vs. the source site.zip:
    1. The broad jcr_root/conf/b2b-ue entry (replace mode) is replaced with
       targeted merge-mode sub-paths (CFM models + GraphQL config).  The broad
       replace would wipe QSC's franklin.delivery GitHub proxy config.
    2. /content/dam/b2b-ue changed to mode="merge" so that existing DAM assets
       from a previous install do not cause a replace-rollback.
    3. /content/cq:graphql/b2b-ue kept with mode="merge" — the GraphQL endpoint
       is installed by QSC so the full stack is ready in one step.

    NOTE — reinstalls: AEM's QSC pre-flight check rejects site creation if any
    path containing the site name already exists under /content/.  Before
    reinstalling via QSC, delete:
      /content/b2b-ue, /content/dam/b2b-ue,
      /content/cq:graphql/b2b-ue, /content/cq:tags/b2b-ue, /conf/b2b-ue
    """
    src_path = os.path.join(CONTENT_PKG_DIR, SITE_ZIP_REL)
    buf = io.BytesIO()
    skipped = 0
    with zipfile.ZipFile(src_path, "r") as src, \
         zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            # Strip conf/b2b-ue except the targeted sub-paths we own.
            if any(item.filename.startswith(p) for p in SITE_ZIP_SKIP_PREFIXES):
                if not any(item.filename.startswith(k) for k in SITE_ZIP_KEEP_PREFIXES):
                    skipped += 1
                    continue
            dst.writestr(item.filename, src.read(item.filename))
        # Rewrite filter.xml: drop /conf/b2b-ue entirely, set DAM to merge
        original_filter = src.read("META-INF/vault/filter.xml").decode()
        cleaned_filter = _rewrite_site_zip_filter(original_filter)
        dst.writestr("META-INF/vault/filter.xml", cleaned_filter)
        # Copy other META-INF files (properties.xml, etc.) unchanged
        for item in src.infolist():
            if item.filename.startswith("META-INF") and \
               item.filename != "META-INF/vault/filter.xml":
                dst.writestr(item.filename, src.read(item.filename))
    if skipped:
        print(f"    (cleaned site.zip: removed {skipped} /conf/b2b-ue entries)")
    return buf.getvalue()


def _rewrite_site_zip_filter(filter_xml: str) -> str:
    """
    Rewrite site.zip's filter.xml for safe QSC embedding:
    - Remove the broad /conf/b2b-ue filter (replace mode — would wipe QSC's
      GitHub proxy cloudconfig) and replace with targeted merge sub-paths.
    - Set /content/dam/b2b-ue to mode="merge" (prevents rollback if DAM exists)
    - Keep /content/cq:graphql/b2b-ue with mode="merge" so the GraphQL endpoint
      is installed by QSC in one step.
    """
    import re
    # Drop broad /conf/b2b-ue filter only — QSC owns cloudconfigs there
    out = re.sub(r'\s*<filter root="/conf/b2b-ue"[^/]*/>', '', filter_xml)
    # Add targeted filters for CF models + GraphQL config (merge — additive only)
    extra_filters = (
        '\n  <filter root="/conf/b2b-ue/settings/dam/cfm" mode="merge"/>'
        '\n  <filter root="/conf/b2b-ue/settings/graphql" mode="merge"/>'
        '\n  <filter root="/content/cq:graphql/b2b-ue" mode="merge"/>'
    )
    out = out.replace('</workspaceFilter>', f'{extra_filters}\n</workspaceFilter>')
    # Add mode="merge" to DAM filter (replace bare self-closing element)
    out = re.sub(
        r'<filter root="/content/dam/b2b-ue"\s*/>',
        '<filter root="/content/dam/b2b-ue" mode="merge"/>',
        out,
    )
    return out


def build_template(version: str) -> str:
    """
    Template package — installs the Quick Site Creation template.
    When the developer runs Sites → Create → Site from Template, AEM installs
    the embedded site.zip which creates /content/b2b-ue with all pre-configured
    content (hero-b2b, solutions grid, etc.).

    The site.zip is rebuilt on-the-fly with CF model nodes removed so the QSC
    installation does not error and roll back the content pages.
    """
    out = f"b2b-ue-template-{version}.zip"
    if os.path.exists(out):
        os.remove(out)

    cleaned = _cleaned_site_zip_bytes()
    site_zip_arc = SITE_ZIP_REL  # arc path inside the outer zip

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(CONTENT_PKG_DIR):
            for fname in files:
                full = os.path.join(root, fname)
                arc = os.path.relpath(full, CONTENT_PKG_DIR)
                if arc == site_zip_arc:
                    # Replace with cleaned version
                    z.writestr(arc, cleaned)
                else:
                    z.write(full, arc)

    print(f"  [template]      {out}  ({os.path.getsize(out) // 1024} KB)")
    return out


def build_fullinstall(version: str) -> str:
    """
    Full-install package — template + all site content in one package.

    Filter modes:
      /conf/global/site-templates  → replace  (fixed, predictable structure)
      /content/b2b-ue              → merge    (preserves site-level properties
                                               set by Quick Site Creation)
      /content/dam/b2b-ue          → replace  (fully controlled asset set)

    /conf/b2b-ue is intentionally EXCLUDED from this package.
    That path is owned entirely by Quick Site Creation — it writes the GitHub
    repo cloud config that powers the franklin.delivery proxy (which serves
    component-*.json to Universal Editor). If we touch /conf/b2b-ue, we risk
    breaking the proxy and causing 404s for component-models/filters/definition.

    Workflow:
      1. First install: use b2b-ue-template + Quick Site Creation (sets up conf)
      2. Subsequent updates: reinstall b2b-ue-site (touches only content + DAM)
    """
    site_zip_path = os.path.join(CONTENT_PKG_DIR, SITE_ZIP_REL)
    if not os.path.exists(site_zip_path):
        raise FileNotFoundError(f"site.zip not found: {site_zip_path}")

    out = f"b2b-ue-site-{version}.zip"
    if os.path.exists(out):
        os.remove(out)

    filter_xml = """\
<?xml version="1.0" encoding="UTF-8"?>
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
"""

    properties_xml = f"""\
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="name">b2b-ue-site</entry>
  <entry key="version">{version}</entry>
  <entry key="group">b2b-ue</entry>
  <entry key="description">B2B UE — Full site install (template + content). Merge-safe reinstall.</entry>
  <entry key="requiresRoot">false</entry>
  <entry key="packageType">content</entry>
</properties>
"""

    # full-install skips: META-INF (custom below) + conf/b2b-ue (owned by QSC)
    fullinstall_skip = (
        "META-INF",
        "jcr_root/conf/b2b-ue",
    )
    skipped = 0

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        # META-INF — custom filter + properties, shared vault config
        z.writestr("META-INF/vault/filter.xml", filter_xml)
        z.writestr("META-INF/vault/properties.xml", properties_xml)
        z.writestr("META-INF/vault/config.xml",
                   _read_src("META-INF/vault/config.xml").decode())

        # jcr_root from content-package/ (the site template tree)
        src_jcr = os.path.join(CONTENT_PKG_DIR, "jcr_root")
        for root, _, files in os.walk(src_jcr):
            for fname in files:
                full = os.path.join(root, fname)
                arc = os.path.relpath(full, CONTENT_PKG_DIR)
                z.write(full, arc)

        # jcr_root from site.zip (page content + DAM only — skip conf/b2b-ue
        # except CF model definitions under settings/dam/cfm)
        with zipfile.ZipFile(site_zip_path, "r") as site_z:
            for item in site_z.infolist():
                if any(item.filename.startswith(p) for p in fullinstall_skip):
                    if not any(item.filename.startswith(k) for k in SITE_ZIP_KEEP_PREFIXES):
                        skipped += 1
                        continue
                z.writestr(item.filename, site_z.read(item.filename))

    if skipped:
        print(f"  [full install]  skipped {skipped} entries (conf/b2b-ue + META-INF)")
    print(f"  [full install]  {out}  ({os.path.getsize(out) // 1024} KB)")
    return out


def main():
    parser = argparse.ArgumentParser(
        description="Build AEM content packages for b2b-ue"
    )
    parser.add_argument(
        "--version", default=DEFAULT_VERSION,
        help=f"Package version (default: {DEFAULT_VERSION})"
    )
    parser.add_argument(
        "--site-name", default=DEFAULT_SITE_NAME,
        help=f"Site name for path remapping (Workflow B). Default: {DEFAULT_SITE_NAME}"
    )
    parser.add_argument(
        "--template-only", action="store_true",
        help="Build only the template package"
    )
    parser.add_argument(
        "--site-only", action="store_true",
        help="Build only the full-install package"
    )
    args = parser.parse_args()

    print(f"Building packages (version {args.version})...")

    # Step 1: Build site.zip from content-source/ with optional remapping
    print(f"  [step 1]        Generating site.zip from content-source/{'' if args.site_name == DEFAULT_SITE_NAME else f' (site name: {args.site_name})'}")
    site_zip_bytes = _build_site_zip(args.site_name)
    _write_site_zip_to_template(site_zip_bytes)

    # Step 2: Build content packages
    print(f"  [step 2]        Building packages...")
    if not args.site_only:
        build_template(args.version)
    if not args.template_only:
        build_fullinstall(args.version)

    print("Done.")


if __name__ == "__main__":
    main()
