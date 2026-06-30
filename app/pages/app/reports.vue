<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const downloading = ref(false)

async function downloadCSV() {
  downloading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    const url = `/api/reports/export?month=${selectedMonth.value}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `expenses-${selectedMonth.value}.csv`
    link.click()
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-md">
    <h1 class="text-xl font-semibold text-gray-900">Reports</h1>

    <div class="flex flex-col gap-4 px-5 py-5 rounded-xl border border-gray-200">
      <p class="text-sm font-medium text-gray-700">Export expenses to CSV</p>
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-medium text-gray-500">Month</label>
        <input v-model="selectedMonth" type="month"
          class="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400" />
      </div>
      <p class="text-xs text-gray-400">
        Export includes: expense ID, date, employee, team, vendor, category, amount, description, status, UTR number.
      </p>
      <button :disabled="downloading"
        class="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 self-start"
        @click="downloadCSV">
        {{ downloading ? 'Downloading…' : 'Download CSV' }}
      </button>
    </div>
  </div>
</template>
