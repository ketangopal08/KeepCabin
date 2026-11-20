<script setup lang="ts">
// Big pill primary action at the bottom of a form.
// - placement="page": fixed to the bottom of the screen (pair with `hideTabBar: true` page meta)
// - placement="sheet": sticks to the bottom of a Sheet's scroll area
withDefaults(defineProps<{
  placement?: 'page' | 'sheet'
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'destructive'
  type?: 'button' | 'submit'
}>(), { placement: 'sheet', variant: 'default', type: 'button' })

defineEmits<{ click: [e: MouseEvent] }>()
</script>

<template>
  <div
    :class="placement === 'page'
      ? 'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md bg-gradient-to-t from-background via-background to-background/0 px-4 pt-6'
      : 'sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-background via-background to-background/0 px-1 pt-5'"
    :style="placement === 'page' ? 'padding-bottom: max(env(safe-area-inset-bottom), 1rem)' : 'padding-bottom: 0.25rem'"
  >
    <Button
      :type="type"
      :disabled="disabled || loading"
      class="m-press h-14 w-full rounded-full text-[15px] font-semibold shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]"
      :class="variant === 'destructive'
        ? 'bg-red-600 text-white hover:bg-red-600/90'
        : 'bg-foreground text-background hover:bg-foreground/90'"
      @click="$emit('click', $event)"
    >
      <Icon v-if="loading" name="solar:refresh-linear" class="size-4 animate-spin" />
      <slot />
    </Button>
  </div>
</template>
