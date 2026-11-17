<!-- Card container for data tables: optional toolbar (search + filters) on top,
     then the table / loading / empty state, with the table's footer inside. -->
<template>
  <Card class="gap-0 rounded-2xl py-0 shadow-sm dark:bg-muted/60">
    <template v-if="$slots.toolbar">
      <div class="flex flex-wrap items-center gap-2 px-2.5 py-[13px]">
        <slot name="toolbar" />
      </div>
      <Separator />
    </template>
    <slot />
  </Card>
</template>
