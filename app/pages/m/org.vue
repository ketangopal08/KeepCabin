<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { personColor, personInitials } from '~/utils/avatarColors'

// Mobile version of /app/org — data + actions copied from app/pages/app/org.vue.
definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()

type Tab = 'members' | 'teams' | 'invites'
const activeTab = ref<Tab>('teams')
function setTab(id: string) { activeTab.value = id as Tab; haptic('selection') }

const role = computed(() => ctx.value?.member?.role)

// Teams
const teams = ref<{ id: string; name: string; created_at?: string }[]>([])
const loadingTeams = ref(true)

// Members
const members = ref<any[]>([])
const loadingMembers = ref(true)

// ── Invite sheet ─────────────────────────────────────────────────────────────
const showInviteDialog = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'manager' | 'finance' | 'employee'>('employee')
const inviteTeamId = ref('')
const inviteLoading = ref(false)

const availableRoles = computed<('employee' | 'manager' | 'finance')[]>(() => {
  if (role.value === 'manager') return ['employee']
  return ['employee', 'manager', 'finance']
})

watch(availableRoles, (roles) => {
  if (!roles.includes(inviteRole.value)) inviteRole.value = roles[0] ?? 'employee'
}, { immediate: true })

function setInviteRole(r: string) { inviteRole.value = r as 'manager' | 'finance' | 'employee' }

// ── Create team sheet ────────────────────────────────────────────────────────
const showTeamDialog = ref(false)
const newTeamName = ref('')
const newTeamLoading = ref(false)


// ── API calls ────────────────────────────────────────────────────────────────
async function fetchTeams() {
  loadingTeams.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    teams.value = await $fetch<{ id: string; name: string; created_at?: string }[]>('/api/teams', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch { /* silent */ } finally { loadingTeams.value = false }
}

async function fetchMembers() {
  loadingMembers.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    members.value = await $fetch<any[]>('/api/members', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch { /* silent */ } finally { loadingMembers.value = false }
}

// Premium (crown): at the plan cap, these buttons lead to the upgrade page instead
const { membersAtCap, teamsAtCap, load: loadBilling, refresh: refreshBilling } = useBilling()
onMounted(() => loadBilling())
function openTeamDialog() {
  if (teamsAtCap.value) { navigateTo('/m/upgrade'); return }
  showTeamDialog.value = true
}
function openInviteDialog() {
  if (membersAtCap.value) { navigateTo('/m/upgrade'); return }
  showInviteDialog.value = true
}

async function createTeam() {
  if (!newTeamName.value.trim()) return
  newTeamLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { name: newTeamName.value.trim() },
    })
    newTeamName.value = ''
    showTeamDialog.value = false
    await fetchTeams()
    refreshBilling()
    toast.success('Team created')
  } catch (e: any) {
    if (showPlanLimitToast(e)) return
    toast.error(e?.data?.message ?? 'Failed to create team')
  } finally { newTeamLoading.value = false }
}

async function sendInvite() {
  if (!inviteEmail.value.trim()) { toast.error('Email required'); return }
  inviteLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/invites/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: {
        email: inviteEmail.value.trim(),
        role: inviteRole.value,
        team_id: inviteRole.value === 'manager' ? (inviteTeamId.value || undefined) : undefined,
      },
    })
    toast.success(`Invite sent to ${inviteEmail.value}`)
    inviteEmail.value = ''
    inviteTeamId.value = ''
    showInviteDialog.value = false
    refreshBilling()
  } catch (e: any) {
    if (showPlanLimitToast(e)) return
    toast.error(e?.data?.message ?? 'Failed to send invite')
  } finally { inviteLoading.value = false }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function roleVariant(r: string) {
  if (r === 'owner')   return 'warning'
  if (r === 'manager') return 'info'
  if (r === 'finance') return 'success'
  return 'neutral'
}

function roleDesc(r: string) {
  if (r === 'employee') return 'Can submit expenses and view their own history.'
  if (r === 'manager')  return 'Can approve expenses for their team.'
  if (r === 'finance')  return 'Can mark approved expenses as paid.'
  return ''
}

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

async function refreshAll() {
  await Promise.all([fetchTeams(), fetchMembers(), refreshBilling()])
}

onMounted(async () => {
  await load()
  await Promise.all([fetchTeams(), fetchMembers()])
})
</script>

<template>
  <div>
  <MobilePullToRefresh :on-refresh="refreshAll">
    <MobilePageHeader title="Organization" :subtitle="ctx?.org?.name ?? undefined" back="/m/settings">
      <template #action>
        <Button
          variant="secondary"
          size="icon-lg"
          class="m-press relative rounded-full"
          :aria-label="activeTab === 'teams' ? 'New team' : 'Invite member'"
          @click="activeTab === 'teams' ? openTeamDialog() : openInviteDialog()"
        >
          <Icon :name="activeTab === 'teams' ? 'solar:add-linear' : 'solar:user-plus-linear'" class="size-5" />
          <Icon
            v-if="activeTab === 'teams' ? teamsAtCap : membersAtCap"
            name="solar:crown-linear"
            class="absolute -top-0.5 -right-0.5 size-4 text-amber-500"
          />
        </Button>
      </template>
    </MobilePageHeader>

  <div class="flex flex-col gap-5">
    <!-- ── Hero card ─────────────────────────────────────────────── -->
    <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
      <div class="flex items-center gap-2 text-[12.5px] text-background/70">
        <Icon name="solar:buildings-2-linear" class="size-4" /> Organization
      </div>
      <Skeleton v-if="!ctx" class="mt-2 h-7 w-40 rounded-lg bg-background/15" />
      <p v-else class="mt-1.5 truncate text-[24px] font-semibold capitalize leading-tight">{{ ctx?.org?.name }}</p>
      <p class="mt-1 text-[12.5px] text-background/70">Manage members and teams</p>

      <div class="mt-5 grid grid-cols-2 gap-3">
        <div class="rounded-2xl bg-background/10 px-4 py-3">
          <p class="text-[11.5px] text-background/70">Teams</p>
          <Skeleton v-if="loadingTeams" class="mt-1 h-6 w-10 rounded bg-background/15" />
          <p v-else class="text-[20px] font-semibold tabular-nums">{{ teams.length }}</p>
        </div>
        <div class="rounded-2xl bg-background/10 px-4 py-3">
          <p class="text-[11.5px] text-background/70">Members</p>
          <Skeleton v-if="loadingMembers" class="mt-1 h-6 w-10 rounded bg-background/15" />
          <p v-else class="text-[20px] font-semibold tabular-nums">{{ members.length }}</p>
        </div>
      </div>

      <Button
        class="m-press mt-4 h-12 w-full rounded-full bg-background/90 font-semibold text-foreground hover:bg-background"
        @click="activeTab === 'teams' ? openTeamDialog() : openInviteDialog()"
      >
        <template v-if="activeTab === 'teams'">
          <Icon name="solar:add-linear" class="size-5" /> New team
          <Icon v-if="teamsAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
        </template>
        <template v-else>
          <Icon name="solar:user-plus-linear" class="size-5" /> Invite member
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
        </template>
      </Button>
    </Card>

    <!-- ── Tabs (segmented) ──────────────────────────────────────── -->
    <div class="m-rise grid grid-cols-2 gap-1 rounded-full bg-muted/60 p-1" style="--d: 120ms">
      <Button
        v-for="t in [
          { id: 'teams', label: 'Teams', count: loadingTeams ? undefined : teams.length },
          { id: 'members', label: 'Members', count: loadingMembers ? undefined : members.length },
        ]"
        :key="t.id"
        variant="ghost"
        class="m-press h-10 rounded-full text-[13px] font-semibold"
        :class="activeTab === t.id ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground'"
        @click="setTab(t.id)"
      >
        {{ t.label }}
        <span v-if="t.count !== undefined" class="tabular-nums text-muted-foreground">{{ t.count }}</span>
      </Button>
    </div>

    <!-- ── TEAMS ─────────────────────────────────────────────────── -->
    <section v-if="activeTab === 'teams'" class="m-rise" style="--d: 180ms">
      <div v-if="loadingTeams" class="flex flex-col gap-3">
        <Skeleton v-for="n in 3" :key="n" class="h-[72px] rounded-3xl" />
      </div>

      <Card v-else-if="teams.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
        <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">No teams yet</p>
        <p class="text-[12.5px] text-muted-foreground">Create teams to group members and assign managers.</p>
        <Button variant="outline" class="m-press mt-2 h-11 gap-1.5 rounded-full px-5" @click="openTeamDialog">
          <Icon name="solar:add-linear" class="size-4" /> New team
          <Icon v-if="teamsAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
        </Button>
      </Card>

      <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-3">
        <NuxtLink
          v-for="(t, i) in teams"
          :key="t.id"
          :to="`/m/teams/${t.id}`"
          class="m-press m-rise block"
          :style="{ '--d': `${200 + i * 50}ms` }"
        >
          <Card class="flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
            <TeamAvatar :name="t.name" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] font-semibold text-foreground">{{ t.name }}</p>
              <p class="text-[11.5px] text-muted-foreground">
                {{ members.filter(m => m.team_name === t.name).length }} members · Created {{ fmtDate(t.created_at) }}
              </p>
            </div>
            <Icon name="solar:alt-arrow-right-linear" class="size-5 shrink-0 text-muted-foreground" />
          </Card>
        </NuxtLink>
      </TransitionGroup>
      <p v-if="!loadingTeams && teams.length" class="mt-3 text-center text-[11.5px] text-muted-foreground">
        Showing {{ teams.length }} {{ teams.length === 1 ? 'team' : 'teams' }}
      </p>
    </section>

    <!-- ── MEMBERS ───────────────────────────────────────────────── -->
    <section v-else class="m-rise" style="--d: 180ms">
      <div v-if="loadingMembers" class="flex flex-col gap-3">
        <Skeleton v-for="n in 4" :key="n" class="h-[72px] rounded-3xl" />
      </div>

      <Card v-else-if="members.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
        <Icon name="solar:user-plus-linear" class="size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">No members yet</p>
        <p class="text-[12.5px] text-muted-foreground">Invite someone to join your organization.</p>
        <Button variant="outline" class="m-press mt-2 h-11 gap-1.5 rounded-full px-5" @click="openInviteDialog">
          <Icon name="solar:user-plus-linear" class="size-4" /> Invite member
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
        </Button>
      </Card>

      <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-3">
        <Card
          v-for="(m, i) in members"
          :key="m.id"
          class="m-rise flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0"
          :style="{ '--d': `${200 + i * 50}ms` }"
        >
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
            :style="{ background: personColor(m.email) }"
          >{{ personInitials(m.full_name ?? m.email) }}</div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] font-semibold text-foreground">{{ m.full_name ?? m.email }}</p>
            <p v-if="m.full_name" class="truncate text-[11.5px] text-muted-foreground">{{ m.email }}</p>
            <p class="truncate text-[11.5px] text-muted-foreground">
              {{ m.team_name ?? 'No team' }} · Joined {{ fmtDate(m.created_at) }}
            </p>
          </div>
          <Badge :variant="roleVariant(m.role ?? '')" class="shrink-0 rounded-full capitalize">{{ m.role ?? '—' }}</Badge>
        </Card>
      </TransitionGroup>
      <p v-if="!loadingMembers && members.length" class="mt-3 text-center text-[11.5px] text-muted-foreground">
        Showing {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
      </p>
    </section>
  </div>
  </MobilePullToRefresh>

  <!-- ═══════════════ Invite member sheet ═══════════════ -->
  <Sheet v-model:open="showInviteDialog">
    <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl px-5 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)">
      <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
      <SheetHeader class="px-0 text-left">
        <SheetTitle class="text-[17px] font-semibold">Invite member</SheetTitle>
        <SheetDescription class="text-[13px]">
          Send an email invite to add someone to
          <span class="font-medium text-foreground">{{ ctx?.org?.name ?? 'your organization' }}</span>.
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-3 pb-2">
        <!-- Context card -->
        <Card class="flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
          <div class="min-w-0 flex-1">
            <p class="truncate text-[16px] font-semibold capitalize text-foreground">{{ ctx?.org?.name ?? 'Your organization' }}</p>
            <p class="mt-0.5 text-[13px] text-muted-foreground">{{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}</p>
          </div>
          <div v-if="members.length" class="flex shrink-0 -space-x-2">
            <div
              v-for="m in members.slice(0, 3)"
              :key="m.id"
              class="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background"
              :style="{ background: personColor(m.email) }"
            >{{ personInitials(m.full_name ?? m.email) }}</div>
            <div
              v-if="members.length > 3"
              class="flex size-8 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-foreground ring-2 ring-background"
            >+{{ members.length - 3 }}</div>
          </div>
        </Card>

        <MobileField label="Email address" icon="solar:letter-linear" input-id="org-invite-email">
          <Input
            id="org-invite-email"
            v-model="inviteEmail"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="colleague@company.com"
            class="m-field-input"
            @keydown.enter="sendInvite"
          />
        </MobileField>

        <!-- Role -->
        <Card class="gap-0 rounded-3xl border border-border p-4 shadow-none ring-0">
          <p class="text-[16px] font-semibold text-foreground">Role</p>
          <p class="mt-0.5 text-[13px] text-muted-foreground">Choose what they can do in your organization.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              v-for="r in availableRoles"
              :key="r"
              :variant="inviteRole === r ? 'outline' : 'secondary'"
              class="m-press h-10 rounded-xl px-4 text-[13px] font-semibold capitalize"
              :class="inviteRole === r ? 'border-2 border-foreground' : 'border-2 border-transparent'"
              @click="setInviteRole(r)"
            >
              {{ r }}
            </Button>
          </div>
          <p class="mt-3 text-[13px] text-muted-foreground">{{ roleDesc(inviteRole) }}</p>
        </Card>

        <!-- Team selector (manager only) -->
        <Card v-if="inviteRole === 'manager'" class="gap-0 rounded-3xl border border-border p-4 shadow-none ring-0">
          <p class="text-[16px] font-semibold text-foreground">Assign to team</p>
          <p class="mt-0.5 text-[13px] text-muted-foreground">Optional — the team this manager will approve for.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              v-for="opt in [{ id: '', name: 'No team yet' }, ...teams]"
              :key="opt.id || 'none'"
              :variant="inviteTeamId === opt.id ? 'outline' : 'secondary'"
              class="m-press h-10 rounded-xl px-4 text-[13px] font-semibold"
              :class="inviteTeamId === opt.id ? 'border-2 border-foreground' : 'border-2 border-transparent'"
              @click="inviteTeamId = opt.id"
            >
              {{ opt.name }}
            </Button>
          </div>
        </Card>
      </div>

      <MobileSubmitButton placement="sheet" :loading="inviteLoading" :disabled="!inviteEmail.trim()" @click="sendInvite">
        <Icon v-if="!inviteLoading" name="solar:letter-linear" class="size-4.5" />
        {{ inviteLoading ? 'Sending…' : 'Send invite' }}
      </MobileSubmitButton>
      <Button variant="ghost" class="mt-1 h-11 w-full rounded-full" @click="showInviteDialog = false">Cancel</Button>
    </SheetContent>
  </Sheet>

  <!-- ═══════════════ Create team sheet ═══════════════ -->
  <Sheet v-model:open="showTeamDialog">
    <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl px-5 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)">
      <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
      <SheetHeader class="px-0 text-left">
        <SheetTitle class="text-[17px] font-semibold">Create team</SheetTitle>
        <SheetDescription class="text-[13px]">
          Teams help you organize members and assign managers for expense approvals.
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-3 pb-2">
        <!-- Context card -->
        <Card class="flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
          <div class="min-w-0 flex-1">
            <p class="truncate text-[16px] font-semibold capitalize text-foreground">{{ ctx?.org?.name ?? 'Your organization' }}</p>
            <p class="mt-0.5 text-[13px] text-muted-foreground">{{ teams.length }} {{ teams.length === 1 ? 'team' : 'teams' }}</p>
          </div>
          <div v-if="teams.length" class="flex shrink-0 -space-x-2">
            <TeamAvatar
              v-for="t in teams.slice(0, 3)"
              :key="t.id"
              :name="t.name"
              size="sm"
              class="ring-2 ring-background"
            />
            <div
              v-if="teams.length > 3"
              class="flex size-7 items-center justify-center rounded-lg bg-background text-[11px] font-semibold text-foreground ring-2 ring-background"
            >+{{ teams.length - 3 }}</div>
          </div>
        </Card>

        <MobileField label="Team name" icon="solar:users-group-rounded-linear" input-id="org-team-name">
          <Input
            id="org-team-name"
            v-model="newTeamName"
            placeholder="e.g. Engineering, Sales, Marketing…"
            class="m-field-input"
            @keydown.enter="createTeam"
          />
        </MobileField>

        <!-- Live preview -->
        <Card v-if="newTeamName.trim()" class="flex-row items-center gap-3.5 rounded-3xl border border-border px-4 py-3.5 shadow-none ring-0">
          <TeamAvatar :name="newTeamName" size="lg" />
          <div class="min-w-0">
            <p class="truncate text-[16px] font-semibold text-foreground">{{ newTeamName }}</p>
            <p class="text-[13px] text-muted-foreground">New team — no members yet</p>
          </div>
        </Card>
      </div>

      <MobileSubmitButton placement="sheet" :loading="newTeamLoading" :disabled="!newTeamName.trim()" @click="createTeam">
        {{ newTeamLoading ? 'Creating…' : 'Create team' }}
      </MobileSubmitButton>
      <Button variant="ghost" class="mt-1 h-11 w-full rounded-full" @click="showTeamDialog = false; newTeamName = ''">Cancel</Button>
    </SheetContent>
  </Sheet>
  </div>
</template>
