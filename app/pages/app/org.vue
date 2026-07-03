<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { UserPlus, Users, Mail, MoreHorizontal, Settings2, ArrowUpRight } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()

type Tab = 'members' | 'teams' | 'invites'
const activeTab = ref<Tab>('members')
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

onMounted(async () => {
  await load()
  await Promise.all([fetchTeams(), fetchMembers()])
})
</script>

<template>
  <div class="-m-6 flex flex-col h-full">

    <!-- ── Sub-toolbar ─────────────────────────────────────────────── -->
    <div class="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
      <div class="flex items-center gap-0.5 flex-1 min-w-0">
        <button
          v-for="tab in [
            { id: 'members', label: 'Members' },
            { id: 'teams',   label: 'Teams'   },
            { id: 'invites', label: 'Invites'  },
          ]"
          :key="tab.id"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium shrink-0 transition-colors"
          :class="activeTab === tab.id
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
          @click="setTab(tab.id)"
        >{{ tab.label }}</button>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <Button v-if="activeTab === 'teams'" size="sm" class="h-8 text-[12.5px] gap-1.5" @click="showTeamDialog = true">
          <Users class="size-3.5" /> New Team
        </Button>
        <Button v-else size="sm" class="h-8 text-[12.5px] gap-1.5" @click="showInviteDialog = true">
          <UserPlus class="size-3.5" /> Invite Member
        </Button>
      </div>
    </div>

    <!-- ── Quick-action cards ──────────────────────────────────────── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border-b border-border shrink-0">

      <button
        class="flex items-center gap-4 px-5 py-4 bg-background hover:bg-muted/40 transition-colors text-left"
        @click="showInviteDialog = true"
      >
        <div class="size-10 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0">
          <UserPlus class="size-5 text-white" />
        </div>
        <div class="min-w-0">
          <p class="text-[13px] font-semibold text-foreground">Invite member</p>
          <p class="text-[11.5px] text-muted-foreground truncate">Add to your organization</p>
        </div>
      </button>

      <button
        class="flex items-center gap-4 px-5 py-4 bg-background hover:bg-muted/40 transition-colors text-left"
        @click="showTeamDialog = true"
      >
        <div class="size-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
          <Users class="size-5 text-white" />
        </div>
        <div class="min-w-0">
          <p class="text-[13px] font-semibold text-foreground">New team</p>
          <p class="text-[11.5px] text-muted-foreground truncate">Create a department or group</p>
        </div>
      </button>

      <button
        class="flex items-center gap-4 px-5 py-4 bg-background hover:bg-muted/40 transition-colors text-left"
        @click="setTab('invites')"
      >
        <div class="size-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
          <Mail class="size-5 text-white" />
        </div>
        <div class="min-w-0">
          <p class="text-[13px] font-semibold text-foreground">Pending invites</p>
          <p class="text-[11.5px] text-muted-foreground truncate">Review sent invitations</p>
        </div>
      </button>

      <NuxtLink
        to="/app/settings"
        class="flex items-center gap-4 px-5 py-4 bg-background hover:bg-muted/40 transition-colors text-left"
      >
        <div class="size-10 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
          <Settings2 class="size-5 text-white" />
        </div>
        <div class="min-w-0">
          <p class="text-[13px] font-semibold text-foreground">Org settings</p>
          <p class="text-[11.5px] text-muted-foreground truncate">Configure your workspace</p>
        </div>
      </NuxtLink>

    </div>

    <!-- ── Content ─────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-auto">

      <!-- Members ──────────────────────────────────────────────────── -->
      <template v-if="activeTab === 'members'">
        <div v-if="loadingMembers" class="flex flex-col">
          <div v-for="n in 6" :key="n" class="flex items-center gap-4 px-5 py-3.5 border-b border-border">
            <Skeleton class="size-8 rounded-full shrink-0" />
            <div class="flex flex-col gap-1.5 flex-1">
              <Skeleton class="h-4 w-36 rounded" />
              <Skeleton class="h-3 w-48 rounded" />
            </div>
            <Skeleton class="h-5 w-16 rounded-full" />
          </div>
        </div>

        <div v-else-if="members.length === 0" class="flex flex-col items-center justify-center py-28 gap-5">
          <div class="size-[72px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
            <Users class="size-8 text-muted-foreground/40" />
          </div>
          <div class="text-center">
            <p class="text-[15px] font-semibold text-foreground">No members yet</p>
            <p class="text-[13px] text-muted-foreground mt-1">Invite someone to join your organization.</p>
          </div>
          <Button size="sm" @click="showInviteDialog = true">
            <UserPlus class="size-3.5 mr-1.5" /> Invite Member
          </Button>
        </div>

        <table v-else class="w-full text-[13px]">
          <thead class="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              <th class="px-5 py-3 text-left font-medium text-muted-foreground">Member</th>
              <th class="px-3 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th class="px-3 py-3 text-left font-medium text-muted-foreground">Team</th>
              <th class="px-3 py-3 text-left font-medium text-muted-foreground">Joined</th>
              <th class="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id"
              class="border-b border-border hover:bg-muted/30 transition-colors group">
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="size-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    :style="{ background: memberColor(m) }">
                    {{ memberInitials(m) }}
                  </div>
                  <div>
                    <p class="font-medium text-foreground">{{ m.full_name ?? m.email }}</p>
                    <p v-if="m.full_name" class="text-[11.5px] text-muted-foreground">{{ m.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3.5">
                <span class="inline-flex items-center text-[11.5px] font-medium px-2 py-0.5 rounded-full capitalize"
                  :class="roleBadgeClass(m.role ?? '')">
                  {{ m.role ?? '—' }}
                </span>
              </td>
              <td class="px-3 py-3.5 text-muted-foreground">{{ m.team_name ?? '—' }}</td>
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
      </template>

      <!-- Teams ────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'teams'">
        <div v-if="loadingTeams" class="flex flex-col">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 px-5 py-4 border-b border-border">
            <Skeleton class="size-9 rounded-xl shrink-0" />
            <Skeleton class="h-4 w-28 rounded flex-1" />
            <Skeleton class="h-5 w-14 rounded-full" />
          </div>
        </div>

        <div v-else-if="teams.length === 0" class="flex flex-col items-center justify-center py-28 gap-5">
          <div class="size-[72px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
            <Users class="size-8 text-muted-foreground/40" />
          </div>
          <div class="text-center">
            <p class="text-[15px] font-semibold text-foreground">No teams yet</p>
            <p class="text-[13px] text-muted-foreground mt-1">Create teams to organize members and assign managers.</p>
          </div>
          <Button size="sm" @click="showTeamDialog = true">
            <Users class="size-3.5 mr-1.5" /> New Team
          </Button>
        </div>

        <table v-else class="w-full text-[13px]">
          <thead class="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              <th class="px-5 py-3 text-left font-medium text-muted-foreground">Team</th>
              <th class="px-3 py-3 text-left font-medium text-muted-foreground">Created</th>
              <th class="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            <NuxtLink
              v-for="t in teams"
              :key="t.id"
              as="tr"
              :to="`/app/teams/${t.id}`"
              class="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="size-9 rounded-xl flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                    :style="{ background: teamColor(t.name) }">
                    {{ teamInitials(t.name) }}
                  </div>
                  <p class="font-medium text-foreground">{{ t.name }}</p>
                </div>
              </td>
              <td class="px-3 py-3.5 text-muted-foreground">
                {{ t.created_at ? new Date(t.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
              </td>
              <td class="px-5 py-3.5 text-right">
                <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                  <ArrowUpRight class="size-4" />
                </button>
              </td>
            </NuxtLink>
          </tbody>
        </table>
      </template>

      <!-- Invites ──────────────────────────────────────────────────── -->
      <template v-else>
        <div class="flex flex-col items-center justify-center py-28 gap-5">
          <div class="size-[72px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
            <Mail class="size-8 text-muted-foreground/40" />
          </div>
          <div class="text-center">
            <p class="text-[15px] font-semibold text-foreground">No pending invites</p>
            <p class="text-[13px] text-muted-foreground mt-1">Invite someone and their invitation will appear here.</p>
          </div>
          <Button size="sm" @click="showInviteDialog = true">
            <Mail class="size-3.5 mr-1.5" /> Send Invite
          </Button>
        </div>
      </template>

    </div>

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
            <div
              class="size-11 rounded-xl flex items-center justify-center text-[13px] font-bold text-white shrink-0"
              :style="{ background: teamColor(newTeamName) }"
            >
              {{ teamInitials(newTeamName) }}
            </div>
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

  </div>
</template>
