# KeepCabin Landing Page Redesign

**Date:** 2026-06-26
**Approach:** Profound-inspired with KeepCabin story (Option B)
**Design source:** tryprofound.com — design system extracted via skillui v1.3.4

---

## 1. Overview

Redesign the existing KeepCabin landing page to match the Profound design system aesthetic while telling the KeepCabin product story (receipt/expense tracking via Google Drive + OCR). All 5 existing components are updated; 2 new sections are added.

**Page section order:**
1. Navbar
2. Hero
3. How it works *(new)*
4. Features
5. Testimonials *(new)*
6. Pricing
7. Footer

No commits. No new dependencies. Uses existing Inter font, Tailwind CSS v4, Lucide icons, and Shadcn-vue components already in the project.

---

## 2. Design System (from Profound)

### Colors
| Role | Value |
|---|---|
| Page background | `#ffffff` |
| Text primary | `#1e1e1e` |
| Text muted | `#6a7282` |
| Text secondary | `#404040` |
| Border default | `1px solid #e5e7eb` |
| Border dark | `1px solid #2c2c2c` |
| Accent (blue) | `#0c8ce9` |
| Accent light | `#54a2ff` |

### Typography (Inter — already loaded)
| Role | Size | Weight | Line-height |
|---|---|---|---|
| H1 | 72px | 700 | 1.1 |
| H2 | 40px | 700 | 1.2 |
| Section label | 12px | 500 | — |
| Body | 16px | 400 | 1.6 |
| Subtext | 18px | 400 | 1.6 |

### Cards (Profound pattern)
- Background: `#ffffff`
- Border: `1px solid #2c2c2c`
- Border-radius: `10px`
- Padding: `24px`

### Buttons
- Primary: `bg #0c8ce9`, white text, `10px` radius
- Ghost: transparent bg, `1px solid #2c2c2c` border, `10px` radius

### Spacing grid: 4px base. Max-width: `1440px` centered.

### Animations
- `fadeBlurInUp`: `opacity 0→1`, `translateY 12px→0`, `blur 4px→0`, `ease-out 400ms`
- Staggered: each child delayed by 80ms
- `marqueeScroll`: horizontal infinite scroll for mobile testimonials
- All animations respect `prefers-reduced-motion: reduce`

---

## 3. Component Specs

### 3.1 LandingNavbar
**File:** `app/components/landing/LandingNavbar.vue`

- Sticky top, `z-50`, white bg, `border-b border-[#e5e7eb]`
- Height: `64px`, max-width `1440px` centered, `px-6`
- Left: **KeepCabin** — bold, `text-[#1e1e1e]`
- Center: nav links — "Features", "Pricing", "How it works" (hidden on mobile)
- Right: "Sign in" ghost button (dark border) + "Get Started" blue primary button
- Existing theme toggle preserved

---

### 3.2 HeroSection
**File:** `app/components/landing/HeroSection.vue`

- Full-width, `py-32`, centered, white bg
- **Badge pill** — `"v1.0 — Now in Beta"`, `border border-[#2c2c2c]`, `rounded-full`, `px-3 py-1`, `text-xs text-[#404040]`
- **H1** — `"Your receipts,\norganized instantly."` at `text-[72px]` bold, `leading-[1.1]`, `text-[#1e1e1e]`
- **Subtext** — `text-lg text-[#6a7282]` — `"Sync receipt images from Google Drive, extract text with OCR, and track your expenses — all in one place."`
- **CTAs** — row: "Get Started →" (blue primary) + "See how it works" (ghost dark border)
- **Hero visual** — animated receipt scan card:
  - White card (`border border-[#2c2c2c]`, `rounded-[10px]`) with receipt rows (gray placeholder bars)
  - Blue scan-line (`h-[2px] bg-[#0c8ce9]`) that sweeps top→bottom via CSS animation (`2s ease-in-out infinite`)
  - As line passes each row, row transitions from muted gray to dark `#1e1e1e` text (staggered CSS delay)
  - Pure CSS — no images, no JS
- **Animation**: `fadeBlurInUp` staggered: badge (0ms) → H1 (80ms) → subtext (160ms) → CTAs (240ms) → visual (320ms)

---

### 3.3 HowItWorksSection *(new)*
**File:** `app/components/landing/HowItWorksSection.vue`

- `py-24`, white bg
- Section label: `HOW IT WORKS` — `text-xs font-medium tracking-widest text-[#6a7282] uppercase text-center`
- **H2**: `"Up and running in minutes"` — `text-[40px] font-bold text-[#1e1e1e] text-center mt-3`
- **3 steps** in a `grid grid-cols-1 md:grid-cols-3 gap-8 mt-16`:
  1. **Connect your Drive** — `FolderOpen` icon — paste a public Google Drive folder link
  2. **Snap your receipts** — `ScanLine` icon — upload or sync images; OCR runs automatically
  3. **View & export** — `LayoutDashboard` icon — browse structured summaries, copy or download
- Each step:
  - Large step number: `text-[80px] font-bold text-[#e5e7eb] leading-none` (behind icon)
  - `Lucide` icon at `size-6 text-[#0c8ce9]`
  - Bold title `text-[#1e1e1e]`
  - Muted description `text-[#6a7282] text-sm`
- Dashed connector line between steps on desktop: `border-t border-dashed border-[#e5e7eb]` centered between step numbers
- **Animation**: staggered `fadeBlurInUp` left-to-right, 100ms delay per step

---

### 3.4 FeaturesSection
**File:** `app/components/landing/FeaturesSection.vue`

- `py-24`, `bg-[#fafafa]` (slightly off-white to break sections)
- Section label: `FEATURES` — same label style as above
- **H2**: `"Everything you need to manage receipts"`
- **3 cards** in `grid grid-cols-1 md:grid-cols-3 gap-6 mt-12`:
  - Card 1: `FolderSync` icon + "Sync from Drive" + description
  - Card 2: `ScanText` icon + "OCR Extraction" + description
  - Card 3: `Receipt` icon + "Receipt View" + description
- **Card style**: white bg, `border border-[#2c2c2c]`, `rounded-[10px]`, `p-6`
- Icon: `size-5 text-[#0c8ce9]` inside a `size-10 bg-[#f0f7ff] rounded-[8px] flex items-center justify-center`
- Replace all emojis with Lucide icons
- **Animation**: staggered `fadeBlurInUp` on scroll (use `IntersectionObserver`)

---

### 3.5 TestimonialsSection *(new)*
**File:** `app/components/landing/TestimonialsSection.vue`

- `py-24`, white bg
- Section label: `TESTIMONIALS`
- **H2**: `"Trusted by people who hate spreadsheets"`
- **3 cards** in `grid grid-cols-1 md:grid-cols-3 gap-6 mt-12`:
  - Card style: same Profound pattern (`border border-[#2c2c2c]`, `rounded-[10px]`, `p-6`)
  - Each card: quote (italic, `text-[#1e1e1e]`), avatar initials circle (`size-9 bg-[#0c8ce9] text-white rounded-full flex items-center justify-center text-sm font-bold`), name (`font-semibold text-[#1e1e1e]`), role (`text-xs text-[#6a7282]`)
- **Placeholder testimonials:**
  1. *"Finally ditched my folder of receipt photos. KeepCabin pulls everything from Drive and reads it instantly."* — Alex M., Freelance Designer
  2. *"The OCR accuracy is impressive. It caught line items I'd have missed manually."* — Priya S., Small Business Owner
  3. *"Setup took two minutes. I connected my Drive folder and it just worked."* — Jordan K., Consultant
- On mobile: `marqueeScroll` horizontal auto-scroll; on `md+`: static grid
- **Animation**: `fadeBlurInUp` on scroll

---

### 3.6 PricingSection
**File:** `app/components/landing/PricingSection.vue`

- `py-24`, `bg-[#fafafa]`
- Section label: `PRICING`, **H2**: `"Simple pricing"`
- **3 cards** — same grid/card pattern:
  - Free: `border border-[#e5e7eb]`, ghost CTA
  - Pro (highlighted): `border border-[#0c8ce9]`, blue CTA, `"Most popular"` badge pill top-right
  - Business: `border border-[#e5e7eb]`, ghost CTA
- Feature list: `✓` in `text-[#0c8ce9]`, `text-sm`
- Price: `text-[40px] font-bold text-[#1e1e1e]` + `"/mo"` in muted `text-base`

---

### 3.7 FooterSection
**File:** `app/components/landing/FooterSection.vue`

- `border-t border-[#e5e7eb]`, `py-12`, white bg
- Top row: **KeepCabin** bold left, links right — "Features", "Pricing", "Sign in"
- Bottom row: `"© 2026 KeepCabin. All rights reserved."` muted left, theme toggle right
- All text `text-[#6a7282]` except brand name

---

## 4. Implementation Notes

- **`app/pages/index.vue`** — must be updated to add `<LandingHowItWorksSection />` after `<LandingHeroSection />` and `<LandingTestimonialsSection />` after `<LandingFeaturesSection />`. Nuxt auto-registers components from `~/components/landing/` with the `Landing` prefix.
- **No new dependencies** — all animation via vanilla CSS `@keyframes` in `main.css` or scoped `<style>`
- **Lucide icons** — `@lucide/vue` already installed; import named icons per component
- **IntersectionObserver** for scroll animations — use `useIntersectionObserver` from `@vueuse/core` (already in project)
- **Marquee** on mobile testimonials — pure CSS `@keyframes marqueeScroll` with `overflow-x: hidden` wrapper
- **No commits** as per user request

---

## 5. Out of Scope

- Authentication/signup flow
- App pages (`/app/*`)
- Backend or Supabase changes
- Dark mode landing page variant
