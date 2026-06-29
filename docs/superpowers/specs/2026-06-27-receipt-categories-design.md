# Receipt Categories — Design Spec

**Date:** 2026-06-27
**Project:** KeepCabin

---

## Goal

Add a category system to KeepCabin so receipts are automatically classified after OCR and can be manually organised. Categories appear in the sidebar for filtering, and receipts can be reassigned via drag & drop in both table and grid views.

## Architecture

### Data model

#### New table: `categories`

```sql
create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  color text not null,           -- hex from fixed 8-color palette
  created_at timestamptz default now()
);

alter table categories enable row level security;
create policy "public read"   on categories for select using (true);
create policy "public insert" on categories for insert with check (true);
create policy "public update" on categories for update using (true);
create policy "public delete" on categories for delete using (true);
```

#### Modified table: `receipts`

```sql
alter table receipts
  add column category_id        uuid references categories(id) on delete set null,
  add column category_suggested boolean not null default false;
```

- `category_id` — null means uncategorized
- `category_suggested` — true while a suggestion is pending user confirmation; set to false once the user accepts, changes, or dismisses

### Type updates (`lib/supabase.ts`)

```ts
export type Category = {
  id: string
  name: string
  color: string
  created_at: string
}

export type Receipt = {
  id: string
  filename: string
  drive_file_id: string | null
  storage_url: string
  ocr_text: string | null
  category_id: string | null
  category_suggested: boolean
  created_at: string
}
```

---

## Categorization logic (`lib/categorize.ts`)

Client-side only — no server round-trip.

### Keyword map (default categories)

| Category name   | Keywords (case-insensitive, substring match) |
|-----------------|----------------------------------------------|
| Food & dining   | restaurant, cafe, mcdonald, pizza, food, dining, bakery, sushi, bar, grill, burger, coffee, starbucks |
| Software        | amazon, microsoft, adobe, license, subscription, software, saas, app store, google play |
| Travel          | hotel, flight, airline, uber, taxi, airbnb, travel, airport, booking, lyft |
| Office          | staples, office, printer, supplies, fedex, ups, courier, postage, depot |
| Health          | pharmacy, clinic, hospital, dentist, medical, health, cvs, walgreens |

### Return type

```ts
export type CategorySuggestion =
  | { kind: 'existing'; name: string }   // matched keyword → existing category name
  | { kind: 'new';      name: string }   // no match → propose name (merchant or first OCR line)
  | { kind: 'none' }                     // OCR text too short or empty
```

### `detectCategory(ocrText: string, existingCategories: Category[]): CategorySuggestion`

1. Lowercase the full OCR text.
2. Scan the built-in keyword map. First row whose keywords produce a match wins:
   - If the matched category name already exists in `existingCategories` → return `{ kind: 'existing', name }`.
   - If it does not exist yet → return `{ kind: 'new', name }` (system proposes creating it).
3. If no keyword matches, take the first non-empty line of OCR text as the proposed name. If it is ≥ 3 characters → return `{ kind: 'new', name }`.
4. Otherwise → return `{ kind: 'none' }`.

Keywords live exclusively in `lib/categorize.ts` — they are never stored in the database.

---

## Server API

### `POST /api/categories`

**Body:** `{ name: string; color: string }`
**Returns:** the created `Category` row
**Validation:** name must be 1–50 characters; color must be a valid 6-digit hex (#rrggbb)

### `DELETE /api/categories/[id]`

Deletes the category. Supabase `on delete set null` clears `category_id` on all linked receipts automatically.
**Returns:** 204 No Content

### `PATCH /api/receipts/[id]/category`

**Body:** `{ categoryId: string | null; confirmed: boolean }`

- Sets `category_id` to `categoryId` (null = uncategorized)
- Sets `category_suggested` to `false` when `confirmed: true` (dismissal or acceptance both confirm)
- **Returns:** the updated `Receipt` row

---

## UI flows

### Flow A — Suggest/confirm after OCR (ReceiptPanel + CategoryBanner)

1. `ReceiptPanel.vue` calls `runOcr()` then immediately calls `detectCategory(ocrText, categories)`.
2. The result is passed as a prop to `CategoryBanner.vue`, rendered below the OCR text.
3. Banner states:

   **Existing match:**
   > 📁 Suggested: Food & dining &nbsp; `[✓ Accept]` `[Change ▾]` `[✕]`

   **New category proposed:**
   > 📁 New category: "McDonald's"? &nbsp; `[+ Create]` `[Pick existing ▾]` `[✕]`

   **No suggestion:** banner hidden.

4. **Accept / Create** → `PATCH /api/receipts/[id]/category` with `confirmed: true`. If "Create", first `POST /api/categories`, then patch.
5. **Change ▾** → dropdown of existing categories + "New…" option (opens inline name input).
6. **✕ Dismiss** → `PATCH` with `categoryId: null, confirmed: true` (clears the pending flag, no category assigned).

### Flow B — Manual category creation via sidebar

A small `+` icon appears next to the RECEIPTS section label in `AppSidebar.vue`.
Click → inline text input replaces the icon. Press Enter (or blur) → `POST /api/categories` with a color auto-picked from the palette (next unused color). New category appears immediately in the list.

### Flow C — Drag receipt row → sidebar category (table view)

- Receipt rows in `ReceiptsTable.vue` have `draggable="true"`.
- `dragstart` stores the receipt ID in `event.dataTransfer`.
- Sidebar category `<li>` items are drop targets: `dragover` highlights them, `drop` calls `PATCH /api/receipts/[id]/category`.

### Flow D — Grid view drag between columns

- `app/pages/app.vue` renders `CategoryColumn.vue` per category + one "Uncategorized" column when `viewMode === 'grid'`.
- Each `CategoryColumn` lists receipt cards that belong to it and is itself a drop target.
- Dragging a card and dropping on a different column calls `PATCH /api/receipts/[id]/category`.

---

## Component breakdown

### New files

| File | Responsibility |
|------|----------------|
| `lib/categorize.ts` | `detectCategory()`, keyword map, `CategorySuggestion` type |
| `app/components/app/CategoryBanner.vue` | Suggest/confirm UI strip in ReceiptPanel |
| `app/components/app/CategoryColumn.vue` | Single grid column — drop target + receipt cards |
| `server/api/categories.post.ts` | Create category |
| `server/api/categories/[id].delete.ts` | Delete category |
| `server/api/receipts/[id]/category.patch.ts` | Assign/clear category on a receipt |

### Modified files

| File | Change |
|------|--------|
| `lib/supabase.ts` | Add `Category` type; add `category_id`, `category_suggested` to `Receipt` |
| `lib/supabase.sql` | Add migration SQL for both schema changes |
| `app/components/app/AppSidebar.vue` | RECEIPTS section with category list, `+` button, drop targets, emit `selectCategory` |
| `app/components/app/ReceiptsTable.vue` | Accept `categoryId` prop, filter query; make rows `draggable` |
| `app/components/app/ReceiptPanel.vue` | Call `detectCategory()` post-OCR; render `CategoryBanner` |
| `app/pages/app.vue` | Wire `selectedCategory`; render grid columns when `viewMode === 'grid'` |

---

## Color palette (8 fixed colors)

Used for category dots in the sidebar and column headers in grid view. Auto-assigned in round-robin order when a category is created.

```ts
export const CATEGORY_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f97316', // orange
  '#14b8a6', // teal
]
```

---

## Error handling

- If `POST /api/categories` fails, show an inline error in the sidebar input — do not close the input.
- If `PATCH /api/receipts/[id]/category` fails, show an error toast and revert the UI optimistically applied change.
- Drag & drop failures are silent — the receipt stays in its original position (no optimistic update for drag).

---

## Out of scope

- AI/LLM-based categorization (keyword matching only for Phase 1)
- Category merging or renaming
- Bulk recategorization
- Category-level statistics or spending summaries
- Authentication / per-user categories (Phase 2)
