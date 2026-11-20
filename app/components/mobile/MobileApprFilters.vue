<!-- Mobile search + filters for the Approvals / Payments review lists.
     Same filter state as the web AppExpenseToolbar (useExpenseFilters): category chips inline,
     date / amount / sort / group-by in a bottom sheet. -->
<script setup lang="ts">
import type { ExpenseFilters } from '~/composables/useExpenseFilters'
import { EXPENSE_FILTER_OPTIONS as O } from '~/composables/useExpenseFilters'

const props = defineProps<{ filters: ExpenseFilters; searchPlaceholder?: string }>()
const search = defineModel<string>('search', { required: true })

const open = ref(false)

const sections = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'sort', label: 'Sort' },
  { key: 'groupBy', label: 'Group by' },
] as const

const DEFAULTS: ExpenseFilters = { category: 'all', date: 'all', amount: 'all', sort: 'newest', groupBy: 'none' }

const activeCount = computed(() =>
  (['date', 'amount', 'sort', 'groupBy'] as const).filter(k => props.filters[k] !== DEFAULTS[k]).length,
)


function setFilter(key: keyof ExpenseFilters, value: string) {
  props.filters[key] = value
}

function reset() {
  for (const k of ['date', 'amount', 'sort', 'groupBy'] as const) props.filters[k] = DEFAULTS[k]
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Search + filter button -->
    <div class="relative">
      <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="search"
        type="search"
        :placeholder="searchPlaceholder ?? 'Search by vendor or category'"
        class="h-13 rounded-full pr-14 pl-11 text-base transition-shadow md:text-base focus-visible:shadow-[0_6px_24px_-10px_rgba(0,0,0,0.25)]"
      />
      <Button
        size="icon-lg"
        class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full bg-foreground text-background transition-transform hover:bg-foreground/90 active:scale-90"
        aria-label="Filters"
        @click="open = true"
      >
        <Icon name="solar:filter-linear" class="size-5" />
        <span v-if="activeCount > 0" class="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-foreground" />
      </Button>
    </div>

    <!-- Category chips -->
    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Button
        v-for="o in O.category"
        :key="o.value"
        size="sm"
        :variant="filters.category === o.value ? 'default' : 'secondary'"
        class="m-press h-9 shrink-0 rounded-full px-4 text-[13px]"
        :class="filters.category === o.value ? 'bg-foreground text-background hover:bg-foreground/90' : 'text-muted-foreground'"
        @click="setFilter('category', o.value)"
      >
        {{ o.value === 'all' ? 'All categories' : o.label }}
      </Button>
    </div>

    <!-- Filter sheet -->
    <Sheet v-model:open="open">
      <SheetContent
        side="bottom"
        class="mx-auto max-h-[85dvh] max-w-md gap-0 overflow-y-auto rounded-t-3xl border-0 px-5 pt-3"
        style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
        <SheetHeader class="p-0 text-left">
          <SheetTitle class="text-[17px]">Filters</SheetTitle>
          <SheetDescription>Narrow down and sort the list.</SheetDescription>
        </SheetHeader>

        <div class="mt-4 flex flex-col gap-3">
          <div v-for="s in sections" :key="s.key" class="rounded-3xl border border-border p-4">
            <p class="text-[16px] font-semibold text-foreground">{{ s.label }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button
                v-for="o in O[s.key]"
                :key="o.value"
                size="sm"
                :variant="filters[s.key] === o.value ? 'outline' : 'secondary'"
                class="m-press h-9 rounded-xl px-3.5 text-[13px] font-medium"
                :class="filters[s.key] === o.value ? 'border-2 border-foreground' : ''"
                @click="setFilter(s.key, o.value)"
              >
                {{ o.label }}
              </Button>
            </div>
          </div>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <MobileSubmitButton placement="sheet" @click="open = false">
            Show results
          </MobileSubmitButton>
          <Button variant="ghost" class="m-press h-12 w-full rounded-full text-[15px]" :disabled="activeCount === 0" @click="reset">
            Reset
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
