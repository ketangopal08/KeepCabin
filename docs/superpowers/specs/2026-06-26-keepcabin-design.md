# KeepCabin — Design Spec
**Date:** 2026-06-26  
**Status:** Approved

---

## Overview

KeepCabin is a SaaS web app for individuals to track expenses by syncing receipt images from Google Drive, running OCR on them, and viewing structured receipts in-app.

**Tagline:** "Snap a receipt, get it organized instantly."

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Nuxt 3 |
| UI Components | shadcn-vue |
| Database + Storage | Supabase (Postgres + File Storage) |
| OCR | Tesseract.js (client-side, browser) |
| Google Drive | Drive API v3 (public API key, public folders only) |
| Auth | Supabase Auth (future phase) |

---

## Pages & Routing

| Route | Description |
|---|---|
| `/` | Landing page |
| `/app` | Main app — receipt table + sync buttons + receipt panel |

---

## Project Structure

```
pages/
  index.vue              ← landing page
  app.vue                ← main app shell
components/
  landing/
    HeroSection.vue
    FeaturesSection.vue
    PricingSection.vue
    FooterSection.vue
  app/
    AppSidebar.vue
    SyncButtons.vue
    ReceiptsTable.vue
    ReceiptPanel.vue
server/api/
  sync-drive.post.ts     ← fetch images from Google Drive folder
  import-url.post.ts     ← import single image from direct URL
lib/
  supabase.ts            ← Supabase client singleton
  ocr.ts                 ← Tesseract.js wrapper
```

---

## Landing Page

**Layout (top to bottom):**

1. **Navbar** — KeepCabin logo (left), "Get Started" button (right) → `/app`
2. **Hero** — headline: *"Snap a receipt, get it organized instantly."* Subtitle about Drive sync + OCR. Primary CTA: "Get Started →" → `/app`
3. **Features** — 3 cards: 📁 Sync from Drive, 🔍 OCR Extraction, 🧾 Receipt View
4. **Pricing** — 3 placeholder tiers (no real billing wired):

| | Free | Pro | Business |
|---|---|---|---|
| Price | $0/mo | $9/mo | $29/mo |
| Receipts | 50 | Unlimited | Unlimited |
| Drive Sync | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Team Access | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| CTA | Get Started | Get Started | Contact Us |

All pricing CTAs redirect to `/app` for now. Billing wired in a future phase.

5. **Footer** — © KeepCabin 2026

**Style:** Clean, minimal, dark-friendly. shadcn-vue neutral palette + indigo accent.

---

## App Home Page

**Layout:**

```
┌────────────────────────────────────────────────────┐
│  NAVBAR: KeepCabin logo                            │
├──────────┬─────────────────────────────────────────┤
│ SIDEBAR  │  [Sync] [Import from URL] [+ TBD]       │
│          ├──────────────────────┬──────────────────┤
│ 🏠 Home  │  RECEIPTS TABLE      │  RECEIPT PANEL   │
│ 🧾 Receipts│                    │                  │
│ 📁 Folders│                    │  (empty: "Select  │
│ ⚙️ Settings│                   │   an image")     │
└──────────┴──────────────────────┴──────────────────┘
```

**Sidebar navigation (placeholder items for now):**
- Home — main receipts table (active)
- Receipts — same view, filtered later
- Folders — manage synced Drive folders
- Settings — store Drive folder URL

Sidebar collapses to icon-only on small screens.

**Top action buttons:**
- **Sync** — opens dialog to enter/confirm Google Drive folder URL → triggers sync
- **Import from URL** — opens dialog to paste a direct image URL → imports single image
- **Third button** — TBD (placeholder for now)

---

## Google Drive Sync Flow

1. User clicks **Sync** → shadcn Dialog opens with Drive folder URL input
2. URL saved to localStorage (and later to Settings page in DB)
3. `POST /api/sync-drive` receives the URL
4. Server extracts folder ID from URL, calls Drive API v3 with public API key
5. Drive API returns list of image files in the folder
6. Each image downloaded and uploaded to Supabase Storage
7. Record inserted into `receipts` table
8. Frontend table refreshes

**Import from URL flow:**
1. User clicks **Import from URL** → dialog with direct image URL input
2. `POST /api/import-url` downloads the image → uploads to Supabase Storage → inserts DB record
3. Table refreshes

---

## Database Schema

### `receipts` table

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| filename | text | Original filename |
| drive_file_id | text | Drive file ID (null if imported via URL) |
| storage_url | text | Supabase Storage public URL |
| ocr_text | text | Raw OCR output, null until processed |
| created_at | timestamptz | Auto |

---

## OCR + Receipt Display Flow

1. User clicks a table row
2. If `ocr_text` exists in DB → render immediately (cached)
3. If not → Tesseract.js runs in browser on the `storage_url` image
4. Receipt panel shows loading spinner during processing
5. Raw text parsed into structured fields:
   - Merchant name (first-line heuristic)
   - Date
   - Line items (quantity, description, price)
   - Total
6. Structured receipt rendered in right panel
7. `ocr_text` saved back to Supabase for caching

**Fallback:** if structured parsing fails, display raw extracted text.

**Receipt panel actions:** Copy to clipboard, Download as text.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Drive folder is private | Show error: "Make sure the folder is publicly shared" |
| Drive API quota exceeded | Show error with retry option |
| OCR fails | Show error with retry button in panel |
| Image URL unreachable | Show error in dialog |
| Supabase upload fails | Show toast error, do not insert DB record |

---

## Future Phases (out of scope for this phase)

- Supabase Auth (login / signup)
- Billing (Stripe integration for Pro/Business tiers)
- Folders page — manage multiple Drive folders
- Settings page — persistent Drive URL, preferences
- Third top button (TBD)
- Mobile responsive receipt capture
