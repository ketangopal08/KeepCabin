# Claude Instructions

## Git & Commits

Do not commit changes directly. Always leave committing to the user.

## Scope of Changes (STRICT)

Only change exactly what the user asked for. Unwanted changes are not accepted.

- Do not refactor, rename, reformat, or "clean up" code you were not asked to touch.
- Do not change existing behavior, UI, or logic beyond the requested change — even if it looks like an improvement.
- Do not revert or overwrite the user's uncommitted changes unless explicitly told to.
- If a request is ambiguous, ask before editing instead of guessing.
- Only edit the files directly related to the request. Before touching any other file — especially working core pages like `app/pages/login.vue` — stop and ask the user, naming the file and the exact change.
- Never remove or replace an existing component/feature (e.g. a page's own loader) as a side effect of another request. Removing something requires explicit confirmation of what will be removed and from which file.
- If you notice something else worth fixing, mention it — do not change it.
- Temporary/debug code added to help the user (e.g. preview flags) must be removed once the user is done with it.

## UI Components — shadcn-vue (REQUIRED)

Always use shadcn-vue components. Never write raw HTML equivalents when a shadcn component exists.

Available components (all Nuxt auto-imported — no explicit import needed):
- `Button` — use for all buttons. Use `variant` (default, outline, ghost, secondary, destructive, link) and `size` (default, sm, xs, lg, icon, icon-sm, icon-xs, icon-lg)
- `Input` — use for all `<input>` elements
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` — use for all card/panel containers
- `Badge` — use for status chips, role labels, tags. Use `variant` (default, secondary, outline, destructive, ghost)
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `TableFooter`, `TableEmpty` — use for all tabular data
- `Skeleton` — use for loading states instead of custom pulse divs
- `Separator` — use for dividers instead of `<hr>` or border divs
- `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` — `TooltipProvider` lives in `app/layouts/app.vue`
- `Dialog` — use for modals
- `Sheet` — use for slide-over panels

**Styling convention:** Use shadcn CSS variables (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`) instead of hardcoded Tailwind colors wherever possible. This ensures light/dark mode compatibility.

**Never write:**
- Raw `<button>` → use `<Button>`
- Raw `<input>` → use `<Input>`
- Custom div cards with manual `border`, `rounded`, `shadow` → use `<Card>`
- Custom badge spans → use `<Badge>`
- Manual table markup → use `<Table>` family
- Custom `animate-pulse` skeleton divs → use `<Skeleton>`
- `<hr>` or `border-b` dividers → use `<Separator>`

## Mobile UI lives in `/m` — never touch web code (STRICT)

The mobile (PWA) UI is a separate set of routes under `/m`. Doing mobile work must never change web code.

- Mobile pages: `app/pages/m/...` (`definePageMeta({ layout: 'mobile', middleware: 'mobile' })`).
- Mobile components: `app/components/mobile/` (`Mobile*`). Mobile layout: `app/layouts/mobile.vue`.
- Phones / installed PWA are sent from a web route to its mobile version by `app/middleware/mobile-redirect.global.ts` — add one entry to `MOBILE_ROUTES` per new mobile screen.
- Do NOT edit, split, move or refactor any web file (`app/pages/app/**`, `app/layouts/app.vue`, `app/components/app/**`, etc.) as part of a mobile change. No "one route, two components" switching inside web pages.
- If a mobile screen needs page logic, copy it into a composable (e.g. `app/composables/useNewExpense.ts`) — the web page keeps its own code unchanged.
- Mobile links may point to `/app/*` web pages until that screen has a mobile version.
- A change to web code requires the user to ask for that specific web change explicitly.

## Intro Video Project (outside this repo)

The KeepCabin intro video lives in a separate folder: `/Users/ketangopalspectro/repos/ketan/KeepCabin-video` (sibling of this repo — not part of the Nuxt app).

- **Remotion (main, React)** — root of that folder. Composition `KeepCabinIntro` in `src/` (16:9, 1920x1080, 30fps, ~30s).
  - `npm run dev` → Remotion Studio preview
  - `npm run render` → `out/keepcabin-intro.mp4`
- **HyperFrames (HTML-based, secondary)** — `hyperframes/` subfolder (has its own `CLAUDE.md`).
  - `npm run hf:dev` → preview, `npm run hf:render` → render
- Do not install Remotion/React/HyperFrames into this Nuxt repo. Branding (colors, logo, fonts) can be referenced from this repo but video code goes in `KeepCabin-video`.
