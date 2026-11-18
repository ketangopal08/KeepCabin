<!-- Search + filter dropdowns (left) and Group by (right) for the expense tables. -->
<script setup lang="ts">
import type { ExpenseFilters } from '~/composables/useExpenseFilters'
import { EXPENSE_FILTER_OPTIONS as O } from '~/composables/useExpenseFilters'

defineProps<{ filters: ExpenseFilters; searchPlaceholder?: string }>()
const search = defineModel<string>('search', { required: true })
</script>

<template>
  <div class="flex w-full flex-wrap items-center gap-2">
    <AppSearchInput v-model="search" :placeholder="searchPlaceholder ?? 'Search by vendor or category'" class="max-w-xs min-w-52 [&_input]:h-8 [&_input]:text-[13px]" />
    <AppFilterDropdown v-model="filters.category" label="Category" :options="O.category" />
    <AppFilterDropdown v-model="filters.date" label="Date" :options="O.date" />
    <AppFilterDropdown v-model="filters.amount" label="Amount" :options="O.amount" />
    <AppFilterDropdown v-model="filters.sort" label="Sort" :options="O.sort" icon="solar:sort-vertical-linear" />
    <div class="ml-auto">
      <AppFilterDropdown v-model="filters.groupBy" label="Group by" :options="O.groupBy" icon="solar:layers-minimalistic-linear" align="end" />
    </div>
  </div>
</template>
