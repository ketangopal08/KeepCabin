<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'

// Mobile version of /app/teams — data copied from app/pages/app/teams/index.vue.
definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

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

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

async function fetchTeams() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  try {
    teams.value = await $fetch<Team[]>('/api/teams', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } finally {
    loading.value = false
  }
}

onMounted(fetchTeams)
</script>

<template>
  <div>
  <MobilePullToRefresh :on-refresh="fetchTeams">
    <MobilePageHeader title="Teams" back="/m/settings">
      <template #action>
        <!-- Web shows this owner-only button without an action yet; kept identical. -->
        <Button v-if="role === 'owner'" variant="secondary" size="icon-lg" class="m-press rounded-full" aria-label="New team" @click="haptic">
          <Icon name="solar:add-linear" class="size-5" />
        </Button>
      </template>
    </MobilePageHeader>

    <div class="flex flex-col gap-5">
      <!-- ── Hero card ─────────────────────────────────────────────── -->
      <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
        <div class="flex items-center gap-2 text-[12.5px] text-background/70">
          <Icon name="solar:users-group-rounded-linear" class="size-4" /> All teams
        </div>
        <Skeleton v-if="loading" class="mt-2 h-8 w-16 rounded-lg bg-background/15" />
        <p v-else class="mt-1.5 text-[28px] font-semibold leading-none tabular-nums">{{ teams.length }}</p>
        <p v-if="ctx?.org?.name" class="mt-2 truncate text-[12.5px] capitalize text-background/70">{{ ctx.org.name }}</p>
      </Card>

      <!-- ── Search ────────────────────────────────────────────────── -->
      <div class="m-rise relative" style="--d: 120ms">
        <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="search"
          type="search"
          placeholder="Search teams"
          class="h-13 rounded-full pl-11 text-base transition-shadow md:text-base focus-visible:shadow-[0_6px_24px_-10px_rgba(0,0,0,0.25)]"
        />
      </div>

      <!-- ── List ──────────────────────────────────────────────────── -->
      <section class="m-rise" style="--d: 180ms">
        <div v-if="loading" class="flex flex-col gap-3">
          <Skeleton v-for="n in 5" :key="n" class="h-[72px] rounded-3xl" />
        </div>

        <Card v-else-if="filtered.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
          <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
          <p class="text-sm font-medium text-foreground">{{ search ? 'No teams found' : 'No teams yet' }}</p>
          <p class="text-[12.5px] text-muted-foreground">
            {{ search ? 'Try a different search term.' : 'Create your first team to get started.' }}
          </p>
          <Button v-if="role === 'owner' && !search" variant="outline" class="m-press mt-2 h-11 gap-1.5 rounded-full px-5" @click="haptic">
            <Icon name="solar:add-linear" class="size-4" /> New team
          </Button>
        </Card>

        <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-3">
          <NuxtLink
            v-for="(team, i) in filtered"
            :key="team.id"
            :to="`/m/teams/${team.id}`"
            class="m-press m-rise block"
            :style="{ '--d': `${200 + i * 50}ms` }"
            @click="haptic"
          >
            <Card class="flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
              <TeamAvatar :name="team.name" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[14px] font-semibold text-foreground">{{ team.name }}</p>
                <p class="text-[11.5px] text-muted-foreground">Created {{ fmtDate(team.created_at) }}</p>
              </div>
              <Icon name="solar:alt-arrow-right-linear" class="size-5 shrink-0 text-muted-foreground" />
            </Card>
          </NuxtLink>
        </TransitionGroup>
        <p v-if="!loading && filtered.length" class="mt-3 text-center text-[11.5px] text-muted-foreground">
          Showing {{ filtered.length }} of {{ teams.length }} teams
        </p>
      </section>
    </div>
  </MobilePullToRefresh>
  </div>
</template>
