# Content Package Architecture Redesign — Hybrid Approach

## Problem Statement

The current architecture hides all page content, DAM assets, and CFM models inside a nested `site.zip` file:
```
content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/
  site.zip  ← everything is buried here (opaque, hard to maintain)
```

**Pain points:**
1. **Low visibility** — Can't see DAM assets, pages, or CF instances without extracting the ZIP
2. **Error-prone changes** — Requires: extract ZIP → modify → re-zip → rebuild packages → lose changes easily
3. **Version control friction** — Binary ZIP makes diffs useless; changes aren't trackable as code
4. **No incremental workflow** — Can't edit a single page or add one image without touching the whole package
5. **Team collaboration** — Hard to review what's in the package; easy to lose changes during re-zips
6. **Build complexity** — The `build-packages.py` script has to manipulate a nested ZIP, adding layers of indirection

## Desired State: Hybrid Architecture (Source + Generated)

Keep `site.zip` for QSC compatibility, but generate it from **visible, maintainable source files**:

```
content-source/                    ← NEW: Human-readable source (git-tracked)
  jcr_root/
    content/
      dam/b2b-ue/
        images/
          lumina-noventis-logo.png/
            .content.xml
            _jcr_content/renditions/original
            _jcr_content/renditions/original.dir/.content.xml
          [other images]
      
      cq:tags/b2b-ue/
        [tags]
      
      cq:graphql/b2b-ue/
        [GraphQL endpoint]
      
      b2b-ue/language-masters/
        .content.xml                      ← language-masters folder
        en/
          .content.xml                    ← en is the TOP/HOME page itself
          about/
            .content.xml
          products/
            .content.xml
          solutions/
            .content.xml
          news/
            .content.xml
          search/
            .content.xml
          nav/
            .content.xml
          footer/
            .content.xml
        ja/
          .content.xml                    ← ja is the TOP/HOME page
          about/
            .content.xml
          [other pages...]
        zh/
        ko/
        es/
        de/
        fr/
        ar/
        [all 8 languages with same structure]
    
    conf/
      b2b-ue/
        settings/
          dam/cfm/models/
            product-spec/
          graphql/persistedQueries/
            product-spec-by-path/

content-package/                   ← Template packaging (partially generated)
  META-INF/vault/
    config.xml
    filter.xml
    properties.xml
  
  jcr_root/conf/global/site-templates/b2b-ue-1.0.0/
    .content.xml                   (template metadata)
    site.zip                       ← GENERATED from content-source/
```

**Benefits:**
- ✅ **Full visibility** — All content visible as code in `content-source/`
- ✅ **Git-friendly** — Diffs work on source files (not binary ZIPs)
- ✅ **Incremental workflow** — Edit one page, one image, commit, rebuild
- ✅ **Easy review** — Pull requests show exactly what changed
- ✅ **Build simplification** — Build script zips `content-source/jcr_root/` → `site.zip` (straightforward)
- ✅ **QSC compatibility** — `site.zip` is ready for Quick Site Creation with dynamic naming (Option B)
- ✅ **Team collaboration** — Source files are mergeable; generated ZIP is just a build artifact
- ✅ **Clean separation** — Source of truth (code) vs. compiled artifact (ZIP)

## Changes Required

### 1. Create content-source/ directory from current site.zip

**Step 1a: Extract site.zip → content-source/jcr_root/**
- Extract `content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip`
- Copy extracted `jcr_root/` contents into new `content-source/jcr_root/`
- Create `content-source/META-INF/vault/` (copy from content-package if needed, or create minimal)
- Result: `content-source/` now contains all pages, DAM, CF models, GraphQL as visible files

**Step 1b: Verify directory structure**
- `content-source/jcr_root/content/b2b-ue/language-masters/en/home/`, etc.
- `content-source/jcr_root/content/dam/b2b-ue/images/`
- `content-source/jcr_root/conf/b2b-ue/settings/dam/cfm/models/`
- `content-source/jcr_root/content/cq:graphql/b2b-ue/`

### 2. Update build-packages.py

**Current flow:**
```
build-packages.py
  → reads content-package/
  → extracts site.zip from template
  → manipulates site.zip (removes conf entries)
  → creates new site.zip
  → zips everything into b2b-ue-template-1.0.0.zip
  → zips everything (minus conf) into b2b-ue-site-1.0.0.zip
```

**New flow:**
```
build-packages.py
  → reads content-source/jcr_root/
  → zips it into content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip
  → reads content-package/ 
  → creates b2b-ue-template-1.0.0.zip (includes the generated site.zip)
  → creates b2b-ue-site-1.0.0.zip (includes site.zip, excludes /conf/b2b-ue/settings/cloudconfigs)
```

**Implementation:**
- Add step to `build-packages.py` to build site.zip FROM content-source/jcr_root/
- Keep existing packaging logic unchanged
- Generate both outputs in one pass

**Key point:** `site.zip` becomes a **build artifact** (like compiled code), not a source file.

### 3. Add .gitignore entries

```gitignore
# Generated artifacts
site.zip
b2b-ue-template-1.0.0.zip
b2b-ue-site-1.0.0.zip

# If inside content-package/
content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip
```

Only `content-source/` is git-tracked. Packages are generated.

### 4. Update README.md

**Current notes:**
- Mentions nested `site.zip` as source
- Describes separate rebuild scripts
- QSC workflow section

**New notes — add two workflows:**

**Workflow A — Fresh Install:**
- Install template package
- Run Quick Site Creation
- QSC handles path remapping (b2b-ue → chosen site name)
- Result: site at `/content/{site-name}/`

**Workflow B — Update Existing Installation:**
- Most updates should happen in UE (pages, blocks added via Git, DAM via UI)
- For bulk content updates: update `content-source/`, rebuild, install site package
- Document that package paths are currently hardcoded to `/content/b2b-ue/`, so bulk updates via Solution B require temporary build-script modification with actual site name

**General guidance:**
- `content-source/` is the source of truth for initial template content
- Block additions are code (Git); they appear in UE automatically
- Page edits are done in UE after site creation; no package reinstall needed
- Use packages for bulk migrations or rare CF model updates

### 5. Workflow Changes for Team

**Current:**
1. Edit page via UE on author
2. Export page as XML (manual export)
3. Paste into external rebuild script
4. Run rebuild script manually
5. Run `npm run build:packages`
6. Reinstall package
7. Risk of losing work if ZIP manipulation goes wrong

**New:**
1. Edit page via UE on author (e.g., en/about, en/products)
2. Export page as XML
3. Paste into `content-source/jcr_root/content/b2b-ue/language-masters/{lang}/{page-name}/.content.xml`
   - For top/home page: `content-source/jcr_root/content/b2b-ue/language-masters/{lang}/.content.xml`
   - For child pages: `content-source/jcr_root/content/b2b-ue/language-masters/{lang}/about/.content.xml` etc.
4. Commit to git
5. Run `npm run build:packages` (automatically generates site.zip)
6. Reinstall package if needed (only for DAM/CF changes; page edits in UE don't require re-package)

**Or (if pages are rarely edited after QSC setup):**
1. Use QSC once to create the site with a chosen site name (e.g., "abc")
2. All content from `site.zip` installs to `/content/abc/language-masters/`, `/content/dam/abc/`, `/conf/abc/` (dynamic naming, Option B)
3. Subsequent edits happen in UE on author (no re-package needed)
4. Package is only reinstalled when you need to push DAM updates or CF model changes

## Migration Checklist

### Phase 1: Extract and Organize
- [ ] Create `content-source/` directory at repo root
- [ ] Extract `content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip`
- [ ] Copy extracted `jcr_root/` into `content-source/jcr_root/`
- [ ] Verify structure:
  - [ ] DAM assets at `content-source/jcr_root/content/dam/b2b-ue/images/`
  - [ ] Language folders at `content-source/jcr_root/content/b2b-ue/language-masters/{lang}/` (en, ja, zh, ko, es, de, fr, ar)
    - [ ] Each language folder has a `.content.xml` (this is the top/home page)
    - [ ] Each language has child pages: about/, products/, solutions/, news/, search/, nav/, footer/
  - [ ] CF models at `content-source/jcr_root/conf/b2b-ue/settings/dam/cfm/models/`
  - [ ] GraphQL at `content-source/jcr_root/content/cq:graphql/b2b-ue/`
  - [ ] Tags at `content-source/jcr_root/content/cq:tags/b2b-ue/`

### Phase 2: Update Build Process
- [ ] Modify `build-packages.py`:
  - [ ] Add step to zip `content-source/jcr_root/` → `content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip`
  - [ ] Keep existing packaging logic for template and site packages
  - [ ] Test locally: `npm run build:packages`
- [ ] Add `.gitignore` entries:
  - [ ] Ignore generated `site.zip`
  - [ ] Ignore generated `b2b-ue-template-1.0.0.zip`
  - [ ] Ignore generated `b2b-ue-site-1.0.0.zip`
- [ ] Commit `content-source/jcr_root/` to git (all source files)

### Phase 3: Test Build & Installation
- [ ] Clean and rebuild: `npm run build:packages`
- [ ] Verify output:
  - [ ] `content-package/jcr_root/conf/global/site-templates/b2b-ue-1.0.0/site.zip` exists
  - [ ] `b2b-ue-template-1.0.0.zip` exists
  - [ ] `b2b-ue-site-1.0.0.zip` exists
- [ ] Test on fresh AEM environment:
  - [ ] Install `b2b-ue-template-1.0.0.zip`
  - [ ] Run QSC with site name = "my-test-site"
  - [ ] Verify content structure with dynamic naming (Option B):
    - [ ] Language-masters folder at `/content/my-test-site/language-masters/`
    - [ ] Top/home page (language folder) at `/content/my-test-site/language-masters/en/` (and ja, zh, ko, es, de, fr, ar)
    - [ ] Child pages at `/content/my-test-site/language-masters/en/about/`, `/en/products/`, `/en/solutions/`, etc.
    - [ ] DAM at `/content/dam/my-test-site/images/`
    - [ ] CF models at `/conf/my-test-site/settings/dam/cfm/models/`
  - [ ] Verify logo loads correctly
  - [ ] Verify pages for all 8 languages present and accessible
  - [ ] Verify each language's home page (`en/.content.xml`, `ja/.content.xml`, etc.) loads

### Phase 4: Documentation
- [ ] Update README.md:
  - [ ] Explain `content-source/` structure
  - [ ] Document new workflow (edit → commit → build → install)
  - [ ] Clarify QSC installation flow with dynamic naming (Option B)
  - [ ] Remove references to separate rebuild scripts
- [ ] Update this plan with final implementation notes
- [ ] Team training: explain where to edit content, how to rebuild

## What Becomes Different

### TODAY
```
User edits page in UE on author
  ↓ (manual export)
User pastes XML into rebuild script
  ↓ 
Rebuild script creates new site.zip
  ↓ (must re-zip, easy to mess up)
Run npm run build:packages
  ↓
Install package on AEM
```

### AFTER HYBRID APPROACH
```
User edits page in UE on author
  ↓ (export as needed)
User pastes XML into content-source/jcr_root/content/b2b-ue/language-masters/{lang}/{page}/.content.xml
  ↓
git commit
  ↓ (automated/local)
npm run build:packages  (one command, no manual ZIP manipulation)
  ↓
Install package on AEM
```

**Key differences:**
1. **Source visibility**: All content is readable in `content-source/` (not inside a ZIP)
2. **Build automation**: `npm run build:packages` automatically zips from source (no manual extraction/re-zipping)
3. **QSC unchanged**: Template package still contains site.zip; QSC installation still works with dynamic naming (Option B)
4. **Git-friendly**: Source files are tracked; generated ZIPs are ignored (build artifacts)
5. **Maintainability**: Content edits are visible, mergeable, and reviewable as code

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Extraction loses content (corrupted ZIP) | Extract carefully; verify all files present before committing |
| build-packages.py breaks | Keep backup of old script; test locally before committing changes |
| Team members confused about what to edit | Clear documentation: edit `content-source/`, not `content-package/` |
| Generated site.zip accidentally committed to git | Add to .gitignore immediately; educate team on build artifacts |
| QSC doesn't recognize dynamic paths (Option B fails) | Test on fresh AEM; may need vault filter adjustments |
| Large repo size if all content is visible | Expected; content-source/ is ~1-2 MB; not a blocker |

## Success Criteria

### Structure & Build
1. ✅ `content-source/jcr_root/` contains all pages, DAM, CF models as visible files
2. ✅ `npm run build:packages` generates site.zip from `content-source/` automatically
3. ✅ Generated ZIPs (`site.zip`, template, site packages) are in `.gitignore`
4. ✅ Only `content-source/` is git-tracked; no binary artifacts in git

### Workflow A — Fresh Install
5. ✅ Template package installs on fresh AEM
6. ✅ QSC wizard recognizes B2B UE Starter template
7. ✅ QSC creates site with chosen name (e.g., "my-site")
8. ✅ All paths are correctly remapped: `/content/b2b-ue/` → `/content/my-site/`
9. ✅ DAM remapped: `/content/dam/b2b-ue/` → `/content/dam/my-site/`
10. ✅ CF models remapped: `/conf/b2b-ue/` → `/conf/my-site/`
11. ✅ Logo loads correctly from DAM
12. ✅ All 8 language pages present and accessible

### Workflow B — Update Existing Installation
13. ✅ Existing site (e.g., `/content/my-site/`) can be updated via new blocks (Git) without package
14. ✅ Authors can edit pages in UE; changes live immediately
15. ✅ Option B (Solution B documented): Build-packages.py can be parameterized with site name for bulk content updates

### Documentation
16. ✅ README updated with both workflows (A: fresh install, B: update existing)
17. ✅ Plan documented with path remapping strategy
18. ✅ No content lost during extraction/migration

## Installation & Update Workflows

### Workflow A: Fresh Install (Central Repo → Partner's First-Time Setup)

**Scenario:** A partner (or you on a fresh environment) is setting up b2b-ue for the first time. They fork/clone this central repo and want to get everything running with their own site name.

**Steps:**
1. Fork/clone the b2b-ue repo locally
2. Run `npm run build:packages` → generates `b2b-ue-template-1.0.0.zip` (with hardcoded `b2b-ue` paths)
3. Go to AEM Package Manager (`/crx/packmgr`)
4. Upload and install `b2b-ue-template-1.0.0.zip`
5. Go to AEM Sites → **Create → Site from Template**
6. Select **B2B UE Starter** template
7. Enter your chosen site name (e.g., "acme-devices", "partner-portal", "my-site")
8. Paste GitHub repo URL
9. Click **Create**

**QSC does the magic:**
- Extracts site.zip from template package
- Remaps all paths: `/content/b2b-ue/` → `/content/acme-devices/`
- Remaps DAM: `/content/dam/b2b-ue/` → `/content/dam/acme-devices/`
- Remaps CF models: `/conf/b2b-ue/` → `/conf/acme-devices/`
- Creates all pages, DAM assets, CF models, GraphQL endpoint with the chosen site name

**Result:** Full site installed at `/content/acme-devices/language-masters/`, ready for authoring.

---

### Workflow B: Update Existing Installation (Partner Updates After Initial Setup)

**Scenario:** A partner has been using b2b-ue (site created via Workflow A at `/content/acme-devices/`). They pull the latest code from this central repo, which includes:
- New blocks (frontend code)
- New sample content (DAM assets, example pages, CF instances)

They want to get these updates on their existing site.

**The Challenge:** The repo's `content-source/` has hardcoded paths for `b2b-ue`, but the partner's site is at `acme-devices`. Package Manager doesn't auto-remap paths like QSC does.

**The Solution: Parameterized Build**

1. Partner pulls latest code from central repo: `git pull`
2. Partner builds packages with their actual site name:
   ```bash
   npm run build:packages --site-name=acme-devices
   ```
3. Build process:
   - Reads `content-source/jcr_root/` (sample content with b2b-ue paths)
   - Dynamically remaps: `b2b-ue` → `acme-devices`
   - Generates packages with correct paths for that site
4. Partner goes to AEM Package Manager
5. Installs `b2b-ue-site-1.0.0.zip`
6. All new sample content/DAM/CF updates install at `/content/acme-devices/`, `/content/dam/acme-devices/`, `/conf/acme-devices/`

**New Blocks Benefit:**
- Blocks are deployed as **code** (not content), so they appear immediately in Universal Editor
- No package needed for blocks; Git pull → they're there
- Partners can use new blocks with existing content or with new sample content from the package

**How This Scales for Central Repository:**
- You maintain `content-source/` with best-practice sample content and DAM
- You add new blocks to the codebase
- Partners pull updates
- Partners run one command: `npm run build:packages --site-name=their-site-name`
- Partners install the updated package
- **Everyone gets new features + sample content tailored to their site name**

**The Benefit:**
| Partner Action | Result |
|---|---|
| `git pull` | Get latest blocks, styles, utilities (automatic, no package needed) |
| `npm run build:packages --site-name=their-site` | Get remapped packages for their site |
| Install `b2b-ue-site-1.0.0.zip` | New sample content, DAM, CF appear at their site paths |

This is the "rocket start" you wanted: partners get both code and content samples automatically adapted to their site.

---

## Timeline

- **Phase 1** (1-2 hours): Extract site.zip, verify structure
- **Phase 2** (30-45 min): Simplify build-packages.py (keep hardcoded paths for now)
- **Phase 3** (15-30 min): Test fresh install on dev (Workflow A)
- **Phase 4** (30 min): Document both workflows in README
- **Phase 5** (optional): Add site-name parameterization to build-packages.py (Workflow B) — can be done later if needed
- **Phase 6** (ongoing): Team training + git commit

## Clarifications (Already Addressed by User)

### #1 Dynamic Site Naming (Option B) ✅
**Confirmed:** When QSC creates a site with name "abc":
- All paths transform: `/content/b2b-ue/` → `/content/abc/`
- Including DAM: `/content/dam/b2b-ue/` → `/content/dam/abc/`
- Including CF models: `/conf/b2b-ue/` → `/conf/abc/`
- Full dynamic naming throughout the installation

### #2 Asset Workflow ✅
**Confirmed:** Assets added to repo XML, then packaged.
- No manual upload-then-export workflow
- DAM content lives in `content-source/jcr_root/content/dam/b2b-ue/images/`
- Build process packages it into site.zip
- QSC installs it when creating the site

### #3 CF Models & Persisted Queries ✅
**Confirmed:** No changes.
- ProductSpec CFM stays in `content-source/jcr_root/conf/b2b-ue/settings/dam/cfm/models/`
- Persisted queries stay in `content-source/jcr_root/conf/b2b-ue/settings/graphql/persistedQueries/`
- Both are packaged and installed with site.zip
