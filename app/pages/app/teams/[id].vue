<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'
import { Users, UserPlus, MoreHorizontal, ArrowLeft } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route   = useRoute()
const supabase = useSupabase()
const { load } = useOrgContext()

const team    = ref<Team | null>(null)
const members = ref<any[]>([])
const loadingTeam    = ref(true)
const loadingMembers = ref(true)

const PALETTE = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']

function colorFromStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % PALETTE.length
  return PALETTE[h]
}

function teamInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function memberInitials(m: any) {
  const n = m.full_name ?? m.email ?? '?'
  return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function memberColor(m: any) { return colorFromStr(m.email ?? '?') }

function roleBadgeClass(r: string) {
  if (r === 'owner')   return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400'
  if (r === 'manager') return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400'
  if (r === 'finance') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400'
  return 'text-muted-foreground bg-muted'
}

onMounted(async () => {
  await load()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  try {
    const allTeams = await $fetch<Team[]>('/api/teams', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    team.value = allTeams.find(t => t.id === route.params.id) ?? null
  } finally {
    loadingTeam.value = false
  }

  try {
    members.value = await $fetch<any[]>(`/api/teams/${route.params.id}/members`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch { /* silent — endpoint may not exist yet */ } finally {
    loadingMembers.value = false
  }
})
</script>

<template>
  <div class="-m-6 flex flex-col h-full">

    <!-- ── Loading state ──────────────────────────────────────────── -->
    <template v-if="loadingTeam">
      <div class="flex items-center gap-4 px-5 py-4 border-b border-border bg-background shrink-0">
        <Skeleton class="size-11 rounded-xl" />
        <div class="flex flex-col gap-2 flex-1">
          <Skeleton class="h-5 w-40 rounded" />
          <Skeleton class="h-3 w-24 rounded" />
        </div>
      </div>
      <div class="flex flex-col mt-2">
        <div v-for="n in 4" :key="n" class="flex items-center gap-4 px-5 py-3.5 border-b border-border">
          <Skeleton class="size-8 rounded-full" />
          <div class="flex flex-col gap-1.5 flex-1">
            <Skeleton class="h-4 w-36 rounded" />
            <Skeleton class="h-3 w-48 rounded" />
          </div>
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
      </div>
    </template>

    <!-- ── Not found ──────────────────────────────────────────────── -->
    <template v-else-if="!team">
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <p class="text-[15px] font-semibold text-foreground">Team not found</p>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/app/org"><ArrowLeft class="size-3.5 mr-1.5" />Back to Organization</NuxtLink>
        </Button>
      </div>
    </template>

    <!-- ── Team found ─────────────────────────────────────────────── -->
    <template v-else>

      <!-- Team header -->
      <div class="flex items-center gap-4 px-5 py-4 border-b border-border bg-background shrink-0">
        <TeamAvatar :name="team.name" size="lg" />
        <div class="flex-1 min-w-0">
          <h1 class="text-[16px] font-semibold text-foreground">{{ team.name }}</h1>
          <p class="text-[12px] text-muted-foreground mt-0.5">
            {{ members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Team workspace' }}
          </p>
        </div>
        <Button variant="outline" size="sm" class="h-8 text-[12.5px] gap-1.5" as-child>
          <NuxtLink to="/app/org?tab=teams"><ArrowLeft class="size-3.5" />All Teams</NuxtLink>
        </Button>
      </div>

      <!-- Sub-toolbar -->
      <div class="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
        <div class="flex-1">
          <span class="text-[12.5px] font-medium text-foreground">
            Members
            <span class="ml-1 text-muted-foreground/60 text-[12px]">({{ members.length }})</span>
          </span>
        </div>
        <Button size="sm" class="h-8 text-[12.5px] gap-1.5">
          <UserPlus class="size-3.5" /> Add Member
        </Button>
      </div>

      <!-- Members content -->
      <div class="flex-1 overflow-auto">

        <!-- Loading -->
        <div v-if="loadingMembers" class="flex flex-col">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 px-5 py-3.5 border-b border-border">
            <Skeleton class="size-8 rounded-full shrink-0" />
            <div class="flex flex-col gap-1.5 flex-1">
              <Skeleton class="h-4 w-36 rounded" />
              <Skeleton class="h-3 w-48 rounded" />
            </div>
            <Skeleton class="h-5 w-16 rounded-full" />
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="members.length === 0" class="flex flex-col items-center justify-center py-28 gap-5">
          <div class="size-[72px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
            <Users class="size-8 text-muted-foreground/40" />
          </div>
          <div class="text-center">
            <p class="text-[15px] font-semibold text-foreground">No members in this team</p>
            <p class="text-[13px] text-muted-foreground mt-1">
              Add members from the
              <NuxtLink to="/app/org" class="text-foreground underline underline-offset-2 hover:no-underline">Organization</NuxtLink>
              page.
            </p>
          </div>
        </div>

        <!-- Members table -->
        <table v-else class="w-full text-[13px]">
          <thead class="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              <th class="px-5 py-3 text-left font-medium text-muted-foreground">Member</th>
              <th class="px-3 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th class="px-3 py-3 text-left font-medium text-muted-foreground">Joined</th>
              <th class="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in members"
              :key="m.id"
              class="border-b border-border hover:bg-muted/30 transition-colors group"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    class="size-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    :style="{ background: memberColor(m) }"
                  >
                    {{ memberInitials(m) }}
                  </div>
                  <div>
                    <p class="font-medium text-foreground">{{ m.full_name ?? m.email }}</p>
                    <p v-if="m.full_name" class="text-[11.5px] text-muted-foreground">{{ m.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3.5">
                <span
                  class="inline-flex items-center text-[11.5px] font-medium px-2 py-0.5 rounded-full capitalize"
                  :class="roleBadgeClass(m.role ?? '')"
                >
                  {{ m.role ?? '—' }}
                </span>
              </td>
              <td class="px-3 py-3.5 text-muted-foreground">
                {{ m.created_at ? new Date(m.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
              </td>
              <td class="px-5 py-3.5 text-right">
                <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                  <MoreHorizontal class="size-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </template>

  </div>
</template>
