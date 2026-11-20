<!-- Bottom sheet for rejecting an expense (mobile Approvals + Payments).
     Mirrors the web reject dialog: reason input + the same quick reasons. -->
<script setup lang="ts">
import type { Expense } from '~~/lib/supabase'

defineProps<{
  target: Expense | null
  busy?: boolean
  quickReasons: string[]
}>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { required: true })
const reason = defineModel<string>('reason', { required: true })

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="bottom"
      class="mx-auto max-h-[90dvh] max-w-md gap-0 overflow-y-auto rounded-t-3xl border-0 px-5 pt-3"
      style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)"
    >
      <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
      <SheetHeader class="p-0 text-left">
        <SheetTitle class="text-[17px]">Reject expense</SheetTitle>
        <SheetDescription>The submitter will see this reason and can resubmit.</SheetDescription>
      </SheetHeader>

      <Card v-if="target" class="mt-4 flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 p-3 shadow-none ring-0">
        <div class="min-w-0 flex-1">
          <p class="truncate text-[14px] font-semibold text-foreground">{{ target.vendor ?? 'Expense' }}</p>
          <p class="text-[12px] capitalize text-muted-foreground">
            {{ target.category }} · {{ fmtDate(target.expense_date ?? target.created_at) }}
          </p>
        </div>
        <p class="shrink-0 text-[15px] font-semibold tabular-nums text-foreground">
          ₹{{ Number(target.amount).toLocaleString('en-IN') }}
        </p>
      </Card>

      <div class="mt-4 flex flex-col gap-2.5">
        <p class="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">Reason</p>
        <Input
          v-model="reason"
          placeholder="Reason for rejection…"
          class="h-12 rounded-2xl px-4 text-base md:text-base"
          @keydown.enter="emit('confirm')"
        />
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="r in quickReasons"
            :key="r"
            size="sm"
            :variant="reason === r ? 'default' : 'secondary'"
            class="m-press h-9 rounded-full px-3.5 text-[12.5px] font-normal"
            :class="reason === r ? 'bg-foreground text-background hover:bg-foreground/90' : 'text-muted-foreground'"
            @click="reason = r; haptic()"
          >
            {{ r }}
          </Button>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" class="m-press h-12 rounded-full text-[15px]" @click="open = false">
          Cancel
        </Button>
        <Button
          class="m-press h-12 gap-2 rounded-full bg-red-600 text-[15px] font-semibold text-white hover:bg-red-600/90"
          :disabled="!target || busy || !reason.trim()"
          @click="haptic(); emit('confirm')"
        >
          <Icon v-if="busy" name="solar:refresh-linear" class="size-5 animate-spin" />
          {{ busy ? 'Rejecting…' : 'Reject expense' }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
