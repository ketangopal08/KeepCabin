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

function setCategory(c: string) {
  form.category = c as ExpenseCategory
}

async function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  receiptFile.value = file
  receiptPreviewUrl.value = URL.createObjectURL(file)

  ocrLoading.value = true
  try {
    const { runOcr } = await import('~~/lib/ocr')
    const result = await runOcr(receiptPreviewUrl.value)

    // Auto-fill amount from OCR total
    if (result.total) {
      const amountMatch = result.total.match(/([\d,]+(?:\.\d{1,2})?)$/)
      const raw = amountMatch?.[1]
      if (raw) form.amount = raw.replace(/,/g, '')
    }

    // Auto-fill vendor from OCR merchant
    if (result.merchant && !form.vendor) {
      form.vendor = result.merchant.slice(0, 60)
    }

    // Store raw OCR text for server-side audit
    ocrText.value = result.raw ?? ''

    // Auto-fill date if found
    if (result.date && !form.expense_date) {
      form.expense_date = result.date
    }
  } catch {
    // OCR failure is non-fatal — user can fill manually
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
    if (!session) { toast.error('Session expired, please log in again'); submitting.value = false; return }

    // Upload receipt to storage
    const ext = receiptFile.value.name.split('.').pop()
    const path = `${session!.user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('receipts')
      .upload(path, receiptFile.value)
    if (uploadErr) throw new Error(uploadErr.message)
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)

    await $fetch<{ id: string }>('/api/expenses' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: {
        ...form,
        amount: Number(form.amount),
        receipt_url: publicUrl,
        ocr_text: ocrText.value || undefined,
      },
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
  <div class="flex flex-col gap-6 max-w-lg">
    <h1 class="text-xl font-semibold text-gray-900">Submit Expense</h1>

    <!-- Receipt upload -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-gray-500">Receipt / UPI Screenshot</label>
      <label class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 cursor-pointer hover:border-gray-400 transition-all">
        <img v-if="receiptPreviewUrl" :src="receiptPreviewUrl" class="max-h-40 rounded-lg object-contain" />
        <span v-else class="text-sm text-gray-400">Click to upload or drag &amp; drop</span>
        <span v-if="ocrLoading" class="text-xs text-gray-400 animate-pulse">Extracting details…</span>
        <input type="file" accept="image/*" class="hidden" @change="handleFileChange" />
      </label>
    </div>

    <!-- Amount -->
    <div class="flex flex-col gap-1.5">
      <label class="text-[13px] font-medium text-gray-500">Amount (₹)</label>
      <input v-model="form.amount" type="number" min="0" step="0.01" placeholder="0.00"
        class="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400" />
    </div>

    <!-- Vendor -->
    <div class="flex flex-col gap-1.5">
      <label class="text-[13px] font-medium text-gray-500">Vendor / Merchant</label>
      <input v-model="form.vendor" type="text" placeholder="Swiggy, Uber, Hotel…"
        class="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400" />
    </div>

    <!-- Date -->
    <div class="flex flex-col gap-1.5">
      <label class="text-[13px] font-medium text-gray-500">Date</label>
      <input v-model="form.expense_date" type="date"
        class="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400" />
    </div>

    <!-- Category -->
    <div class="flex flex-col gap-1.5">
      <label class="text-[13px] font-medium text-gray-500">Category</label>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          :class="['px-4 py-2 rounded-xl text-sm border capitalize transition-all',
            form.category === c ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400']"
          @click="setCategory(c)"
        >{{ c }}</button>
      </div>
    </div>

    <!-- Description -->
    <div class="flex flex-col gap-1.5">
      <label class="text-[13px] font-medium text-gray-500">Description</label>
      <input v-model="form.description" type="text" placeholder="What was this expense for?"
        class="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400" />
    </div>

    <button
      :disabled="submitting"
      class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50"
      @click="submit"
    >
      {{ submitting ? 'Submitting…' : 'Submit for approval' }}
    </button>
  </div>
</template>
