<script setup lang="ts">
import { statusMeta, statusText } from '~/utils/expenseStatus'

const props = defineProps<{ status: string; payoutDate?: string | null }>()
const meta = computed(() => statusMeta(props.status))
const text = computed(() => statusText(props.status, props.payoutDate))
</script>

<template>
  <Badge :variant="meta.variant">
    <span class="size-1.5 rounded-full bg-current" />
    {{ text }}
  </Badge>
</template>
