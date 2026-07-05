<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'
import { Plus, Users, ArrowUpRight, SlidersHorizontal, Search, X } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx } = useOrgContext()
const role = computed(() => ctx.value?.member?.role)

const teams   = ref<Team[]>([])
const loading = ref(true)
const search  = ref('')
const showSearch = ref(false)

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
  <div class="-m-6 flex flex-col h-full">

    <!-- ── Sub-toolbar ─────────────────────────────────────────────── -->
    <div class="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <span class="text-[13px] font-medium text-foreground">
          Teams
          <span class="ml-1 text-muted-foreground/60 text-[12px]">({{ teams.length }})</span>
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <div v-if="showSearch" class="flex items-center gap-1 bg-accent rounded-lg px-2.5 h-8">
          <Search class="size-3.5 text-muted-foreground shrink-0" />
          <input
            v-model="search"
            placeholder="Search teams…"
            class="bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none w-36"
            @keydown.escape="showSearch = false; search = ''"
          />
          <button @click="showSearch = false; search = ''">
            <X class="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <Button v-else variant="outline" size="sm" class="h-8 text-[12.5px] gap-1.5" @click="showSearch = true">
          <Search class="size-3.5" /> Search
        </Button>
        <Button variant="outline" size="sm" class="h-8 text-[12.5px] gap-1.5">
          <SlidersHorizontal class="size-3.5" /> Filter
        </Button>
        <Button v-if="role === 'owner'" size="sm" class="h-8 text-[12.5px] gap-1.5">
          <Plus class="size-3.5" /> New Team
        </Button>
      </div>
    </div>

    <!-- ── Content ─────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-auto">

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col">
        <div v-for="n in 5" :key="n" class="flex items-center gap-4 px-5 py-4 border-b border-border">
          <Skeleton class="size-9 rounded-xl" />
          <div class="flex flex-col gap-1.5 flex-1">
            <Skeleton class="h-4 w-32 rounded" />
            <Skeleton class="h-3 w-20 rounded" />
          </div>
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-28 gap-5">
        <div class="size-16 rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
          <Users class="size-7 text-muted-foreground/50" />
        </div>
        <div class="text-center">
          <p class="text-[15px] font-semibold text-foreground">No teams yet</p>
          <p class="text-[13px] text-muted-foreground mt-1">Create your first team to get started.</p>
        </div>
        <Button v-if="role === 'owner'" size="sm">
          <Plus class="size-3.5 mr-1.5" /> New Team
        </Button>
      </div>

      <!-- Table -->
      <table v-else class="w-full text-[13px]">
        <thead class="sticky top-0 bg-background border-b border-border">
          <tr>
            <th class="px-5 py-3 text-left font-medium text-muted-foreground">Team</th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">Members</th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">Created</th>
            <th class="w-10 px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="team in filtered"
            :key="team.id"
            class="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
            @click="navigateTo(`/app/teams/${team.id}`)"
          >
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <TeamAvatar :name="team.name" />
                <div>
                  <p class="font-medium text-foreground">{{ team.name }}</p>
                </div>
              </div>
            </td>
            <td class="px-3 py-3.5">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Users class="size-3.5" />
                <span>—</span>
              </div>
            </td>
            <td class="px-3 py-3.5 text-muted-foreground">
              {{ team.created_at ? new Date(team.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
            </td>
            <td class="px-5 py-3.5 text-right">
              <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                <ArrowUpRight class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  </div>
</template>
