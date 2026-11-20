<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { isFinanceTeamName } from '~~/lib/teamRoles'
import { personColor, personInitials } from '~/utils/avatarColors'

// Mobile version of /app/teams/[id] — data + actions copied from app/pages/app/teams/[id].vue.
definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

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
const confirmManager = ref<any | null>(null)
const confirmOpen = computed({
  get: () => !!confirmManager.value,
  set: (v: boolean) => { if (!v) confirmManager.value = null },
})

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

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

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

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
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

async function loadAll() {
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
}

onMounted(async () => {
  await load()
  await loadAll()
})

// Premium (crown): at the member cap, "Invite member" leads to the upgrade page instead
const { membersAtCap, load: loadBilling, refresh: refreshBilling } = useBilling()
onMounted(() => loadBilling())

function openInvite() {
  haptic()
  if (membersAtCap.value) { navigateTo('/m/upgrade'); return }
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

async function confirmSetManager() {
  const m = confirmManager.value
  if (!m) return
  haptic()
  await setAsManager(m)
  confirmManager.value = null
}
</script>

<template>
  <div>
  <MobilePullToRefresh :on-refresh="loadAll">
    <MobilePageHeader :title="team?.name ?? 'Team'" subtitle="Team" back="/m/org">
      <template #action>
        <Button v-if="team && canInvite" variant="secondary" size="icon-lg" class="m-press relative rounded-full" aria-label="Invite member" @click="openInvite">
          <Icon name="solar:user-plus-linear" class="size-5" />
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="absolute -top-0.5 -right-0.5 size-4 text-amber-500" />
        </Button>
      </template>
    </MobilePageHeader>

    <!-- ── Loading ───────────────────────────────────────────────── -->
    <div v-if="loadingTeam" class="flex flex-col gap-5">
      <Skeleton class="h-[200px] rounded-3xl" />
      <div class="flex flex-col gap-3">
        <Skeleton v-for="n in 4" :key="n" class="h-[72px] rounded-3xl" />
      </div>
    </div>

    <!-- ── Not found ─────────────────────────────────────────────── -->
    <Card v-else-if="!team" class="m-rise items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
      <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
      <p class="text-sm font-medium text-foreground">Team not found</p>
      <Button variant="outline" class="m-press mt-2 h-11 gap-1.5 rounded-full px-5" as-child>
        <NuxtLink to="/m/org"><Icon name="solar:arrow-left-linear" class="size-4" />Back to Organization</NuxtLink>
      </Button>
    </Card>

    <!-- ── Team found ────────────────────────────────────────────── -->
    <div v-else class="flex flex-col gap-5">
      <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
        <div class="flex items-center gap-3">
          <TeamAvatar :name="team.name" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[20px] font-semibold leading-tight">{{ team.name }}</p>
            <p class="text-[12.5px] text-background/70">
              {{ members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Team workspace' }}
            </p>
          </div>
        </div>

        <div v-if="(isFinanceTeam && financeHeads.length) || currentManager" class="mt-4 rounded-2xl bg-background/10 px-4 py-3">
          <template v-if="isFinanceTeam && financeHeads.length">
            <p class="text-[11.5px] text-background/70">Finance manager{{ financeHeads.length > 1 ? 's' : '' }}</p>
            <p class="truncate text-[13px] font-semibold">{{ financeHeads.map(m => m.full_name ?? m.email).join(', ') }}</p>
          </template>
          <template v-else-if="currentManager">
            <p class="text-[11.5px] text-background/70">Manager</p>
            <p class="truncate text-[13px] font-semibold">{{ currentManager.full_name ?? currentManager.email }}</p>
          </template>
        </div>

        <Button
          v-if="canInvite"
          class="m-press mt-5 h-12 w-full rounded-full bg-background/90 font-semibold text-foreground hover:bg-background"
          @click="openInvite"
        >
          <Icon name="solar:user-plus-linear" class="size-5" /> Invite member
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
        </Button>
      </Card>

      <section class="m-rise" style="--d: 120ms">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-[15px] font-semibold text-foreground">Members</h2>
          <span class="text-[12.5px] tabular-nums text-muted-foreground">{{ members.length }}</span>
        </div>

        <div v-if="loadingMembers" class="flex flex-col gap-3">
          <Skeleton v-for="n in 4" :key="n" class="h-[72px] rounded-3xl" />
        </div>

        <Card v-else-if="members.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
          <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
          <p class="text-sm font-medium text-foreground">No members in this team</p>
          <p class="text-[12.5px] text-muted-foreground">
            <template v-if="canInvite">
              Use the <Button variant="link" class="h-auto p-0 text-[12.5px] text-foreground underline" @click="openInvite">Invite member</Button> button to add someone.
            </template>
            <template v-else>
              Ask your organization owner to add members.
            </template>
          </p>
        </Card>

        <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-3">
          <Card
            v-for="(m, i) in members"
            :key="m.id"
            class="m-rise gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0"
            :style="{ '--d': `${160 + i * 50}ms` }"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                :style="{ background: personColor(m.email) }"
              >
                {{ personInitials(m.full_name ?? m.email) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <p class="truncate text-[14px] font-semibold text-foreground">{{ m.full_name ?? m.email }}</p>
                  <Icon v-if="m.role === 'manager' && isOwner" name="solar:crown-linear" class="size-3.5 shrink-0 text-blue-500" />
                </div>
                <p v-if="m.full_name" class="truncate text-[11.5px] text-muted-foreground">{{ m.email }}</p>
                <p class="text-[11.5px] text-muted-foreground">Joined {{ fmtDate(m.created_at) }}</p>
              </div>
              <Badge :variant="roleVariant(m.role ?? '')" class="shrink-0 rounded-full capitalize">{{ m.role ?? '—' }}</Badge>
            </div>

            <!-- Owner only -->
            <Button
              v-if="isOwner && !isFinanceTeam && m.role !== 'manager' && m.role !== 'owner'"
              variant="outline"
              size="sm"
              class="m-press h-9 w-full gap-1.5 rounded-full text-[13px]"
              :disabled="changingManager"
              @click="haptic(); confirmManager = m"
            >
              <Icon name="solar:crown-linear" class="size-4" />
              Set as manager
            </Button>
          </Card>
        </TransitionGroup>
        <p v-if="!loadingMembers && members.length" class="mt-3 text-center text-[11.5px] text-muted-foreground">
          Showing {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
        </p>
      </section>
    </div>
  </MobilePullToRefresh>

  <!-- ═══════════════ Invite sheet ═══════════════ -->
  <Sheet v-model:open="inviteOpen">
    <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl px-5 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)">
      <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
      <SheetHeader class="px-0 text-left">
        <SheetTitle class="text-[17px] font-semibold">Invite to {{ team?.name }}</SheetTitle>
        <SheetDescription class="text-[13px]">Send an email invite to add someone to this team.</SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-4 pb-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-[12.5px] font-medium text-foreground">Email address</label>
          <Input
            v-model="inviteEmail"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="colleague@company.com"
            class="h-12 rounded-2xl text-base md:text-base"
            @keydown.enter="sendInvite"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[12.5px] font-medium text-foreground">Role</label>
          <div class="flex flex-col gap-2">
            <Button
              v-for="r in availableRoles"
              :key="r"
              variant="outline"
              class="m-press h-auto w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left whitespace-normal"
              :class="inviteRole === r ? 'border-foreground bg-muted/40' : 'border-border'"
              @click="inviteRole = r; haptic()"
            >
              <span class="flex min-w-0 flex-col items-start">
                <span class="text-[13px] font-semibold capitalize text-foreground">{{ isFinanceTeam && r === 'finance' ? 'Finance manager' : r }}</span>
                <span class="text-[11.5px] font-normal leading-tight text-muted-foreground">{{ roleDesc(r) }}</span>
              </span>
              <Icon
                :name="inviteRole === r ? 'solar:check-circle-bold' : 'solar:check-circle-linear'"
                class="size-5 shrink-0"
                :class="inviteRole === r ? 'text-foreground' : 'text-muted-foreground/40'"
              />
            </Button>
          </div>
        </div>

        <p v-if="inviteError" class="text-[12px] text-destructive">{{ inviteError }}</p>
      </div>

      <div class="flex flex-col gap-2">
        <Button :disabled="inviteLoading || !inviteEmail.trim()" class="m-press h-13 w-full rounded-full text-[15px] font-semibold" @click="sendInvite">
          <Icon v-if="inviteLoading" name="solar:refresh-linear" class="size-4.5 animate-spin" />
          <Icon v-else name="solar:letter-linear" class="size-4.5" />
          {{ inviteLoading ? 'Sending…' : 'Send invite' }}
        </Button>
        <Button variant="ghost" class="h-11 w-full rounded-full" @click="inviteOpen = false">Cancel</Button>
      </div>
    </SheetContent>
  </Sheet>

  <!-- ═══════════════ Set-as-manager confirmation ═══════════════ -->
  <Dialog v-model:open="confirmOpen">
    <DialogContent class="max-w-[calc(100%-2rem)] rounded-3xl p-5">
      <DialogHeader class="text-left">
        <DialogTitle>Set as manager?</DialogTitle>
        <DialogDescription>
          <span class="font-medium text-foreground">{{ confirmManager?.full_name ?? confirmManager?.email }}</span>
          will approve expenses for {{ team?.name }}.
          <template v-if="currentManager">
            {{ currentManager.full_name ?? currentManager.email }} will become an employee.
          </template>
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-2">
        <Button :disabled="changingManager" class="m-press h-12 w-full rounded-full font-semibold" @click="confirmSetManager">
          <Icon v-if="changingManager" name="solar:refresh-linear" class="size-4.5 animate-spin" />
          <Icon v-else name="solar:crown-linear" class="size-4.5" />
          Set as manager
        </Button>
        <Button variant="ghost" class="h-11 w-full rounded-full" :disabled="changingManager" @click="confirmManager = null">Cancel</Button>
      </div>
    </DialogContent>
  </Dialog>
  </div>
</template>
