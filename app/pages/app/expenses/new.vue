<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import type { ExpenseCategory } from '~~/lib/supabase'
import { Receipt, Upload, Sparkles } from '@lucide/vue'

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
  <div class="-m-6 flex h-[calc(100vh-44px)]">

    <!-- ── Left config panel ── -->
    <div class="w-[360px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">

      <div class="px-5 pt-5 pb-4 border-b border-border">
        <div class="flex items-center gap-2 mb-0.5">
          <Receipt class="size-4 text-muted-foreground" />
          <h1 class="text-[15px] font-semibold text-foreground">Submit Expense</h1>
        </div>
        <p class="text-[12.5px] text-muted-foreground">Receipt auto-fills details via OCR</p>
      </div>

      <div class="flex flex-col gap-4 px-5 py-5 flex-1">

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Amount (₹)</label>
          <Input v-model="form.amount" type="number" min="0" step="0.01" placeholder="0.00" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Vendor / Merchant</label>
          <Input v-model="form.vendor" type="text" placeholder="Swiggy, Uber, Hotel…" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
          <Input v-model="form.expense_date" type="date" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
          <div class="grid grid-cols-2 gap-1.5">
            <Button
              v-for="c in categories"
              :key="c"
              :variant="form.category === c ? 'default' : 'outline'"
              size="sm"
              class="capitalize"
              @click="setCategory(c)"
            >{{ c }}</Button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
          <Input v-model="form.description" type="text" placeholder="What was this expense for?" />
        </div>

      </div>

      <div class="px-5 py-4 border-t border-border">
        <Button :disabled="submitting" class="w-full" @click="submit">
          <svg v-if="submitting" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
          {{ submitting ? 'Submitting…' : 'Submit for approval' }}
        </Button>
      </div>
    </div>

    <!-- ── Right panel: receipt upload + preview ── -->
    <div class="flex-1 bg-muted/30 flex flex-col overflow-auto">
      <div class="flex flex-col items-center justify-center flex-1 p-8 gap-6">

        <!-- Receipt uploaded -->
        <div v-if="receiptPreviewUrl" class="w-full max-w-[400px] flex flex-col gap-3">
          <Card>
            <CardContent class="p-0 overflow-hidden rounded-xl">
              <img :src="receiptPreviewUrl" class="w-full object-contain max-h-[380px]" />
            </CardContent>
          </Card>

          <!-- OCR loading -->
          <Card v-if="ocrLoading" size="sm">
            <CardContent class="px-4 py-3 flex items-center gap-3">
              <svg class="animate-spin size-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <p class="text-[12.5px] text-muted-foreground">Extracting details from receipt…</p>
            </CardContent>
          </Card>

          <!-- OCR result -->
          <Card v-else-if="form.amount || form.vendor" size="sm">
            <CardContent class="px-4 py-3 flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <Sparkles class="size-3.5 text-primary" />
                <p class="text-[12px] font-semibold text-muted-foreground">Auto-filled from receipt</p>
              </div>
              <div v-if="form.amount" class="flex items-center justify-between text-[12.5px]">
                <span class="text-muted-foreground">Amount</span>
                <span class="font-semibold text-foreground">₹{{ form.amount }}</span>
              </div>
              <div v-if="form.vendor" class="flex items-center justify-between text-[12.5px]">
                <span class="text-muted-foreground">Vendor</span>
                <span class="font-semibold text-foreground">{{ form.vendor }}</span>
              </div>
            </CardContent>
          </Card>

          <!-- Replace -->
          <label class="flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-[12.5px] text-muted-foreground hover:border-foreground/30 hover:text-foreground cursor-pointer transition-colors">
            <Upload class="size-3.5" />
            Replace receipt
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange" />
          </label>
        </div>

        <!-- Empty upload state -->
        <div v-else class="flex flex-col items-center text-center gap-4 max-w-[300px]">
          <label class="w-full flex flex-col items-center gap-4 py-10 px-8 rounded-2xl border-2 border-dashed border-border bg-card cursor-pointer hover:border-foreground/30 transition-colors group">
            <div class="size-14 rounded-2xl bg-muted flex items-center justify-center transition-colors">
              <Upload class="size-6 text-muted-foreground" />
            </div>
            <div>
              <p class="text-[13.5px] font-semibold text-foreground">Upload receipt</p>
              <p class="text-[12px] text-muted-foreground mt-1">Click or drag &amp; drop</p>
            </div>
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange" />
          </label>
          <p class="text-[12px] text-muted-foreground">Amount, vendor, and date are extracted automatically</p>
        </div>

      </div>
    </div>

  </div>
</template>
