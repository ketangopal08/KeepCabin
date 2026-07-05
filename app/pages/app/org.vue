<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { UserPlus, Users, Mail, Settings2, ChevronRight } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()

type Tab = 'members' | 'teams' | 'invites'
const activeTab = ref<Tab>('teams')
function setTab(id: string) { activeTab.value = id as Tab }

const role = computed(() => ctx.value?.member?.role)

// Teams
const teams = ref<{ id: string; name: string; created_at?: string }[]>([])
const loadingTeams = ref(true)

// Members
const members = ref<any[]>([])
const loadingMembers = ref(true)

// ── Invite dialog ────────────────────────────────────────────────────────────
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

// ── Create team dialog ───────────────────────────────────────────────────────
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
    toast.success('Team created')
  } catch (e: any) {
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
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to send invite')
  } finally { inviteLoading.value = false }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function memberInitials(m: any) {
  const n = m.full_name ?? m.email ?? '?'
  return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function colorFromStr(s: string, palette: string[]) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % palette.length
  return palette[h]
}

const PALETTE = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']

function memberColor(m: any) { return colorFromStr(m.email ?? '?', PALETTE) }
function teamColor(name: string) { return colorFromStr(name, PALETTE) }
function teamInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function roleBadgeClass(r: string) {
  if (r === 'owner')   return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400'
  if (r === 'manager') return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400'
  if (r === 'finance') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400'
  return 'text-muted-foreground bg-muted'
}

function roleDesc(r: string) {
  if (r === 'employee') return 'Can submit expenses and view their own history.'
  if (r === 'manager')  return 'Can approve expenses for their team.'
  if (r === 'finance')  return 'Can mark approved expenses as paid.'
  return ''
}

// ── Team active toggle (local state until API supports it) ───────────────────
const teamActiveState = ref<Record<string, boolean>>({})
function isTeamActive(id: string) { return teamActiveState.value[id] !== false }
function toggleTeamActive(id: string) {
  teamActiveState.value[id] = !isTeamActive(id)
}

onMounted(async () => {
  await load()
  await Promise.all([fetchTeams(), fetchMembers()])
})
</script>

<template>
  <div class="flex flex-col w-full min-w-0 px-28 py-1">
    <div class="w-full max-w-5xl mx-auto flex flex-col">

    <!-- ── Page header ───────────────────────────────────────────── -->
    <div class="mb-7">
      <h1 class="text-[17px] font-semibold text-foreground">Organization</h1>
      <p class="text-[12.5px] text-muted-foreground mt-0.5">
        Manage members and teams for <span class="font-medium text-foreground">{{ ctx?.org?.name }}</span>
      </p>
    </div>


    <!-- ── List panel ───────────────────────────────────────────────── -->
    <div class="rounded-xl border border-border bg-card overflow-hidden flex flex-col w-full">

        <!-- tab bar -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div class="flex items-center gap-0.5 bg-muted/60 p-1 rounded-lg">
            <button
              v-for="tab in [{ id: 'teams', label: 'Teams' }, { id: 'members', label: 'Members' }]"
              :key="tab.id"
              class="px-4 py-1 rounded-md text-[12.5px] font-medium transition-all duration-150"
              :class="activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="setTab(tab.id)"
            >{{ tab.label }}</button>
          </div>
          <Button v-if="activeTab === 'teams'" size="sm" class="gap-1.5 h-8 text-[12.5px]" @click="showTeamDialog = true">
            <Users class="size-3.5" /> New Team
          </Button>
          <Button v-else size="sm" class="gap-1.5 h-8 text-[12.5px]" @click="showInviteDialog = true">
            <UserPlus class="size-3.5" /> Invite Member
          </Button>
        </div>

        <!-- list area -->
        <div class="p-4 flex flex-col gap-2.5">

          <!-- ── TEAMS TAB ──────────────────────────────────── -->
          <template v-if="activeTab === 'teams'">

            <!-- loading skeletons -->
            <div v-if="loadingTeams" class="flex flex-col gap-2.5">
              <div v-for="n in 3" :key="n" class="rounded-xl border border-border p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <Skeleton class="size-8 rounded-xl shrink-0" />
                    <Skeleton class="h-4 w-28 rounded" />
                  </div>
                  <Skeleton class="h-5 w-14 rounded-full" />
                </div>
                <Skeleton class="h-3 w-48 rounded mb-3" />
                <Skeleton class="h-3 w-32 rounded" />
              </div>
            </div>

            <!-- empty -->
            <div v-else-if="teams.length === 0" class="rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-3 py-14">
              <div class="size-11 rounded-xl bg-muted flex items-center justify-center">
                <Users class="size-5 text-muted-foreground" />
              </div>
              <p class="text-[13px] font-medium text-foreground">No teams yet</p>
              <p class="text-[12px] text-muted-foreground text-center max-w-[220px]">Create teams to group members and assign managers.</p>
              <Button size="sm" class="mt-1 gap-1.5" @click="showTeamDialog = true">
                <Users class="size-3.5" /> New Team
              </Button>
            </div>

            <!-- flat list rows -->
            <div v-else class="-mx-4 -mb-4">
              <NuxtLink
                v-for="(t, i) in teams"
                :key="t.id"
                :to="`/app/teams/${t.id}`"
                class="kc-row flex items-center gap-3.5 px-4 py-3.5 border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                :style="{ animationDelay: `${i * 55}ms` }"
              >
                <TeamAvatar :name="t.name" size="md" />

                <div class="flex-1 min-w-0">
                  <p class="text-[13.5px] font-semibold text-foreground leading-snug truncate">{{ t.name }}</p>
                  <p class="text-[12px] text-muted-foreground truncate mt-0.5">
                    {{ members.filter(m => m.team_name === t.name).length || 'No' }} member{{ members.filter(m => m.team_name === t.name).length === 1 ? '' : 's' }}
                    <template v-if="t.created_at"> · {{ new Date(t.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) }}</template>
                  </p>
                </div>

                <!-- member count badge + chevron -->
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {{ members.filter(m => m.team_name === t.name).length }}
                  </span>
                  <ChevronRight class="size-4 text-muted-foreground/50" />
                </div>
              </NuxtLink>
            </div>
          </template>

          <!-- ── MEMBERS TAB ──────────────────────────────────── -->
          <template v-else>

            <!-- loading -->
            <div v-if="loadingMembers" class="flex flex-col gap-2.5">
              <div v-for="n in 4" :key="n" class="rounded-xl border border-border p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <Skeleton class="size-9 rounded-full shrink-0" />
                    <div><Skeleton class="h-3.5 w-28 rounded mb-1.5" /><Skeleton class="h-3 w-36 rounded" /></div>
                  </div>
                  <Skeleton class="h-5 w-16 rounded-full" />
                </div>
                <Skeleton class="h-3 w-32 rounded" />
              </div>
            </div>

            <!-- empty -->
            <div v-else-if="members.length === 0" class="rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-3 py-14">
              <div class="size-11 rounded-xl bg-muted flex items-center justify-center">
                <UserPlus class="size-5 text-muted-foreground" />
              </div>
              <p class="text-[13px] font-medium text-foreground">No members yet</p>
              <p class="text-[12px] text-muted-foreground">Invite someone to join your organization.</p>
              <Button size="sm" class="mt-1 gap-1.5" @click="showInviteDialog = true">
                <UserPlus class="size-3.5" /> Invite Member
              </Button>
            </div>

            <!-- flat member rows -->
            <div v-else class="-mx-4 -mb-4">
              <div
                v-for="(m, i) in members"
                :key="m.id"
                class="kc-row flex items-center gap-3.5 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                :style="{ animationDelay: `${i * 55}ms` }"
              >
                <!-- avatar -->
                <div
                  class="size-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  :style="{ background: memberColor(m) }"
                >{{ memberInitials(m) }}</div>

                <!-- name + meta -->
                <div class="flex-1 min-w-0">
                  <p class="text-[13.5px] font-semibold text-foreground truncate leading-snug">{{ m.full_name ?? m.email }}</p>
                  <p class="text-[12px] text-muted-foreground truncate mt-0.5">
                    {{ m.email }}
                    <template v-if="m.team_name"> · {{ m.team_name }}</template>
                    <template v-if="m.created_at"> · Joined {{ new Date(m.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) }}</template>
                  </p>
                </div>

                <!-- role badge + chevron -->
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize"
                    :class="roleBadgeClass(m.role ?? '')"
                  >{{ m.role ?? '—' }}</span>
                  <ChevronRight class="size-4 text-muted-foreground/50" />
                </div>
              </div>
            </div>
          </template>

        </div><!-- end list area -->
      </div><!-- end panel -->

    <!-- ═══════════════════════════════════════════════════════════════
         Invite Member Dialog
    ════════════════════════════════════════════════════════════════ -->
    <Dialog v-model:open="showInviteDialog">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send an email invite to add someone to
            <span class="font-medium text-foreground">{{ ctx?.org?.name ?? 'your organization' }}</span>.
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
            <div class="grid gap-2" :class="availableRoles.length === 3 ? 'grid-cols-3' : 'grid-cols-1'">
              <button
                v-for="r in availableRoles"
                :key="r"
                class="flex flex-col items-start px-3.5 py-3 rounded-xl border-2 transition-all text-left"
                :class="inviteRole === r
                  ? 'border-foreground bg-muted/30'
                  : 'border-border hover:border-muted-foreground/50'"
                @click="setInviteRole(r)"
              >
                <span class="text-[12.5px] font-semibold text-foreground capitalize">{{ r }}</span>
                <span class="text-[11px] text-muted-foreground mt-0.5 leading-tight">{{ roleDesc(r) }}</span>
              </button>
            </div>
          </div>

          <!-- Team selector (manager only) -->
          <div v-if="inviteRole === 'manager'" class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium text-foreground">
              Assign to team
              <span class="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              v-model="inviteTeamId"
              class="w-full h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground outline-none focus:border-ring transition-colors appearance-none"
            >
              <option value="">No team yet</option>
              <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showInviteDialog = false">Cancel</Button>
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

    <!-- ═══════════════════════════════════════════════════════════════
         Create Team Dialog
    ════════════════════════════════════════════════════════════════ -->
    <Dialog v-model:open="showTeamDialog">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Teams help you organize members and assign managers for expense approvals.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-1">
          <div class="flex flex-col gap-1.5">
            <label class="text-[12.5px] font-medium text-foreground">Team name</label>
            <Input
              v-model="newTeamName"
              placeholder="e.g. Engineering, Sales, Marketing…"
              @keydown.enter="createTeam"
            />
          </div>

          <!-- Live preview -->
          <div
            v-if="newTeamName.trim()"
            class="flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-border bg-muted/20"
          >
            <TeamAvatar :name="newTeamName" size="lg" />
            <div>
              <p class="text-[13.5px] font-semibold text-foreground">{{ newTeamName }}</p>
              <p class="text-[11.5px] text-muted-foreground">New team — no members yet</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showTeamDialog = false; newTeamName = ''">Cancel</Button>
          <Button :disabled="newTeamLoading || !newTeamName.trim()" @click="createTeam">
            <svg v-if="newTeamLoading" class="animate-spin size-3.5 mr-1.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            {{ newTeamLoading ? 'Creating…' : 'Create team' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </div><!-- end container -->
  </div>
</template>

<style scoped>
@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.kc-card, .kc-row {
  animation: slideUpFade 0.22s ease both;
}
</style>
