<script setup lang="ts">
import { Check, Plus, ChevronDown, X } from '@lucide/vue'
import type { Category } from '~~/lib/supabase'
import type { CategorySuggestion } from '~~/lib/categorize'

const props = defineProps<{
  suggestion:  CategorySuggestion | null
  categories:  Category[]
  receiptId:   string
}>()

const emit = defineEmits<{
  assign:  [receiptId: string, categoryId: string]
  create:  [receiptId: string, name: string]
  dismiss: []
}>()

const showDropdown = ref(false)

const visible = computed(
  () => props.suggestion && props.suggestion.kind !== 'none',
)

function accept() {
  if (!props.suggestion || props.suggestion.kind === 'none') return
  const existing = props.categories.find(c => c.name === props.suggestion!.name)
  if (existing) {
    emit('assign', props.receiptId, existing.id)
  } else {
    emit('create', props.receiptId, props.suggestion.name)
  }
}

function pickCategory(cat: Category) {
  showDropdown.value = false
  emit('assign', props.receiptId, cat.id)
}
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm"
  >
    <span class="shrink-0">📁</span>

    <span class="flex-1 min-w-0 truncate">
      <template v-if="suggestion!.kind === 'existing'">
        Suggested: <span class="font-medium">{{ suggestion!.name }}</span>
      </template>
      <template v-else>
        New category: <span class="font-medium">"{{ suggestion!.name }}"</span>?
      </template>
    </span>

    <!-- Accept / Create -->
    <Button
      v-if="suggestion!.kind === 'existing'"
      variant="ghost"
      size="sm"
      class="h-7 gap-1 shrink-0"
      @click="accept"
    >
      <Check class="size-3" /> Accept
    </Button>
    <Button
      v-else
      variant="ghost"
      size="sm"
      class="h-7 gap-1 shrink-0"
      @click="accept"
    >
      <Plus class="size-3" /> Create
    </Button>

    <!-- Change dropdown -->
    <div class="relative shrink-0">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1"
        @click="showDropdown = !showDropdown"
      >
        Change <ChevronDown class="size-3" />
      </Button>
      <div
        v-if="showDropdown"
        class="absolute right-0 top-8 z-50 w-48 rounded-lg border bg-popover shadow-md py-1"
      >
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left"
          @click="pickCategory(cat)"
        >
          <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
          {{ cat.name }}
        </button>
        <p v-if="categories.length === 0" class="px-3 py-1.5 text-sm text-muted-foreground">
          No categories yet
        </p>
      </div>
    </div>

    <!-- Dismiss -->
    <Button
      variant="ghost"
      size="icon"
      class="size-7 shrink-0"
      aria-label="Dismiss suggestion"
      @click="emit('dismiss')"
    >
      <X class="size-3" />
    </Button>
  </div>
</template>
