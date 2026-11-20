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
const CATEGORY_DOT: Record<string, string> = {
  food: 'bg-amber-500',
  travel: 'bg-sky-500',
  accommodation: 'bg-violet-500',
  other: 'bg-muted-foreground',
}
const categoryLabel = (c: string) => (c === 'accommodation' ? 'Stay' : c.charAt(0).toUpperCase() + c.slice(1))

const autoFilled = computed(() => !ocrLoading.value && !!receiptPreviewUrl.value && !!(form.amount || form.vendor))
const receiptSubtitle = computed(() => {
  if (!receiptPreviewUrl.value) return 'Scan or pick a photo — we fill in the rest'
  if (ocrLoading.value) return 'Reading receipt…'
  return autoFilled.value ? 'Auto-filled from receipt' : 'Fill in the details below'
})

const receiptOpen = ref(false)
</script>

<template>
  <div class="ne-mobile min-h-full pb-28">

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

    <div class="flex flex-col gap-3">
      <!-- ── Receipt summary card ── -->
      <Card class="m-rise flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
        <div class="min-w-0 flex-1">
          <p class="text-[16px] font-semibold text-foreground">Receipt</p>
          <p class="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
            <Icon v-if="ocrLoading" name="solar:refresh-linear" class="size-3.5 shrink-0 animate-spin" />
            <Icon v-else-if="autoFilled" name="solar:stars-linear" class="size-3.5 shrink-0 text-primary" />
            {{ receiptSubtitle }}
          </p>
        </div>

        <!-- Uploaded: thumbnail (tap to view) + replace -->
        <template v-if="receiptPreviewUrl">
          <Button variant="ghost" class="ne-press size-12 shrink-0 overflow-hidden rounded-xl bg-background p-0 hover:bg-background" aria-label="View receipt" @click="receiptOpen = true">
            <img :src="receiptPreviewUrl" alt="" class="size-full object-cover">
          </Button>
          <Button variant="secondary" size="icon-lg" class="ne-press shrink-0 rounded-full bg-background" as="label" aria-label="Replace receipt">
            <Icon name="solar:refresh-linear" class="size-5" />
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange">
          </Button>
        </template>

        <!-- Empty: camera + gallery -->
        <template v-else>
          <Button size="icon-lg" class="ne-press shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90" as="label" aria-label="Scan receipt">
            <Icon name="solar:camera-linear" class="size-5" />
            <input type="file" accept="image/*" capture="environment" class="hidden" @change="handleFileChange">
          </Button>
          <Button variant="secondary" size="icon-lg" class="ne-press shrink-0 rounded-full bg-background" as="label" aria-label="Pick from gallery">
            <Icon name="solar:gallery-linear" class="size-5" />
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange">
          </Button>
        </template>
      </Card>

      <!-- ── Amount ── -->
      <MobileField label="Amount" input-id="ne-amount" class="m-rise" style="--d: 40ms">
        <span class="flex items-center gap-1">
          <span class="text-muted-foreground">₹</span>
          <Input
            id="ne-amount"
            v-model="form.amount"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            class="m-field-input tabular-nums"
          />
        </span>
      </MobileField>

      <!-- ── Vendor ── -->
      <MobileField label="Vendor" icon="solar:shop-linear" input-id="ne-vendor" class="m-rise" style="--d: 80ms">
        <Input id="ne-vendor" v-model="form.vendor" type="text" placeholder="Swiggy, Uber, Hotel…" class="m-field-input" />
      </MobileField>

      <!-- ── Date + Category ── -->
      <div class="m-rise grid grid-cols-2 gap-3" style="--d: 120ms">
        <MobileField :label="ocrFilled.date ? 'Date · from receipt' : 'Date'" icon="solar:calendar-linear" input-id="ne-date" chevron>
          <Input id="ne-date" v-model="form.expense_date" type="date" class="m-field-input" />
        </MobileField>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="ne-press h-auto w-full p-0 font-normal hover:bg-transparent">
              <MobileField as="span" :label="ocrFilled.category ? 'Category · auto' : 'Category'" chevron>
                <span class="flex items-center gap-2">
                  <span class="size-2 shrink-0 rounded-full" :class="CATEGORY_DOT[form.category] ?? 'bg-muted-foreground'" />
                  <span class="truncate">{{ categoryLabel(form.category) }}</span>
                </span>
              </MobileField>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48 rounded-2xl">
            <DropdownMenuRadioGroup :model-value="form.category" @update:model-value="(v) => setCategory(String(v))">
              <DropdownMenuRadioItem v-for="c in categories" :key="c" :value="c" class="gap-2 py-2.5">
                <Icon :name="CATEGORY_ICONS[c] ?? 'solar:box-linear'" class="size-4 text-muted-foreground" />
                {{ categoryLabel(c) }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- ── Description ── -->
      <MobileField label="Description" icon="solar:pen-linear" input-id="ne-desc" class="m-rise" style="--d: 160ms">
        <Input id="ne-desc" v-model="form.description" type="text" placeholder="What was this for?" class="m-field-input" />
      </MobileField>
    </div>

    <!-- ── Submit ── -->
    <MobileSubmitButton placement="page" :loading="submitting" :disabled="ocrLoading" @click="submit">
      <template v-if="submitting">Submitting…</template>
      <template v-else-if="ocrLoading">Reading receipt…</template>
      <template v-else>Submit for approval<span v-if="Number(form.amount) > 0"> · ₹{{ form.amount }}</span></template>
    </MobileSubmitButton>

    <!-- ── Receipt viewer ── -->
    <Sheet v-model:open="receiptOpen">
      <SheetContent side="bottom" class="max-h-[92dvh] gap-3 rounded-t-3xl px-4 pt-5" style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)">
        <SheetHeader class="p-0">
          <SheetTitle>Receipt</SheetTitle>
          <SheetDescription class="sr-only">Uploaded receipt image</SheetDescription>
        </SheetHeader>
        <img v-if="receiptPreviewUrl" :src="receiptPreviewUrl" alt="Receipt" class="max-h-[75dvh] w-full rounded-2xl bg-muted object-contain">
      </SheetContent>
    </Sheet>

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
@media (prefers-reduced-motion: reduce) {
  .ne-press { transition: none; }
}
</style>
