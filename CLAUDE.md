# Claude Instructions

## Git & Commits

Do not commit changes directly. Always leave committing to the user.

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
