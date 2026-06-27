# KeepCabin Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 5 existing landing components and add 2 new ones using the Profound design system aesthetic, without touching any app or backend code.

**Architecture:** Self-contained Vue SFCs per section, sharing a set of CSS keyframe animations added to `main.css`. New sections (HowItWorks, Testimonials) are created as new files. Scroll-triggered reveal uses `useIntersectionObserver` from VueUse. No new npm packages.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Tailwind CSS v4 (arbitrary values), `@lucide/vue`, `@vueuse/core`, Inter font (already loaded via Google Fonts in `nuxt.config.ts`)

## Global Constraints

- No git commits (user request)
- No new npm dependencies
- Light theme only (`#ffffff` background) — do not alter the dark-mode CSS variables in `main.css`
- All landing components live in `app/components/landing/` — Nuxt auto-registers them as `<LandingXxx />`
- Use inline Tailwind arbitrary values for Profound tokens; do NOT modify shadcn CSS variables
- Tailwind v4 — no `tailwind.config.js` modifications needed
- All animations must include a `prefers-reduced-motion: reduce` reset
- Max content width: `1440px`, horizontal padding `px-6` on all sections
- Replace all emoji icons with `@lucide/vue` named components

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/assets/css/main.css` | Modify — append | Keyframe definitions: `fadeBlurInUp`, `marqueeScroll`, `scanLine`, `revealText`; utility classes |
| `app/components/landing/LandingNavbar.vue` | Replace | Sticky nav: logo, center links, ghost + blue CTAs, theme toggle |
| `app/components/landing/HeroSection.vue` | Replace | Badge pill, 72px H1, subtext, dual CTAs, animated OCR scan card |
| `app/components/landing/HowItWorksSection.vue` | Create | 3-step numbered walkthrough with icons and dashed connector |
| `app/components/landing/FeaturesSection.vue` | Replace | 3 Profound-pattern cards with Lucide icons |
| `app/components/landing/TestimonialsSection.vue` | Create | 3 testimonial cards; marquee on mobile, grid on desktop |
| `app/components/landing/PricingSection.vue` | Replace | 3-tier pricing cards; Pro highlighted with blue border and badge |
| `app/components/landing/FooterSection.vue` | Replace | Brand + tagline, nav links, copyright row |
| `app/pages/index.vue` | Modify | Add `<LandingHowItWorksSection />` and `<LandingTestimonialsSection />` in correct order |

---

### Task 1: CSS Animation Keyframes

**Files:**
- Modify: `app/assets/css/main.css`

**Interfaces:**
- Produces: `.animate-fade-blur-in-up`, `.animate-marquee`, `.scan-line`, `.receipt-text` — used by all subsequent components

- [ ] **Step 1: Append animation CSS to main.css**

Add to the **end** of `app/assets/css/main.css` (do not alter anything above):

```css
/* ─── Landing page animations (Profound design system) ─────────────────── */

@keyframes fadeBlurInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes marqueeScroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

@keyframes scanLine {
  0%   { top: 0;                   opacity: 1; }
  80%  { top: calc(100% - 2px);    opacity: 1; }
  90%  { top: calc(100% - 2px);    opacity: 0; }
  100% { top: 0;                   opacity: 0; }
}

@keyframes revealText {
  from { color: transparent; background-color: #e5e7eb; border-radius: 3px; }
  to   { color: inherit;     background-color: transparent; border-radius: 0; }
}

.animate-fade-blur-in-up {
  animation: fadeBlurInUp 0.4s ease-out forwards;
  opacity: 0;
}

.animate-marquee {
  animation: marqueeScroll 20s linear infinite;
}

.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #0c8ce9;
  animation: scanLine 2.5s ease-in-out infinite;
}

.receipt-text {
  animation: revealText 0.3s ease-out forwards;
  color: transparent;
  background-color: #e5e7eb;
  border-radius: 3px;
  display: inline-block;
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-blur-in-up {
    animation: none;
    opacity: 1;
    transform: none;
    filter: none;
  }
  .animate-marquee {
    animation: none;
  }
  .scan-line {
    display: none;
  }
  .receipt-text {
    animation: none;
    color: inherit;
    background-color: transparent;
    border-radius: 0;
  }
}
```

- [ ] **Step 2: Start dev server and verify no errors**

Run: `npm run dev`

Expected: Server starts at `http://localhost:3000` with no CSS compilation errors in the terminal.

- [ ] **Step 3: Confirm landing page still loads**

Open `http://localhost:3000`. Expected: existing landing renders without errors (animations not yet applied to components).

---

### Task 2: Navbar Redesign

**Files:**
- Modify: `app/components/landing/LandingNavbar.vue`

**Interfaces:**
- Consumes: `useTheme()` composable (already in project), `Sun` and `Moon` from `@lucide/vue`
- Produces: `<LandingNavbar />` — sticky white nav with center links and Profound-styled buttons

- [ ] **Step 1: Replace LandingNavbar.vue**

Overwrite `app/components/landing/LandingNavbar.vue` entirely:

```vue
<script setup lang="ts">
import { Sun, Moon } from '@lucide/vue'
const { isDark, toggle } = useTheme()
</script>

<template>
  <nav class="sticky top-0 z-50 bg-white border-b border-[#e5e7eb]">
    <div class="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">

      <span class="text-xl font-bold text-[#1e1e1e] tracking-tight">KeepCabin</span>

      <div class="hidden md:flex items-center gap-8">
        <a href="#how-it-works" class="text-sm text-[#6a7282] hover:text-[#1e1e1e] transition-colors duration-150">
          How it works
        </a>
        <a href="#features" class="text-sm text-[#6a7282] hover:text-[#1e1e1e] transition-colors duration-150">
          Features
        </a>
        <a href="#pricing" class="text-sm text-[#6a7282] hover:text-[#1e1e1e] transition-colors duration-150">
          Pricing
        </a>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="size-9 flex items-center justify-center rounded-[10px] border border-[#2c2c2c] text-[#404040] hover:bg-[#fafafa] transition-colors duration-150"
          aria-label="Toggle theme"
          @click="toggle"
        >
          <Sun v-if="isDark" class="size-4" />
          <Moon v-else class="size-4" />
        </button>

        <button class="px-4 py-2 text-sm rounded-[10px] border border-[#2c2c2c] text-[#1e1e1e] hover:bg-[#fafafa] transition-colors duration-150">
          Sign in
        </button>

        <NuxtLink to="/app">
          <button class="px-4 py-2 text-sm rounded-[10px] bg-[#0c8ce9] text-white font-medium hover:opacity-90 transition-opacity duration-150">
            Get Started
          </button>
        </NuxtLink>
      </div>

    </div>
  </nav>
</template>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000`. Expected:
- White sticky navbar with `#e5e7eb` bottom border
- "KeepCabin" bold dark text on the left
- "How it works / Features / Pricing" text links centered (hidden below `md` breakpoint)
- Theme toggle (dark border, square-rounded), "Sign in" ghost button, blue "Get Started" button on right

---

### Task 3: Hero Section Redesign

**Files:**
- Modify: `app/components/landing/HeroSection.vue`

**Interfaces:**
- Consumes: `.animate-fade-blur-in-up`, `.scan-line`, `.receipt-text` from `main.css`
- Produces: `<LandingHeroSection />` — badge → H1 → subtext → CTAs → OCR scan card, all staggered

- [ ] **Step 1: Replace HeroSection.vue**

Overwrite `app/components/landing/HeroSection.vue` entirely:

```vue
<template>
  <section class="py-32 px-6 bg-white text-center overflow-hidden">
    <div class="max-w-[1440px] mx-auto">

      <div class="max-w-3xl mx-auto flex flex-col items-center gap-6">

        <!-- Badge -->
        <div
          class="inline-flex items-center px-3 py-1 rounded-full border border-[#2c2c2c] text-xs text-[#404040] animate-fade-blur-in-up"
          style="animation-delay: 0ms"
        >
          v1.0 — Now in Beta
        </div>

        <!-- H1 -->
        <h1
          class="text-[52px] md:text-[72px] font-bold leading-[1.1] text-[#1e1e1e] animate-fade-blur-in-up"
          style="animation-delay: 80ms"
        >
          Your receipts,<br />organized instantly.
        </h1>

        <!-- Subtext -->
        <p
          class="text-lg text-[#6a7282] max-w-xl animate-fade-blur-in-up"
          style="animation-delay: 160ms"
        >
          Sync receipt images from Google Drive, extract text with OCR,
          and track your expenses — all in one place.
        </p>

        <!-- CTAs -->
        <div
          class="flex flex-wrap items-center justify-center gap-3 animate-fade-blur-in-up"
          style="animation-delay: 240ms"
        >
          <NuxtLink to="/app">
            <button class="px-5 py-2.5 rounded-[10px] bg-[#0c8ce9] text-white text-sm font-medium hover:opacity-90 transition-opacity duration-150">
              Get Started →
            </button>
          </NuxtLink>
          <a href="#how-it-works">
            <button class="px-5 py-2.5 rounded-[10px] border border-[#2c2c2c] text-[#1e1e1e] text-sm font-medium hover:bg-[#fafafa] transition-colors duration-150">
              See how it works
            </button>
          </a>
        </div>

      </div>

      <!-- Hero visual: animated OCR scan card -->
      <div
        class="mt-16 flex justify-center animate-fade-blur-in-up"
        style="animation-delay: 320ms"
      >
        <div class="relative w-72 md:w-80 border border-[#2c2c2c] rounded-[10px] bg-white overflow-hidden px-6 py-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_#2b2b2f]">

          <!-- Animated scan line -->
          <div class="scan-line" />

          <!-- Receipt header -->
          <div class="mb-4 pb-3 border-b border-[#e5e7eb]">
            <p class="receipt-text text-[11px] text-[#6a7282] uppercase tracking-widest" style="animation-delay: 0.4s">
              Receipt
            </p>
            <p class="receipt-text text-sm font-semibold text-[#1e1e1e] mt-0.5" style="animation-delay: 0.6s">
              Starbucks Coffee
            </p>
            <p class="receipt-text text-xs text-[#6a7282]" style="animation-delay: 0.8s">
              Jun 25, 2026
            </p>
          </div>

          <!-- Line items -->
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-xs">
              <span class="receipt-text text-[#404040]" style="animation-delay: 1.0s">Caramel Macchiato</span>
              <span class="receipt-text font-medium text-[#1e1e1e]" style="animation-delay: 1.0s">$5.95</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="receipt-text text-[#404040]" style="animation-delay: 1.2s">Butter Croissant</span>
              <span class="receipt-text font-medium text-[#1e1e1e]" style="animation-delay: 1.2s">$3.25</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="receipt-text text-[#404040]" style="animation-delay: 1.4s">Tax</span>
              <span class="receipt-text font-medium text-[#1e1e1e]" style="animation-delay: 1.4s">$0.74</span>
            </div>
          </div>

          <!-- Total -->
          <div class="pt-3 border-t border-[#e5e7eb] flex justify-between">
            <span class="receipt-text text-sm font-bold text-[#1e1e1e]" style="animation-delay: 1.6s">Total</span>
            <span class="receipt-text text-sm font-bold text-[#0c8ce9]" style="animation-delay: 1.6s">$9.94</span>
          </div>

        </div>
      </div>

    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000`. Expected:
- Badge, H1 (72px on desktop, 52px mobile), muted subtext, and dual CTAs fade+blur in with stagger
- Receipt scan card appears below with a blue line sweeping top→bottom on a loop
- Each receipt row transitions from a gray bar to readable text as the scan line passes
- With `prefers-reduced-motion`: all content immediately visible, scan line hidden

---

### Task 4: How It Works Section

**Files:**
- Create: `app/components/landing/HowItWorksSection.vue`
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `FolderOpen`, `Scan`, `LayoutDashboard` from `@lucide/vue`; `useIntersectionObserver` from `@vueuse/core`; `.animate-fade-blur-in-up` from `main.css`
- Produces: `<LandingHowItWorksSection />` — 3-step numbered walkthrough with scroll reveal

- [ ] **Step 1: Create HowItWorksSection.vue**

Create `app/components/landing/HowItWorksSection.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { FolderOpen, Scan, LayoutDashboard } from '@lucide/vue'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

const { stop } = useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
      stop()
    }
  },
  { threshold: 0.15 },
)

const steps = [
  {
    number: '01',
    icon: FolderOpen,
    title: 'Connect your Drive',
    description: 'Paste a public Google Drive folder link. KeepCabin syncs all receipt images instantly — no manual upload required.',
  },
  {
    number: '02',
    icon: Scan,
    title: 'Snap your receipts',
    description: 'OCR runs automatically on every image. Merchant names, dates, line items, and totals are extracted in seconds.',
  },
  {
    number: '03',
    icon: LayoutDashboard,
    title: 'View & export',
    description: 'Browse clean, structured receipt summaries. Copy data or download at any time directly from your dashboard.',
  },
]
</script>

<template>
  <section id="how-it-works" ref="sectionEl" class="py-24 px-6 bg-white">
    <div class="max-w-[1440px] mx-auto">

      <div class="text-center">
        <p class="text-xs font-medium tracking-widest text-[#6a7282] uppercase">How it works</p>
        <h2 class="mt-3 text-[36px] md:text-[40px] font-bold leading-[1.2] text-[#1e1e1e]">
          Up and running in minutes
        </h2>
      </div>

      <div class="relative mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">

        <!-- Dashed connector line (desktop only) — runs between icons at ~top-6 of the grid -->
        <div class="hidden md:block absolute top-6 left-[calc(33.33%+1.5rem)] right-[calc(33.33%+1.5rem)] border-t border-dashed border-[#e5e7eb]" />

        <div
          v-for="(step, i) in steps"
          :key="step.number"
          class="flex flex-col items-center md:items-start text-center md:text-left"
          :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <!-- Step number backdrop + icon -->
          <div class="relative mb-5 flex items-center justify-center">
            <span class="absolute text-[80px] font-bold text-[#f0f0f0] leading-none select-none">
              {{ step.number }}
            </span>
            <div class="relative z-10 size-12 bg-[#f0f7ff] rounded-[8px] flex items-center justify-center">
              <component :is="step.icon" class="size-6 text-[#0c8ce9]" />
            </div>
          </div>

          <h3 class="text-base font-semibold text-[#1e1e1e]">{{ step.title }}</h3>
          <p class="mt-2 text-sm text-[#6a7282] leading-relaxed max-w-xs">{{ step.description }}</p>
        </div>

      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Add HowItWorksSection to index.vue**

Open `app/pages/index.vue`. Replace its entire contents with:

```vue
<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-white text-[#1e1e1e]">
    <LandingNavbar />
    <LandingHeroSection />
    <LandingHowItWorksSection />
    <LandingFeaturesSection />
    <LandingPricingSection />
    <LandingFooterSection />
  </div>
</template>
```

(TestimonialsSection will slot in after FeaturesSection in Task 6.)

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000` and scroll past the hero. Expected:
- "HOW IT WORKS" label + "Up and running in minutes" H2 centered
- 3 steps in a row on desktop, stacked on mobile
- Large faded numbers (01, 02, 03) behind blue icon squares
- Dashed horizontal line connecting the icon area across the middle step gap on desktop
- Steps fade+blur up with 100ms stagger on scroll into view

---

### Task 5: Features Section Redesign

**Files:**
- Modify: `app/components/landing/FeaturesSection.vue`

**Interfaces:**
- Consumes: `FolderSync`, `ScanText`, `FileText` from `@lucide/vue`; `useIntersectionObserver` from `@vueuse/core`
- Produces: `<LandingFeaturesSection />` — 3 Profound-pattern cards with scroll reveal

- [ ] **Step 1: Replace FeaturesSection.vue**

Overwrite `app/components/landing/FeaturesSection.vue` entirely:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { FolderSync, ScanText, FileText } from '@lucide/vue'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

const { stop } = useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
      stop()
    }
  },
  { threshold: 0.15 },
)

const features = [
  {
    icon: FolderSync,
    title: 'Sync from Drive',
    description: 'Connect any public Google Drive folder and pull all receipt images into KeepCabin instantly.',
  },
  {
    icon: ScanText,
    title: 'OCR Extraction',
    description: 'Tesseract-powered text recognition reads merchant names, dates, line items, and totals.',
  },
  {
    icon: FileText,
    title: 'Receipt View',
    description: 'Every receipt is displayed as a clean, structured summary — ready to copy or download.',
  },
]
</script>

<template>
  <section id="features" ref="sectionEl" class="py-24 px-6 bg-[#fafafa]">
    <div class="max-w-[1440px] mx-auto">

      <div class="text-center">
        <p class="text-xs font-medium tracking-widest text-[#6a7282] uppercase">Features</p>
        <h2 class="mt-3 text-[36px] md:text-[40px] font-bold leading-[1.2] text-[#1e1e1e]">
          Everything you need to manage receipts
        </h2>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="(feature, i) in features"
          :key="feature.title"
          class="bg-white border border-[#2c2c2c] rounded-[10px] p-6"
          :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <div class="size-10 bg-[#f0f7ff] rounded-[8px] flex items-center justify-center mb-4">
            <component :is="feature.icon" class="size-5 text-[#0c8ce9]" />
          </div>
          <h3 class="text-base font-semibold text-[#1e1e1e]">{{ feature.title }}</h3>
          <p class="mt-2 text-sm text-[#6a7282] leading-relaxed">{{ feature.description }}</p>
        </div>
      </div>

    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify in browser**

Scroll to Features section. Expected:
- Off-white `#fafafa` background to visually separate from How it Works
- "FEATURES" label + "Everything you need to manage receipts" H2 centered
- 3 white cards with dark `1px solid #2c2c2c` borders and `10px` radius
- Each card: blue icon in a `#f0f7ff` square, bold title, muted description
- Cards animate in with stagger on scroll

---

### Task 6: Testimonials Section

**Files:**
- Create: `app/components/landing/TestimonialsSection.vue`
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `useIntersectionObserver` from `@vueuse/core`; `.animate-fade-blur-in-up`, `.animate-marquee` from `main.css`
- Produces: `<LandingTestimonialsSection />` — 3-card grid on desktop, marquee on mobile

- [ ] **Step 1: Create TestimonialsSection.vue**

Create `app/components/landing/TestimonialsSection.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

const { stop } = useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
      stop()
    }
  },
  { threshold: 0.15 },
)

const testimonials = [
  {
    quote: 'Finally ditched my folder of receipt photos. KeepCabin pulls everything from Drive and reads it instantly.',
    initials: 'AM',
    name: 'Alex M.',
    role: 'Freelance Designer',
  },
  {
    quote: "The OCR accuracy is impressive. It caught line items I'd have missed manually.",
    initials: 'PS',
    name: 'Priya S.',
    role: 'Small Business Owner',
  },
  {
    quote: 'Setup took two minutes. I connected my Drive folder and it just worked.',
    initials: 'JK',
    name: 'Jordan K.',
    role: 'Consultant',
  },
]
</script>

<template>
  <section ref="sectionEl" class="py-24 px-6 bg-white">
    <div class="max-w-[1440px] mx-auto">

      <div class="text-center">
        <p class="text-xs font-medium tracking-widest text-[#6a7282] uppercase">Testimonials</p>
        <h2 class="mt-3 text-[36px] md:text-[40px] font-bold leading-[1.2] text-[#1e1e1e]">
          Trusted by people who hate spreadsheets
        </h2>
      </div>

      <!-- Desktop: static 3-column grid -->
      <div class="hidden md:grid mt-12 grid-cols-3 gap-6">
        <div
          v-for="(t, i) in testimonials"
          :key="t.name"
          class="bg-white border border-[#2c2c2c] rounded-[10px] p-6 flex flex-col gap-4"
          :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <p class="text-sm text-[#1e1e1e] leading-relaxed italic flex-1">"{{ t.quote }}"</p>
          <div class="flex items-center gap-3">
            <div class="size-9 rounded-full bg-[#0c8ce9] text-white flex items-center justify-center text-sm font-bold shrink-0">
              {{ t.initials }}
            </div>
            <div>
              <p class="text-sm font-semibold text-[#1e1e1e]">{{ t.name }}</p>
              <p class="text-xs text-[#6a7282]">{{ t.role }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile: marquee scroll -->
      <div class="md:hidden mt-12 overflow-hidden">
        <div class="flex gap-4 animate-marquee" style="width: max-content">
          <!-- Duplicated for seamless loop -->
          <div
            v-for="(t, i) in [...testimonials, ...testimonials]"
            :key="`${t.name}-${i}`"
            class="w-72 shrink-0 bg-white border border-[#2c2c2c] rounded-[10px] p-6 flex flex-col gap-4"
          >
            <p class="text-sm text-[#1e1e1e] leading-relaxed italic flex-1">"{{ t.quote }}"</p>
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-full bg-[#0c8ce9] text-white flex items-center justify-center text-sm font-bold shrink-0">
                {{ t.initials }}
              </div>
              <div>
                <p class="text-sm font-semibold text-[#1e1e1e]">{{ t.name }}</p>
                <p class="text-xs text-[#6a7282]">{{ t.role }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>
```

- [ ] **Step 2: Insert TestimonialsSection into index.vue**

Replace the entire contents of `app/pages/index.vue` with the final page order:

```vue
<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-white text-[#1e1e1e]">
    <LandingNavbar />
    <LandingHeroSection />
    <LandingHowItWorksSection />
    <LandingFeaturesSection />
    <LandingTestimonialsSection />
    <LandingPricingSection />
    <LandingFooterSection />
  </div>
</template>
```

- [ ] **Step 3: Verify in browser**

Scroll to Testimonials section. Expected:
- White background, "TESTIMONIALS" label + H2 centered
- 3 cards (desktop): dark-border Profound cards, italic quote, blue avatar circle with initials, name + role
- Mobile (< 768px): all 3 cards scroll horizontally in a continuous loop
- `prefers-reduced-motion`: marquee stops; cards immediately visible on desktop

---

### Task 7: Pricing Section Redesign

**Files:**
- Modify: `app/components/landing/PricingSection.vue`

**Interfaces:**
- Consumes: `useIntersectionObserver` from `@vueuse/core`
- Produces: `<LandingPricingSection />` — 3-tier cards; Pro highlighted with blue border and "Most popular" badge

- [ ] **Step 1: Replace PricingSection.vue**

Overwrite `app/components/landing/PricingSection.vue` entirely:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

const { stop } = useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
      stop()
    }
  },
  { threshold: 0.15 },
)

const tiers = [
  {
    name: 'Free',
    price: '$0',
    features: ['50 receipts/month', 'Google Drive sync', 'OCR extraction'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9',
    features: ['Unlimited receipts', 'Google Drive sync', 'Priority support'],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$29',
    features: ['Unlimited receipts', 'Team access', 'API access'],
    cta: 'Contact Us',
    highlighted: false,
  },
]
</script>

<template>
  <section id="pricing" ref="sectionEl" class="py-24 px-6 bg-[#fafafa]">
    <div class="max-w-[1440px] mx-auto">

      <div class="text-center">
        <p class="text-xs font-medium tracking-widest text-[#6a7282] uppercase">Pricing</p>
        <h2 class="mt-3 text-[36px] md:text-[40px] font-bold leading-[1.2] text-[#1e1e1e]">
          Simple pricing
        </h2>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div
          v-for="(tier, i) in tiers"
          :key="tier.name"
          class="relative bg-white rounded-[10px] p-6 flex flex-col gap-6"
          :class="[
            tier.highlighted
              ? 'border border-[#0c8ce9] shadow-[0_0_0_1px_#0c8ce9]'
              : 'border border-[#e5e7eb]',
            revealed ? 'animate-fade-blur-in-up' : 'opacity-0',
          ]"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <!-- Most popular badge -->
          <div
            v-if="tier.highlighted"
            class="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-0.5 rounded-full bg-[#0c8ce9] text-white text-[11px] font-medium whitespace-nowrap"
          >
            Most popular
          </div>

          <!-- Header -->
          <div>
            <p class="text-sm font-medium text-[#404040]">{{ tier.name }}</p>
            <div class="flex items-baseline gap-1 mt-2">
              <span class="text-[40px] font-bold leading-none text-[#1e1e1e]">{{ tier.price }}</span>
              <span class="text-sm text-[#6a7282]">/mo</span>
            </div>
          </div>

          <!-- Features -->
          <ul class="space-y-3 flex-1">
            <li
              v-for="feat in tier.features"
              :key="feat"
              class="flex items-center gap-2 text-sm text-[#404040]"
            >
              <span class="text-[#0c8ce9] font-bold">✓</span>
              {{ feat }}
            </li>
          </ul>

          <!-- CTA -->
          <NuxtLink to="/app" class="block">
            <button
              class="w-full py-2.5 rounded-[10px] text-sm font-medium transition-opacity duration-150 hover:opacity-90"
              :class="tier.highlighted
                ? 'bg-[#0c8ce9] text-white'
                : 'border border-[#2c2c2c] text-[#1e1e1e] bg-white hover:bg-[#fafafa]'"
            >
              {{ tier.cta }}
            </button>
          </NuxtLink>

        </div>
      </div>

    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify in browser**

Scroll to Pricing section. Expected:
- `#fafafa` background
- "PRICING" label + "Simple pricing" H2
- Free card: light `#e5e7eb` border, ghost CTA
- Pro card: blue `#0c8ce9` border with double-border shadow, "Most popular" badge above, blue CTA
- Business card: light `#e5e7eb` border, ghost CTA
- Prices at 40px bold, `/mo` muted
- Staggered animate-in on scroll

---

### Task 8: Footer Redesign

**Files:**
- Modify: `app/components/landing/FooterSection.vue`

**Interfaces:**
- Produces: `<LandingFooterSection />` — brand + tagline, nav links, copyright row

- [ ] **Step 1: Replace FooterSection.vue**

Overwrite `app/components/landing/FooterSection.vue` entirely:

```vue
<template>
  <footer class="border-t border-[#e5e7eb] bg-white">
    <div class="max-w-[1440px] mx-auto px-6 py-12">

      <!-- Top row -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p class="text-base font-bold text-[#1e1e1e]">KeepCabin</p>
          <p class="mt-1 text-sm text-[#6a7282]">Receipt tracking, without the chaos.</p>
        </div>
        <nav class="flex items-center gap-6">
          <a href="#features" class="text-sm text-[#6a7282] hover:text-[#1e1e1e] transition-colors duration-150">
            Features
          </a>
          <a href="#pricing" class="text-sm text-[#6a7282] hover:text-[#1e1e1e] transition-colors duration-150">
            Pricing
          </a>
          <NuxtLink to="/app" class="text-sm text-[#6a7282] hover:text-[#1e1e1e] transition-colors duration-150">
            Sign in
          </NuxtLink>
        </nav>
      </div>

      <!-- Bottom row -->
      <div class="mt-8 pt-6 border-t border-[#f0f0f0]">
        <p class="text-xs text-[#6a7282]">© 2026 KeepCabin. All rights reserved.</p>
      </div>

    </div>
  </footer>
</template>
```

- [ ] **Step 2: Verify in browser**

Scroll to the bottom of `http://localhost:3000`. Expected:
- White footer with `#e5e7eb` top border
- "KeepCabin" bold + tagline on left, "Features / Pricing / Sign in" links on right
- Inner bottom row with copyright in muted text
- Stacks vertically on mobile

---

### Task 9: Final Full-Page Verification

**Files:**
- Read: `app/pages/index.vue` (confirm final state)

- [ ] **Step 1: Confirm index.vue contains all 7 sections in order**

Read `app/pages/index.vue`. It must match exactly:

```vue
<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-white text-[#1e1e1e]">
    <LandingNavbar />
    <LandingHeroSection />
    <LandingHowItWorksSection />
    <LandingFeaturesSection />
    <LandingTestimonialsSection />
    <LandingPricingSection />
    <LandingFooterSection />
  </div>
</template>
```

If any component is missing, add it now.

- [ ] **Step 2: Full-page walkthrough at desktop width**

With `npm run dev` running, open `http://localhost:3000`. Scroll top to bottom and verify:

| Section | What to check |
|---|---|
| Navbar | Sticky white, dark border-bottom, 3 centered links, ghost + blue CTAs |
| Hero | Badge → 72px H1 → subtext → CTAs staggered; receipt card with blue scan line |
| How it works | "HOW IT WORKS" label, 3 numbered steps, dashed connector on desktop |
| Features | `#fafafa` bg, 3 dark-border cards with blue icon squares |
| Testimonials | White bg, 3 dark-border cards, blue avatar circles with initials |
| Pricing | `#fafafa` bg, Pro card with blue border + "Most popular" badge above |
| Footer | Brand + tagline left, links right, copyright below divider |

- [ ] **Step 3: Verify mobile at 375px**

In browser DevTools, set viewport to 375px. Expected:
- Navbar: logo + right buttons only (center links hidden)
- Hero: H1 at 52px, CTAs wrap if needed
- How it works: 3 steps stacked vertically, no dashed connector
- Features: 1-column card stack
- Testimonials: continuous horizontal marquee
- Pricing: 1-column card stack, Pro badge still visible
- Footer: stacks vertically

- [ ] **Step 4: Verify prefers-reduced-motion**

In Chrome DevTools → Rendering tab → "Emulate CSS media feature prefers-reduced-motion" → set to `reduce`.

Expected:
- All content is immediately visible (no opacity-0 initial state)
- No scan line visible in the hero card
- No marquee movement in testimonials
- Testimonial cards on mobile display as a static stack instead of scrolling
