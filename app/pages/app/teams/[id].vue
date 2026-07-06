<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'
import { Users, UserPlus, ArrowLeft, Crown, Mail } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route   = useRoute()
const supabase = useSupabase()
const { ctx, load } = useOrgContext()

const team    = ref<Team | null>(null)
const members = ref<any[]>([])
const loadingTeam    = ref(true)
const loadingMembers = ref(true)

// Invite
const inviteOpen    = ref(false)
const inviteEmail   = ref('')
const inviteRole    = ref<'manager' | 'finance' | 'employee'>('manager')
const inviteLoading = ref(false)
const inviteError   = ref('')

// Change manager
const changingManager = ref(false)

const isOwner   = computed(() => ctx.value?.member.role === 'owner')
const isManager = computed(() => ctx.value?.member.role === 'manager')
const canInvite = computed(() => isOwner.value || isManager.value)

const availableRoles = computed(() => isOwner.value ? (['manager', 'finance', 'employee'] as const) : (['employee'] as const))
const currentManager = computed(() => members.value.find(m => m.role === 'manager'))

const PALETTE = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']

function colorFromStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % PALETTE.length
  return PALETTE[h]
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

function roleDesc(r: string) {
  if (r === 'manager') return 'Approves expenses'
  if (r === 'finance') return 'Processes payments'
  return 'Submits expenses'
}

async function loadMembers(token: string) {
  loadingMembers.value = true
  try {
    members.value = await $fetch<any[]>(`/api/teams/${route.params.id}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch { /* silent */ } finally {
    loadingMembers.value = false
  }
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

  await loadMembers(session.access_token)
})

function openInvite() {
  inviteEmail.value = ''
  inviteRole.value = isOwner.value ? 'manager' : 'employee'
  inviteError.value = ''
  inviteOpen.value = true
}

async function sendInvite() {
  if (!inviteEmail.value.trim()) { inviteError.value = 'Email is required'; return }
  inviteLoading.value = true
  inviteError.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    await $fetch('/api/invites/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        email: inviteEmail.value.trim(),
        role: inviteRole.value,
        team_id: route.params.id,
      },
    })
    inviteOpen.value = false
  } catch (e: any) {
    inviteError.value = e?.data?.message ?? e?.message ?? 'Failed to send invite'
  } finally {
    inviteLoading.value = false
  }
}

async function setAsManager(member: any) {
  if (!isOwner.value || changingManager.value || member.role === 'manager') return
  changingManager.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const token = session.access_token

    if (currentManager.value) {
      await $fetch(`/api/members/${currentManager.value.id}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: { role: 'employee' },
      })
    }
    await $fetch(`/api/members/${member.id}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: { role: 'manager' },
    })
    await loadMembers(token)
  } catch (e: any) {
    console.error('Failed to change manager:', e)
  } finally {
    changingManager.value = false
  }
}
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
            <template v-if="currentManager">
              · Manager: <span class="text-foreground font-medium">{{ currentManager.full_name ?? currentManager.email }}</span>
            </template>
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
        <Button v-if="canInvite" size="sm" class="h-8 text-[12.5px] gap-1.5" @click="openInvite">
          <UserPlus class="size-3.5" /> Invite Member
        </Button>
      </div>

      <!-- Members content -->
      <div class="flex-1 overflow-auto">

        <!-- Loading members -->
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
              <template v-if="canInvite">
                Use the <button class="text-foreground underline underline-offset-2 hover:no-underline" @click="openInvite">Invite Member</button> button to add someone.
              </template>
              <template v-else>
                Ask your organization owner to add members.
              </template>
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
              <th class="w-32 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in members"
              :key="m.id"
              class="border-b border-border hover:bg-muted/30 transition-colors group"
            >
              <!-- Member info -->
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    class="size-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    :style="{ background: memberColor(m) }"
                  >
                    {{ memberInitials(m) }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <p class="font-medium text-foreground">{{ m.full_name ?? m.email }}</p>
                      <Crown
                        v-if="m.role === 'manager' && isOwner"
                        class="size-3 text-blue-500 shrink-0"
                      />
                    </div>
                    <p v-if="m.full_name" class="text-[11.5px] text-muted-foreground">{{ m.email }}</p>
                  </div>
                </div>
              </td>

              <!-- Role badge -->
              <td class="px-3 py-3.5">
                <span
                  class="inline-flex items-center text-[11.5px] font-medium px-2 py-0.5 rounded-full capitalize"
                  :class="roleBadgeClass(m.role ?? '')"
                >
                  {{ m.role ?? '—' }}
                </span>
              </td>

              <!-- Joined date -->
              <td class="px-3 py-3.5 text-muted-foreground">
                {{ m.created_at ? new Date(m.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
              </td>

              <!-- Actions (owner only) -->
              <td class="px-5 py-3.5 text-right">
                <Button
                  v-if="isOwner && m.role !== 'manager' && m.role !== 'owner'"
                  variant="ghost"
                  size="xs"
                  class="opacity-0 group-hover:opacity-100 text-[11.5px] h-7 gap-1 text-muted-foreground hover:text-foreground"
                  :disabled="changingManager"
                  @click="setAsManager(m)"
                >
                  <Crown class="size-3" />
                  Set as Manager
                </Button>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════
         Invite Member Dialog
    ════════════════════════════════════════════════════════════ -->
    <Dialog v-model:open="inviteOpen">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Invite to {{ team?.name }}</DialogTitle>
          <DialogDescription>
            Send an email invite to add someone to this team.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-1">
          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium text-foreground">Email address</label>
            <Input
              v-model="inviteEmail"
              type="email"
              placeholder="colleague@company.com"
              @keydown.enter="sendInvite"
            />
          </div>

          <!-- Role selector -->
          <div class="flex flex-col gap-2">
            <label class="text-[12.5px] font-medium text-foreground">Role</label>
            <div class="grid gap-2" :class="availableRoles.length === 3 ? 'grid-cols-3' : availableRoles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'">
              <button
                v-for="r in availableRoles"
                :key="r"
                class="flex flex-col items-start px-3.5 py-3 rounded-xl border-2 transition-all text-left"
                :class="inviteRole === r
                  ? 'border-foreground bg-muted/30'
                  : 'border-border hover:border-muted-foreground/50'"
                @click="inviteRole = r"
              >
                <span class="text-[12.5px] font-semibold text-foreground capitalize">{{ r }}</span>
                <span class="text-[11px] text-muted-foreground mt-0.5 leading-tight">{{ roleDesc(r) }}</span>
              </button>
            </div>
          </div>

          <p v-if="inviteError" class="text-[12px] text-destructive">{{ inviteError }}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="inviteOpen = false">Cancel</Button>
          <Button :disabled="inviteLoading || !inviteEmail.trim()" @click="sendInvite">
            <svg v-if="inviteLoading" class="animate-spin size-3.5 mr-1.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <Mail v-else class="size-3.5 mr-1.5" />
            {{ inviteLoading ? 'Sending…' : 'Send invite' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
