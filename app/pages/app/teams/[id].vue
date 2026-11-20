<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { isFinanceTeamName } from '~~/lib/teamRoles'

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

// Finance team: everyone in it gets the finance role (the server enforces this too)
const isFinanceTeam = computed(() => isFinanceTeamName(team.value?.name))
const availableRoles = computed(() =>
  !isOwner.value ? (['employee'] as const)
    : isFinanceTeam.value ? (['finance'] as const)
    : (['manager', 'finance', 'employee'] as const))
const financeHeads = computed(() => members.value.filter(m => m.role === 'finance'))
const currentManager = computed(() => members.value.find(m => m.role === 'manager'))

const PALETTE = AVATAR_COLORS

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

function roleVariant(r: string) {
  if (r === 'owner')   return 'warning'
  if (r === 'manager') return 'info'
  if (r === 'finance') return 'success'
  return 'neutral'
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

// Premium (crown): at the member cap, "Invite member" leads to the upgrade page instead
const { membersAtCap, load: loadBilling, refresh: refreshBilling } = useBilling()
onMounted(() => loadBilling())

function openInvite() {
  if (membersAtCap.value) { navigateTo('/app/upgrade'); return }
  inviteEmail.value = ''
  inviteRole.value = isOwner.value ? (isFinanceTeam.value ? 'finance' : 'manager') : 'employee'
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
    toast.success(`Invite sent to ${inviteEmail.value.trim()}`)
    refreshBilling()
  } catch (e: any) {
    if (showPlanLimitToast(e)) return
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
  <AppPage>

    <!-- ── Loading state ──────────────────────────────────────────── -->
    <template v-if="loadingTeam">
      <Skeleton class="mb-4 h-4 w-24 rounded" />
      <div class="mb-7 flex items-center gap-3">
        <Skeleton class="size-10 rounded-xl" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-7 w-48 rounded" />
          <Skeleton class="h-4 w-32 rounded" />
        </div>
      </div>
      <Skeleton class="mb-5 h-10 w-full rounded" />
      <div class="flex flex-col">
        <div v-for="n in 4" :key="n" class="flex items-center gap-4 border-b border-border px-2 py-3.5">
          <Skeleton class="size-8 rounded-full" />
          <div class="flex flex-1 flex-col gap-1.5">
            <Skeleton class="h-4 w-36 rounded" />
            <Skeleton class="h-3 w-48 rounded" />
          </div>
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
      </div>
    </template>

    <!-- ── Not found ──────────────────────────────────────────────── -->
    <template v-else-if="!team">
      <div class="flex flex-col items-center justify-center gap-4 py-28">
        <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
        <p class="text-[15px] text-foreground">Team not found</p>
        <Button variant="outline" class="h-9 gap-1.5 rounded-lg px-4" as-child>
          <NuxtLink to="/app/org"><Icon name="solar:arrow-left-linear" class="size-4" />Back to Organization</NuxtLink>
        </Button>
      </div>
    </template>

    <!-- ── Team found ─────────────────────────────────────────────── -->
    <template v-else>

      <!-- Header -->
      <AppPageHeader :title="team.name" :back="{ label: 'All teams', to: '/app/org?tab=teams' }">
        <template #leading>
          <TeamAvatar :name="team.name" size="lg" />
        </template>
        <template #description>
          {{ members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Team workspace' }}
          <template v-if="isFinanceTeam && financeHeads.length">
            · Finance manager{{ financeHeads.length > 1 ? 's' : '' }}: <span class="font-medium text-foreground">{{ financeHeads.map(m => m.full_name ?? m.email).join(', ') }}</span>
          </template>
          <template v-else-if="currentManager">
            · Manager: <span class="font-medium text-foreground">{{ currentManager.full_name ?? currentManager.email }}</span>
          </template>
        </template>
        <template #actions>
          <Button v-if="canInvite" class="h-9 gap-1.5 rounded-lg px-4" @click="openInvite">
            <Icon name="solar:user-plus-linear" class="size-4" /> Invite member
            <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
          </Button>
        </template>
      </AppPageHeader>

      <!-- Tabs -->
      <AppPageTabs model-value="members" :tabs="[{ id: 'members', label: 'Members', count: members.length }]" />

      <AppTableCard>
        <!-- Loading members -->
        <div v-if="loadingMembers" class="flex flex-col">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 border-b border-border px-2 py-3.5">
            <Skeleton class="size-8 shrink-0 rounded-full" />
            <div class="flex flex-1 flex-col gap-1.5">
              <Skeleton class="h-4 w-36 rounded" />
              <Skeleton class="h-3 w-48 rounded" />
            </div>
            <Skeleton class="h-5 w-16 rounded-full" />
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="members.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
          <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
          <p class="text-[15px] text-foreground">No members in this team</p>
          <p class="-mt-1.5 text-sm text-muted-foreground">
            <template v-if="canInvite">
              Use the <Button variant="link" class="h-auto p-0 text-sm text-foreground underline" @click="openInvite">Invite member</Button> button to add someone.
            </template>
            <template v-else>
              Ask your organization owner to add members.
            </template>
          </p>
        </div>

        <!-- Members table -->
        <Table v-else>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead class="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="m in members" :key="m.id" class="group border-border">
              <!-- Member info -->
              <TableCell>
                <div class="flex items-center gap-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    :style="{ background: memberColor(m) }"
                  >
                    {{ memberInitials(m) }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <p class="text-sm font-medium text-foreground">{{ m.full_name ?? m.email }}</p>
                      <Icon name="solar:crown-linear" v-if="m.role === 'manager' && isOwner" class="size-3 shrink-0 text-blue-500" />
                    </div>
                    <p v-if="m.full_name" class="text-[12.5px] text-muted-foreground">{{ m.email }}</p>
                  </div>
                </div>
              </TableCell>

              <!-- Role badge -->
              <TableCell>
                <Badge :variant="roleVariant(m.role ?? '')" class="capitalize">
                  {{ m.role ?? '—' }}
                </Badge>
              </TableCell>

              <!-- Joined date -->
              <TableCell class="text-muted-foreground">
                {{ m.created_at ? new Date(m.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
              </TableCell>

              <!-- Actions (owner only) -->
              <TableCell class="text-right">
                <Button
                  v-if="isOwner && !isFinanceTeam && m.role !== 'manager' && m.role !== 'owner'"
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1 rounded-lg px-3 text-[13px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                  :disabled="changingManager"
                  @click="setAsManager(m)"
                >
                  <Icon name="solar:crown-linear" class="size-3.5" />
                  Set as manager
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
          <template #footer>
            Showing {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
          </template>
        </Table>
      </AppTableCard>
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
                <span class="text-[12.5px] font-semibold text-foreground capitalize">{{ isFinanceTeam && r === 'finance' ? 'Finance manager' : r }}</span>
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
            <Icon name="solar:letter-linear" v-else class="size-3.5 mr-1.5" />
            {{ inviteLoading ? 'Sending…' : 'Send invite' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </AppPage>
</template>
