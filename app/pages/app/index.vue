<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
const { ctx, load } = useOrgContext()
onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold text-gray-900">
      Welcome back{{ ctx?.member ? '' : '…' }}
    </h1>
    <p class="text-sm text-gray-500">
      Role: <span class="font-medium text-gray-700 capitalize">{{ ctx?.member?.role }}</span>
      &nbsp;·&nbsp; Org: <span class="font-medium text-gray-700">{{ ctx?.org?.name }}</span>
    </p>
  </div>
</template>
