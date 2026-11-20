<script setup lang="ts">
// Mobile screen for /m/expenses/new. Logic comes from useNewExpense() (provided by the page).
const {
  form, categories, receiptPreviewUrl, ocrLoading, ocrFilled, submitting,
  setCategory, handleFileChange, submit,
} = useNewExpense()

const CATEGORY_ICONS: Record<string, string> = {
  food: 'solar:cup-hot-linear',
  travel: 'solar:bus-linear',
  accommodation: 'solar:bed-linear',
  other: 'solar:box-linear',
}

const autoFilled = computed(() => !ocrLoading.value && !!receiptPreviewUrl.value && !!(form.amount || form.vendor))

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

function pickCategory(c: string) {
  haptic()
  setCategory(c)
}

function onSubmit() {
  haptic()
  submit()
}
</script>

<template>
  <div class="ne-mobile min-h-full pb-12">

    <!-- Header -->
    <div class="mb-5 flex items-center gap-3">
      <Button variant="outline" size="icon" class="ne-press size-10 shrink-0 rounded-full" as-child>
        <NuxtLink to="/m" aria-label="Back">
          <Icon name="solar:arrow-left-linear" class="size-5" />
        </NuxtLink>
      </Button>
      <div class="min-w-0">
        <h1 class="truncate text-lg font-semibold tracking-tight text-foreground">New expense</h1>
        <p class="text-[13px] text-muted-foreground">Scan a receipt — we fill in the rest</p>
      </div>
    </div>

    <!-- ── Receipt ── -->
    <Card class="ne-rise mb-4 gap-0 overflow-hidden rounded-3xl py-0">

      <!-- Empty: camera-first -->
      <div v-if="!receiptPreviewUrl" class="flex flex-col items-center gap-4 px-5 py-8 text-center">
        <div class="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Icon name="solar:document-text-linear" class="size-7 text-muted-foreground" />
        </div>
        <div>
          <p class="text-[15px] font-semibold text-foreground">Add your receipt</p>
          <p class="mt-1 text-[13px] text-muted-foreground">Amount, vendor, date and category are read automatically</p>
        </div>
        <div class="grid w-full grid-cols-2 gap-2">
          <Button class="ne-press h-12 rounded-2xl text-[14px]" as="label">
            <Icon name="solar:camera-linear" class="size-5" />
            Scan
            <input type="file" accept="image/*" capture="environment" class="hidden" @change="handleFileChange">
          </Button>
          <Button variant="outline" class="ne-press h-12 rounded-2xl text-[14px]" as="label">
            <Icon name="solar:gallery-linear" class="size-5" />
            Gallery
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange">
          </Button>
        </div>
      </div>

      <!-- Uploaded -->
      <div v-else>
        <div class="relative bg-muted/40">
          <img :src="receiptPreviewUrl" alt="Receipt" class="max-h-64 w-full object-contain">
          <div v-if="ocrLoading" class="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <div class="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-sm">
              <svg class="size-4 shrink-0 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
              <span class="text-[13px] font-medium text-foreground">Reading receipt…</span>
            </div>
          </div>
        </div>
        <Separator />
        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <Badge v-if="autoFilled" variant="secondary" class="gap-1.5 rounded-full">
            <Icon name="solar:stars-linear" class="size-3.5 text-primary" />
            Auto-filled from receipt
          </Badge>
          <span v-else-if="!ocrLoading" class="text-[13px] text-muted-foreground">Fill in the details below</span>
          <span v-else />
          <Button variant="ghost" size="sm" class="ne-press shrink-0 rounded-full" as="label">
            <Icon name="solar:refresh-linear" class="size-4" />
            Replace
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange">
          </Button>
        </div>
      </div>
    </Card>

    <!-- ── Amount ── -->
    <Card class="ne-rise mb-4 gap-0 rounded-3xl px-5 py-5" style="--d: 60ms">
      <label for="ne-amount" class="text-[13px] text-muted-foreground">Amount</label>
      <div class="mt-1 flex items-center gap-1">
        <span class="text-3xl font-semibold text-muted-foreground">₹</span>
        <Input
          id="ne-amount"
          v-model="form.amount"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          class="h-12 border-0 px-1 text-3xl font-semibold shadow-none focus-visible:ring-0 md:text-3xl"
        />
      </div>
    </Card>

    <!-- ── Category ── -->
    <div class="ne-rise mb-4" style="--d: 120ms">
      <p class="mb-2 px-1 text-[13px] text-muted-foreground">Category</p>
      <div class="grid grid-cols-4 gap-2">
        <Button
          v-for="c in categories"
          :key="c"
          :variant="form.category === c ? 'default' : 'outline'"
          class="ne-press flex h-auto flex-col gap-1.5 rounded-2xl px-1 py-3 text-[12px] capitalize"
          @click="pickCategory(c)"
        >
          <Icon :name="CATEGORY_ICONS[c] ?? 'solar:box-linear'" class="size-5" />
          <span class="max-w-full truncate">{{ c === 'accommodation' ? 'Stay' : c }}</span>
        </Button>
      </div>
    </div>

    <!-- ── Details ── -->
    <Card class="ne-rise gap-0 rounded-3xl py-0" style="--d: 180ms">
      <div class="flex items-center gap-3 px-4 py-3">
        <Icon name="solar:shop-linear" class="size-5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <label for="ne-vendor" class="text-[12px] text-muted-foreground">Vendor</label>
          <Input id="ne-vendor" v-model="form.vendor" type="text" placeholder="Swiggy, Uber, Hotel…" class="h-8 border-0 px-0 text-[15px] shadow-none focus-visible:ring-0" />
        </div>
      </div>
      <Separator />
      <div class="flex items-center gap-3 px-4 py-3">
        <Icon name="solar:calendar-linear" class="size-5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <label for="ne-date" class="text-[12px] text-muted-foreground">
            Date
            <span v-if="ocrFilled.date" class="text-primary"> · from receipt</span>
          </label>
          <Input id="ne-date" v-model="form.expense_date" type="date" class="h-8 border-0 px-0 text-[15px] shadow-none focus-visible:ring-0" />
        </div>
      </div>
      <Separator />
      <div class="flex items-center gap-3 px-4 py-3">
        <Icon name="solar:pen-linear" class="size-5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <label for="ne-desc" class="text-[12px] text-muted-foreground">Description</label>
          <Input id="ne-desc" v-model="form.description" type="text" placeholder="What was this for?" class="h-8 border-0 px-0 text-[15px] shadow-none focus-visible:ring-0" />
        </div>
      </div>
    </Card>

    <!-- ── Sticky submit ── -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 bg-background/90 px-4 pt-3 backdrop-blur-xl"
      style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)"
    >
      <Button :disabled="submitting || ocrLoading" class="ne-press h-13 w-full rounded-full text-[15px] font-semibold" @click="onSubmit">
        <svg v-if="submitting" class="size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <template v-if="submitting">Submitting…</template>
        <template v-else-if="ocrLoading">Reading receipt…</template>
        <template v-else>Submit for approval<span v-if="Number(form.amount) > 0"> · ₹{{ form.amount }}</span></template>
      </Button>
    </div>

  </div>
</template>

<style scoped>
.ne-mobile {
  -webkit-tap-highlight-color: transparent;
}
.ne-press {
  transition: transform 160ms cubic-bezier(.2, .8, .2, 1);
}
.ne-press:active {
  transform: scale(.97);
}
@keyframes ne-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
.ne-rise {
  animation: ne-rise 480ms cubic-bezier(.16, 1, .3, 1) backwards;
  animation-delay: var(--d, 0ms);
}
@media (prefers-reduced-motion: reduce) {
  .ne-rise { animation: none; }
  .ne-press { transition: none; }
}
</style>
