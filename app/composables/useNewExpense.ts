import type { InjectionKey } from 'vue'
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import type { ExpenseCategory } from '~~/lib/supabase'

// Logic for the mobile "Submit expense" screen (/m/expenses/new), copied unchanged
// from app/pages/app/expenses/new.vue (the web page keeps its own copy).
// The page calls provideNewExpense(); the screen calls useNewExpense().
function createNewExpense() {
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
  const ocrFilled = reactive({ date: false, category: false })
  const submitting = ref(false)

  function setCategory(c: string) { form.category = c as ExpenseCategory }

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    receiptFile.value = file
    receiptPreviewUrl.value = URL.createObjectURL(file)
    ocrLoading.value = true
    ocrFilled.date = false
    ocrFilled.category = false
    try {
      const { runOcr } = await import('~~/lib/ocr')
      const result = await runOcr(receiptPreviewUrl.value)
      if (result.amount) form.amount = String(result.amount)
      if (result.merchant && !form.vendor) form.vendor = result.merchant.slice(0, 60)
      ocrText.value = result.raw ?? ''
      if (result.isoDate) { form.expense_date = result.isoDate; ocrFilled.date = true }
      if (result.category) { form.category = result.category; ocrFilled.category = true }
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
      router.push('/m/expenses')
    } catch (e: any) {
      if (showPlanLimitToast(e)) return
      toast.error(e?.data?.message ?? e?.message ?? 'Failed to submit')
    } finally {
      submitting.value = false
    }
  }

  return {
    form, categories, receiptFile, receiptPreviewUrl, ocrText, ocrLoading, ocrFilled, submitting,
    setCategory, handleFileChange, submit,
  }
}

type NewExpenseState = ReturnType<typeof createNewExpense>
const NEW_EXPENSE_KEY: InjectionKey<NewExpenseState> = Symbol('new-expense')

/** Call once in the page. */
export function provideNewExpense() {
  const state = createNewExpense()
  provide(NEW_EXPENSE_KEY, state)
  return state
}

/** Call in a screen component rendered by the page. */
export function useNewExpense() {
  const state = inject(NEW_EXPENSE_KEY)
  if (!state) throw new Error('useNewExpense() must be used inside a page that calls provideNewExpense()')
  return state
}
