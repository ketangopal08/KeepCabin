<script setup lang="ts">
// Form field tile: small label on top, value/input below, optional leading icon and
// trailing chevron (for pickers). Put an `<Input class="m-field-input">` (or any value)
// in the default slot. Rendered as <label> so tapping anywhere focuses the input.
withDefaults(defineProps<{
  label: string
  icon?: string
  chevron?: boolean
  disabled?: boolean
  /** id of the input inside, for the label's `for` */
  inputId?: string
  /** 'label' (default) for inputs; 'div' / 'span' when the tile wraps a button or menu trigger */
  as?: 'label' | 'div' | 'span'
}>(), { as: 'label' })
</script>

<template>
  <component
    :is="as"
    :for="as === 'label' ? inputId : undefined"
    class="m-field flex min-h-[60px] w-full flex-col justify-center rounded-2xl bg-muted/60 px-4 py-2 text-left transition-[background-color,box-shadow] focus-within:bg-muted focus-within:ring-2 focus-within:ring-foreground/10"
    :class="disabled ? 'opacity-60' : ''"
  >
    <span class="text-[12px] leading-4 text-muted-foreground">{{ label }}</span>
    <span class="mt-1 flex min-w-0 items-center gap-2.5">
      <Icon v-if="icon" :name="icon" class="size-[18px] shrink-0 text-foreground/80" />
      <span class="min-w-0 flex-1 text-[15px] font-medium text-foreground">
        <slot />
      </span>
      <slot name="trailing" />
      <Icon v-if="chevron" name="solar:alt-arrow-down-linear" class="size-4 shrink-0 text-muted-foreground" />
    </span>
  </component>
</template>
