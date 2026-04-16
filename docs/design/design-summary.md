# Lumina Noventis — Homepage Design Summary

**Brand:** Lumina Noventis (precision measurement instruments)
**Deliverable:** Desktop homepage mockup (1440px) created in Paper
**Design file:** "Lumina Noventis — Homepage" artboard in Paper

---

## Brand Identity

| Token | Value |
|---|---|
| Primary | `#003087` — Deep navy |
| Secondary | `#0066cc` — Mid blue (interactive/hover) |
| Accent | `#e8b400` — Gold (highlights, CTAs) |
| Dark BG | `#001840` — Footer/dark sections |
| Surface | `#f5f7fa` — Light section backgrounds |
| Text | `#1a1a1a` / `#4a5568` — Body copy |
| Heading font | Inter Tight, 700 weight |
| Body font | Inter, 400/500 weight |

---

## Page Structure (Top → Bottom)

### 1. Header / Navigation
- **Height:** 72px, `#003087` background
- **Left:** Gold square logo mark (compass/crosshair icon) + "LUMINA NOVENTIS" wordmark + "Precision Measurement" sub-label in gold
- **Center:** Nav links — Products / Solutions / Technology / About / News
- **Right:** Search icon · EN language selector · Gold "Contact Us" CTA button

### 2. Hero
- **Height:** 620px
- **Background:** `hero-measurement.jpeg` (caliper on 3D-printed part) with dark navy gradient overlay (`rgba(0,24,69,0.88)` → transparent)
- **Left accent:** 4px gold vertical bar at left edge
- **Content (left-aligned, max 720px):**
  - Eyebrow: "PRECISION MEASUREMENT INSTRUMENTS" in gold
  - Headline: "Measure What Matters Most" (58px, Inter Tight 700)
  - Body: aerospace → medical device instrument copy
  - CTAs: Gold "Explore Products" + ghost "View Solutions →"
  - Trust bar: 40+ Years · 120+ Countries · ISO 17025 (separated by dividers)

### 3. Solutions Grid — "Engineered for Your Industry"
- **Background:** `#f5f7fa`
- **Section label:** "INDUSTRY SOLUTIONS" in gold
- **Heading:** "Engineered for Your Industry" (38px)
- **Grid:** 3 × 2, each tile 420 × 220px, `border-radius: 6px`
- **Tile structure:** Photo background + dark gradient overlay + gold accent bar + title + descriptor + SVG industry icon (top-right)

| Tile | Image | SVG icon |
|---|---|---|
| Precision Manufacturing | `mfg-precision.jpeg` | Hexagon / tolerance |
| Medical Device Mfg. | `solutions-medical.jpeg` | Clipboard / compliance |
| Life Sciences & R&D | `solutions-lifesciences.jpeg` | Waveform / monitoring |
| Industrial Print | `solutions-print.jpeg` | Document / registration |
| Label & Packaging | `solutions-label.jpeg` | Lock / QC |
| Additive Manufacturing | `solutions-additive.jpeg` | 3D cube / layering |

- **Footer:** "View All Solutions →" link underlined in gold

### 4. "Why Engineers Choose Lumina Noventis" — Value Proposition Strip
- **Background:** `#003087`
- **Layout:** Left heading column (380px) + 4 equal pillar columns
- **Left:** Section heading + "Learn about our technology →" gold link
- **Pillars:**
  1. OIML & ISO Traceable — gold clock icon
  2. Sub-Micron Accuracy — checkbox icon
  3. IIoT / Industry 4.0 — trend line icon
  4. Global Service Network — target icon
- Each pillar: gold-tinted icon box + bold title + descriptor text

### 5. News — "From the Lab & Field"
- **Background:** White
- **Layout:** Section header row (heading left / "View All News" link right) + 3 cards
- **Card 1 (featured, 1.4× width):** `news-product-launch.jpeg` + "PRODUCT LAUNCH" badge + article content
- **Card 2:** `news-whitepaper.jpeg` + "WHITE PAPER" badge
- **Card 3:** `news-company.jpeg` + "COMPANY" badge
- **Card content:** Date · Headline · Summary · "Read more →" in `#0066cc`

### 6. CTA Banner — "Talk to a Metrology Application Engineer"
- **Height:** 400px, navy gradient background (`#001840` → `#0066cc`)
- **Left:** Eyebrow · 44px headline · body copy · dual CTAs (gold "Request a Demo" + ghost "Download Brochure")
- **Right:** Frosted glass stats box with 3 metrics: 98.7% uptime · 4h response · 42 service centers

### 7. Footer
- **Background:** `#001840`
- **Top row:** Brand column (logo + tagline + social icons) + 4 nav columns
  - Products: CMM Systems · Optical Profilometers · Spectrophotometers · Force & Torque Testers · Software Suite
  - Solutions: Precision Manufacturing · Medical Devices · Life Sciences · Industrial Print · Additive Manufacturing
  - Support: Calibration Services · Service Network · Training & Certification · Documentation · Contact Support
  - Company: About Us · News & Press · Careers · Investor Relations · Contact Us
- **Bottom bar:** Copyright · Privacy Policy · Terms of Use · Cookie Settings · Legal Notice

---

## Design Principles Applied

- **Restraint:** Dark navy + white + single gold accent — no competing colors
- **Technical credibility:** Precise numbers (0.05 µm, ISO 17025, 98.7%) communicate engineering authority
- **Visual hierarchy:** Inter Tight 700 for headings, Inter 400 for body — consistent across all sections
- **Gold as action signal:** Used only on CTAs, key stats, and section eyebrows — never decorative noise
- **Section rhythm:** Light (`#f5f7fa`) → Dark (`#003087`) → Light → Dark (`#001840`) creates alternating contrast

---

## Image Assets (`design-assets/`)

| File | Usage |
|---|---|
| `hero-measurement.jpeg` | Hero background |
| `mfg-precision.jpeg` | Solutions tile — Precision Manufacturing |
| `solutions-medical.jpeg` | Solutions tile — Medical Device Mfg. |
| `solutions-lifesciences.jpeg` | Solutions tile — Life Sciences & R&D |
| `solutions-print.jpeg` | Solutions tile — Industrial Print |
| `solutions-label.jpeg` | Solutions tile — Label & Packaging |
| `solutions-additive.jpeg` | Solutions tile — Additive Manufacturing |
| `news-product-launch.jpeg` | News card 1 thumbnail |
| `news-whitepaper.jpeg` | News card 2 thumbnail |
| `news-company.jpeg` | News card 3 thumbnail |

---

## EDS Block Mapping

| Design Section | EDS Block |
|---|---|
| Header / Nav | `header` + `fragment` |
| Hero | `hero` |
| Solutions Grid | `solutions-grid` |
| News Cards | `list` (Card style) or `cards` |
| CTA Banner | `cta-banner` *(planned)* |
| Footer | `footer` + `fragment` |
