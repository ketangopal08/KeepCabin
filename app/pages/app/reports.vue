<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const downloading = ref(false)

const exportColumns = [
  { key: 'id', label: 'Expense ID' },
  { key: 'date', label: 'Date' },
  { key: 'employee', label: 'Employee' },
  { key: 'team', label: 'Team' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount (₹)' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'utr', label: 'UTR Number' },
]

const previewRows = [
  { id: 'EXP-001', employee: 'alice@co…', team: 'Engineering', vendor: 'Swiggy', category: 'food', amount: '₹450', status: 'paid' },
  { id: 'EXP-002', employee: 'bob@co…', team: 'Sales', vendor: 'Uber', category: 'travel', amount: '₹280', status: 'pending' },
  { id: 'EXP-003', employee: 'carol@co…', team: 'Engineering', vendor: 'OYO', category: 'accommodation', amount: '₹3,200', status: 'paid' },
]

async function downloadCSV() {
  downloading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    const response = await fetch(`/api/reports/export?month=${selectedMonth.value}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!response.ok) { console.error('Export failed', response.status); return }
    const blob = await response.blob()
    const link = document.createElement('a')
    const objectUrl = URL.createObjectURL(blob)
    link.href = objectUrl
    link.download = `expenses-${selectedMonth.value}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Reports" description="Export expense data as a CSV file.">
      <template #actions>
        <Button :disabled="downloading" class="h-9 gap-1.5 rounded-lg px-4" @click="downloadCSV">
          <svg v-if="downloading" class="size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <Icon name="solar:file-download-linear" v-else class="size-4 shrink-0" />
          {{ downloading ? 'Downloading…' : 'Download CSV' }}
        </Button>
      </template>
    </AppPageHeader>

    <!-- Tabs -->
    <AppPageTabs model-value="export" :tabs="[{ id: 'export', label: 'Export' }]" />

    <!-- Month -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <span class="text-sm text-muted-foreground">Month</span>
      <Input v-model="selectedMonth" type="month" class="h-9 w-48 rounded-lg text-sm" />
    </div>

    <!-- Preview -->
    <div class="mb-3 flex items-center justify-between">
      <p class="text-[14px] font-medium text-foreground">Preview</p>
      <Badge variant="outline" class="font-normal">{{ selectedMonth }}</Badge>
    </div>

    <AppTableCard>
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-[100px]">ID</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Category</TableHead>
            <TableHead class="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in previewRows" :key="row.id" class="border-border">
            <TableCell class="font-mono text-xs text-muted-foreground">{{ row.id }}</TableCell>
            <TableCell>{{ row.employee }}</TableCell>
            <TableCell>{{ row.team }}</TableCell>
            <TableCell>{{ row.vendor }}</TableCell>
            <TableCell class="capitalize">{{ row.category }}</TableCell>
            <TableCell class="text-right font-medium">{{ row.amount }}</TableCell>
            <TableCell>
              <Badge :variant="row.status === 'paid' ? 'success' : 'warning'" class="gap-1.5 capitalize">
                <span class="size-1.5 shrink-0 rounded-full bg-current" />
                {{ row.status }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
        <template #footer>
          Showing {{ previewRows.length }} sample rows
        </template>
      </Table>
    </AppTableCard>
    <p class="mt-3 text-[13px] text-muted-foreground">
      Showing sample rows · all approved &amp; paid expenses for {{ selectedMonth }} will be exported
    </p>

    <Separator class="my-7" />

    <!-- Columns -->
    <p class="mb-3 text-[14px] font-medium text-foreground">Included columns <span class="ml-1 text-sm font-normal text-muted-foreground">{{ exportColumns.length }}</span></p>
    <div class="flex flex-wrap gap-2">
      <Badge v-for="col in exportColumns" :key="col.key" variant="outline" class="h-7 gap-1.5 rounded-md px-2.5 text-[13px] font-normal">
        <span class="size-1.5 shrink-0 rounded-full bg-emerald-400" />
        {{ col.label }}
      </Badge>
    </div>

  </AppPage>
</template>
