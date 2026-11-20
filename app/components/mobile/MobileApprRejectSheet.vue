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

      <div class="mt-4 flex flex-col gap-3">
        <Card v-if="target" class="flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
          <div class="min-w-0 flex-1">
            <p class="truncate text-[16px] font-semibold text-foreground">{{ target.vendor ?? 'Expense' }}</p>
            <p class="mt-0.5 truncate text-[13px] capitalize text-muted-foreground">
              {{ target.category }} · {{ fmtDate(target.expense_date ?? target.created_at) }}
            </p>
          </div>
          <p class="shrink-0 text-[16px] font-semibold tabular-nums text-foreground">
            ₹{{ Number(target.amount).toLocaleString('en-IN') }}
          </p>
        </Card>

        <MobileField label="Reason" icon="solar:chat-line-linear" input-id="appr-reject-reason">
          <Input
            id="appr-reject-reason"
            v-model="reason"
            placeholder="Reason for rejection…"
            class="m-field-input"
            @keydown.enter="emit('confirm')"
          />
        </MobileField>

        <div class="rounded-3xl border border-border p-4">
          <p class="text-[16px] font-semibold text-foreground">Quick reasons</p>
          <p class="mt-0.5 text-[13px] text-muted-foreground">Tap one to use it as the reason.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              v-for="r in quickReasons"
              :key="r"
              size="sm"
              :variant="reason === r ? 'outline' : 'secondary'"
              class="m-press h-9 rounded-xl px-3.5 text-[13px] font-medium"
              :class="reason === r ? 'border-2 border-foreground' : ''"
              @click="reason = r"
            >
              {{ r }}
            </Button>
          </div>
        </div>
      </div>

      <div class="mt-5 flex flex-col gap-2">
        <MobileSubmitButton
          placement="sheet"
          variant="destructive"
          :loading="busy"
          :disabled="!target || !reason.trim()"
          @click="emit('confirm')"
        >
          {{ busy ? 'Rejecting…' : 'Reject expense' }}
        </MobileSubmitButton>
        <Button variant="ghost" class="m-press h-12 w-full rounded-full text-[15px]" @click="open = false">
          Cancel
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
