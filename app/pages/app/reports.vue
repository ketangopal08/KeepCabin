<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { FileDown } from '@lucide/vue'

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
  <div class="-m-6 flex h-[calc(100vh-44px)]">

    <!-- ── Left config panel ── -->
    <div class="w-[360px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">

      <div class="px-5 pt-5 pb-4 border-b border-border">
        <div class="flex items-center gap-2 mb-0.5">
          <FileDown class="size-4 text-muted-foreground" />
          <h1 class="text-[15px] font-semibold text-foreground">Export Report</h1>
        </div>
        <p class="text-[12.5px] text-muted-foreground">Export expense data as a CSV file</p>
      </div>

      <div class="flex flex-col gap-4 px-5 py-5 flex-1">

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Month</label>
          <Input v-model="selectedMonth" type="month" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Included columns</label>
          <div class="rounded-lg border border-border overflow-hidden divide-y divide-border">
            <div
              v-for="col in exportColumns"
              :key="col.key"
              class="flex items-center gap-3 px-3.5 py-2.5 bg-card"
            >
              <div class="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span class="text-[12.5px] text-foreground">{{ col.label }}</span>
            </div>
          </div>
        </div>

      </div>

      <div class="px-5 py-4 border-t border-border">
        <Button :disabled="downloading" class="w-full gap-2" @click="downloadCSV">
          <svg v-if="downloading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <FileDown v-else class="size-4 shrink-0" />
          {{ downloading ? 'Downloading…' : 'Download CSV' }}
        </Button>
      </div>
    </div>

    <!-- ── Right panel: table preview ── -->
    <div class="flex-1 bg-muted/30 flex flex-col overflow-auto p-6">
      <div class="w-full max-w-[760px] mx-auto flex flex-col gap-4">

        <div class="flex items-center justify-between">
          <p class="text-[13px] font-semibold text-foreground">Preview</p>
          <Badge variant="outline">{{ selectedMonth }}</Badge>
        </div>

        <!-- Table card -->
        <Card>
          <CardContent class="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[80px]">ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead class="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in previewRows" :key="row.id">
                  <TableCell class="font-mono text-muted-foreground text-xs">{{ row.id }}</TableCell>
                  <TableCell class="text-[12.5px]">{{ row.employee }}</TableCell>
                  <TableCell class="text-[12.5px]">{{ row.team }}</TableCell>
                  <TableCell class="text-[12.5px]">{{ row.vendor }}</TableCell>
                  <TableCell class="text-[12.5px] capitalize">{{ row.category }}</TableCell>
                  <TableCell class="text-right font-semibold text-[12.5px]">{{ row.amount }}</TableCell>
                  <TableCell>
                    <Badge :variant="row.status === 'paid' ? 'default' : 'secondary'" class="capitalize">
                      {{ row.status }}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter class="px-4 py-3 border-t border-border">
            <p class="text-[12px] text-muted-foreground">Showing sample rows · all approved &amp; paid expenses for {{ selectedMonth }} will be exported</p>
          </CardFooter>
        </Card>

        <!-- Column chips -->
        <Card size="sm">
          <CardContent class="px-4 py-3.5">
            <p class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{{ exportColumns.length }} columns exported</p>
            <div class="flex flex-wrap gap-1.5">
              <Badge v-for="col in exportColumns" :key="col.key" variant="secondary">
                {{ col.label }}
              </Badge>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>

  </div>
</template>
