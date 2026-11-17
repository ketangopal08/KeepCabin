<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import type { ExpenseCategory } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const router = useRouter()

const form = reactive({
  amount: '',
  vendor: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
  category: 'food' as ExpenseCategory,
})

const categories: ExpenseCategory[] = ['food', 'travel', 'accommodation', 'other']
const receiptFile = ref<File | null>(null)
const receiptPreviewUrl = ref('')
const ocrText = ref('')
const ocrLoading = ref(false)
const submitting = ref(false)

function setCategory(c: string) { form.category = c as ExpenseCategory }

async function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  receiptFile.value = file
  receiptPreviewUrl.value = URL.createObjectURL(file)
  ocrLoading.value = true
  try {
    const { runOcr } = await import('~~/lib/ocr')
    const result = await runOcr(receiptPreviewUrl.value)
    if (result.total) {
      const m = result.total.match(/([\d,]+(?:\.\d{1,2})?)$/)
      if (m?.[1]) form.amount = m[1].replace(/,/g, '')
    }
    if (result.merchant && !form.vendor) form.vendor = result.merchant.slice(0, 60)
    ocrText.value = result.raw ?? ''
    if (result.date && !form.expense_date) form.expense_date = result.date
  } catch {
    // OCR failure is non-fatal
  } finally {
    ocrLoading.value = false
  }
}

async function submit() {
  if (!receiptFile.value) { toast.error('Please upload a receipt'); return }
  if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
  submitting.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Session expired'); submitting.value = false; return }
    const ext = receiptFile.value.name.split('.').pop()
    const path = `${session.user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('receipts').upload(path, receiptFile.value)
    if (uploadErr) throw new Error(uploadErr.message)
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
    await $fetch<{ id: string }>('/api/expenses' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { ...form, amount: Number(form.amount), receipt_url: publicUrl, ocr_text: ocrText.value || undefined },
    })
    toast.success('Expense submitted!')
    router.push('/app/expenses')
  } catch (e: any) {
    toast.error(e?.data?.message ?? e?.message ?? 'Failed to submit')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Submit expense" description="Receipt auto-fills details via OCR." :back="{ label: 'All expenses', to: '/app/expenses' }" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">

      <!-- ── Form ── -->
      <Card class="gap-0 rounded-xl py-0">
        <div class="flex flex-col gap-5 px-5 py-5">

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-muted-foreground">Amount (₹)</label>
            <Input v-model="form.amount" type="number" min="0" step="0.01" placeholder="0.00" class="h-9 rounded-lg text-sm" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-muted-foreground">Vendor / Merchant</label>
            <Input v-model="form.vendor" type="text" placeholder="Swiggy, Uber, Hotel…" class="h-9 rounded-lg text-sm" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-muted-foreground">Date</label>
            <Input v-model="form.expense_date" type="date" class="h-9 rounded-lg text-sm" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-muted-foreground">Category</label>
            <div class="grid grid-cols-2 gap-2">
              <Button
                v-for="c in categories"
                :key="c"
                :variant="form.category === c ? 'default' : 'outline'"
                class="h-9 rounded-lg capitalize"
                @click="setCategory(c)"
              >{{ c }}</Button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-muted-foreground">Description</label>
            <Input v-model="form.description" type="text" placeholder="What was this expense for?" class="h-9 rounded-lg text-sm" />
          </div>

        </div>

        <Separator />
        <div class="px-5 py-4">
          <Button :disabled="submitting" class="h-9 w-full rounded-lg" @click="submit">
            <svg v-if="submitting" class="size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            {{ submitting ? 'Submitting…' : 'Submit for approval' }}
          </Button>
        </div>
      </Card>

      <!-- ── Receipt upload + preview ── -->
      <Card class="min-h-[460px] items-center justify-center rounded-xl bg-muted/30 px-6 py-8">

        <!-- Receipt uploaded -->
        <div v-if="receiptPreviewUrl" class="flex w-full max-w-[400px] flex-col gap-3">
          <Card class="py-0">
            <CardContent class="overflow-hidden rounded-xl p-0">
              <img :src="receiptPreviewUrl" class="max-h-[380px] w-full object-contain" />
            </CardContent>
          </Card>

          <!-- OCR loading -->
          <Card v-if="ocrLoading" size="sm">
            <CardContent class="flex items-center gap-3 px-4 py-1">
              <svg class="size-4 shrink-0 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <p class="text-[13px] text-muted-foreground">Extracting details from receipt…</p>
            </CardContent>
          </Card>

          <!-- OCR result -->
          <Card v-else-if="form.amount || form.vendor" size="sm">
            <CardContent class="flex flex-col gap-2 px-4 py-1">
              <div class="flex items-center gap-2">
                <Icon name="solar:magic-stick-3-linear" class="size-3.5 text-primary" />
                <p class="text-[13px] font-medium text-muted-foreground">Auto-filled from receipt</p>
              </div>
              <div v-if="form.amount" class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Amount</span>
                <span class="font-medium text-foreground">₹{{ form.amount }}</span>
              </div>
              <div v-if="form.vendor" class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Vendor</span>
                <span class="font-medium text-foreground">{{ form.vendor }}</span>
              </div>
            </CardContent>
          </Card>

          <!-- Replace -->
          <label class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
            <Icon name="solar:upload-linear" class="size-3.5" />
            Replace receipt
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange" />
          </label>
        </div>

        <!-- Empty upload state -->
        <div v-else class="flex max-w-[320px] flex-col items-center gap-4 text-center">
          <label class="group flex w-full cursor-pointer flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-8 py-10 transition-colors hover:border-foreground/30">
            <div class="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Icon name="solar:upload-linear" class="size-5 text-muted-foreground" />
            </div>
            <div>
              <p class="text-[14px] font-medium text-foreground">Upload receipt</p>
              <p class="mt-1 text-[13px] text-muted-foreground">Click or drag &amp; drop</p>
            </div>
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange" />
          </label>
          <p class="text-[13px] text-muted-foreground">Amount, vendor, and date are extracted automatically</p>
        </div>

      </Card>
    </div>

  </AppPage>
</template>
