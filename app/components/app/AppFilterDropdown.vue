<!-- Toolbar filter pill: "Label ▾", shows the chosen value when it isn't the default. -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  options: { value: string; label: string }[]
  icon?: string
  align?: 'start' | 'end'
}>(), { align: 'start' })

const model = defineModel<string>({ required: true })

const current = computed(() => props.options.find(o => o.value === model.value))
const active  = computed(() => model.value !== props.options[0]?.value)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal"
        :class="active ? 'bg-muted text-foreground' : 'text-muted-foreground'"
      >
        <Icon v-if="icon" :name="icon" class="size-3.5" />
        {{ label }}
        <span v-if="active" class="font-medium text-foreground">{{ current?.label }}</span>
        <Icon name="solar:alt-arrow-down-linear" class="size-3 opacity-70" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent :align="align" class="w-48">
      <DropdownMenuRadioGroup v-model="model">
        <DropdownMenuRadioItem v-for="o in options" :key="o.value" :value="o.value">
          {{ o.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
