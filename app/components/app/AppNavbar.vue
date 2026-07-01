<script setup lang="ts">
const route = useRoute()

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    '/app': 'Dashboard',
    '/app/expenses': 'Expenses',
    '/app/expenses/new': 'Submit Expense',
    '/app/approvals': 'Approvals',
    '/app/payments': 'Payments',
    '/app/team': 'My Team',
    '/app/org': 'Organization',
    '/app/reports': 'Reports',
  }
  return map[route.path] ?? 'KeepCabin'
})
</script>

<template>
  <header class="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center px-6 gap-4">
    <h1 class="text-sm font-semibold text-gray-900">{{ pageTitle }}</h1>
  </header>
</template>
