<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx } = useOrgContext()
const role = computed(() => ctx.value?.member?.role)

const teams   = ref<Team[]>([])
const loading = ref(true)
const search  = ref('')

const filtered = computed(() =>
  search.value.trim()
    ? teams.value.filter(t => t.name.toLowerCase().includes(search.value.toLowerCase()))
    : teams.value
)

function teamColor(name: string) {
  const palette = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length
  return palette[h]
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  try {
    teams.value = await $fetch<Team[]>('/api/teams', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppPage>

    <!-- ── Header ──────────────────────────────────────────────────── -->
    <AppPageHeader title="Teams">
      <template #actions>
        <Button v-if="role === 'owner'" class="h-9 gap-1.5 rounded-lg px-4">
          <Icon name="solar:add-linear" class="size-4" /> New team
        </Button>
      </template>
    </AppPageHeader>

    <!-- ── Tabs ────────────────────────────────────────────────────── -->
    <AppPageTabs model-value="all" :tabs="[{ id: 'all', label: 'All teams', count: teams.length }]" />

    <!-- ── Search + filter ─────────────────────────────────────────── -->
    <AppSearchInput v-model="search" placeholder="Search teams" />
    <div class="mt-3 mb-4 flex items-center gap-2">
      <Button variant="outline" size="sm" class="h-7 gap-1.5 rounded-md px-2.5 text-[13px] font-medium">
        <Icon name="solar:tuning-2-linear" class="size-3.5" /> Filter
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col">
      <div v-for="n in 5" :key="n" class="flex items-center gap-4 border-b border-border px-2 py-4">
        <Skeleton class="size-9 rounded-xl" />
        <div class="flex flex-1 flex-col gap-1.5">
          <Skeleton class="h-4 w-32 rounded" />
          <Skeleton class="h-3 w-20 rounded" />
        </div>
        <Skeleton class="h-5 w-16 rounded-full" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
      <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
      <p class="text-[15px] text-foreground">{{ search ? 'No teams found' : 'No teams yet' }}</p>
      <p class="-mt-1.5 text-sm text-muted-foreground">
        {{ search ? 'Try a different search term.' : 'Create your first team to get started.' }}
      </p>
      <Button v-if="role === 'owner' && !search" variant="outline" class="mt-2 h-9 gap-1.5 rounded-lg px-4">
        <Icon name="solar:add-linear" class="size-4" /> New team
      </Button>
    </div>

    <!-- Table -->
    <Table v-else>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead class="h-11 px-2 font-normal text-muted-foreground">Name</TableHead>
          <TableHead class="h-11 font-normal text-muted-foreground">Members</TableHead>
          <TableHead class="h-11 font-normal text-muted-foreground">Created</TableHead>
          <TableHead class="h-11 w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="team in filtered"
          :key="team.id"
          class="group cursor-pointer border-border"
          @click="navigateTo(`/app/teams/${team.id}`)"
        >
          <TableCell class="px-2 py-3">
            <div class="flex items-center gap-3">
              <TeamAvatar :name="team.name" />
              <p class="text-sm font-medium text-foreground">{{ team.name }}</p>
            </div>
          </TableCell>
          <TableCell class="py-3 text-muted-foreground">—</TableCell>
          <TableCell class="py-3 text-muted-foreground">
            {{ team.created_at ? new Date(team.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
          </TableCell>
          <TableCell class="py-3 text-right">
            <Icon name="solar:arrow-right-up-linear" class="ml-auto size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

  </AppPage>
</template>
