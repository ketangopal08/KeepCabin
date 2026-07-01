<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { Building2, Users, ChevronRight, Plus } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
onMounted(load)

const teams = ref<{ id: string; name: string }[]>([])
const newTeamName = ref('')
const inviteEmail = ref('')
const inviteRole = ref<'manager' | 'finance' | 'employee'>('manager')
const inviteTeamId = ref('')
const loading = ref(false)
const activeSection = ref<'teams' | 'invite'>('invite')

// Owner can invite manager/finance. Manager can only invite employee.
const availableRoles = computed(() => {
  if (ctx.value?.member?.role === 'manager') return ['employee']
  return ['manager', 'finance']
})

// Reset role when available roles change
watch(availableRoles, (roles) => {
  if (!roles.includes(inviteRole.value)) {
    inviteRole.value = roles[0] as 'manager' | 'finance' | 'employee'
  }
}, { immediate: true })

function setSection(s: string) { activeSection.value = s as 'teams' | 'invite' }
function setInviteRole(r: string) { inviteRole.value = r as 'manager' | 'finance' | 'employee' }

async function fetchTeams() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    teams.value = await $fetch<{ id: string; name: string }[]>('/api/teams' as string, {
      headers: { Authorization: `Bearer ${session!.access_token}` },
    })
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to load teams')
  }
}

async function createTeam() {
  if (!newTeamName.value.trim()) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/teams' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { name: newTeamName.value.trim() },
    })
    newTeamName.value = ''
    await fetchTeams()
    toast.success('Team created')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to create team')
  }
}

async function sendInvite() {
  if (!inviteEmail.value.trim()) { toast.error('Email required'); return }
  if (inviteRole.value === 'manager' && !inviteTeamId.value) {
    toast.error('Select a team for the manager'); return
  }
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/invites/send' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: {
        email: inviteEmail.value.trim(),
        role: inviteRole.value,
        team_id: inviteRole.value === 'manager' ? inviteTeamId.value : undefined,
      },
    })
    toast.success(`Invite sent to ${inviteEmail.value}`)
    inviteEmail.value = ''
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to send invite')
  } finally {
    loading.value = false
  }
}

onMounted(fetchTeams)
</script>

<template>
  <div class="-m-6 flex h-[calc(100vh-44px)]">

    <!-- ── Left config panel ── -->
    <div class="w-[360px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">

      <div class="px-5 pt-5 pb-4 border-b border-border">
        <div class="flex items-center gap-2 mb-0.5">
          <Building2 class="size-4 text-muted-foreground" />
          <h1 class="text-[15px] font-semibold text-foreground">Organization</h1>
        </div>
        <p class="text-[12.5px] text-muted-foreground">{{ ctx?.org?.name ?? 'Manage your workspace' }}</p>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-border">
        <button
          v-for="s in [{ id: 'invite', label: 'Invite member' }, { id: 'teams', label: 'Teams' }]"
          :key="s.id"
          :class="[
            'flex-1 py-2.5 text-[12.5px] font-medium transition-colors',
            activeSection === s.id
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          @click="setSection(s.id)"
        >{{ s.label }}</button>
      </div>

      <!-- Invite section -->
      <div v-if="activeSection === 'invite'" class="flex flex-col gap-4 px-5 py-5 flex-1">

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Email address</label>
          <Input v-model="inviteEmail" type="email" placeholder="colleague@company.com" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
          <div class="grid grid-cols-3 gap-1.5">
            <Button
              v-for="r in ['employee', 'manager', 'finance']"
              :key="r"
              :variant="inviteRole === r ? 'default' : 'outline'"
              size="sm"
              class="capitalize"
              @click="setInviteRole(r)"
            >{{ r }}</Button>
          </div>
        </div>

        <div v-if="inviteRole === 'manager'" class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Assign to team</label>
          <select
            v-model="inviteTeamId"
            class="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors appearance-none text-foreground"
          >
            <option value="">Select team…</option>
            <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <div class="mt-auto pt-4 border-t border-border">
          <Button :disabled="loading" class="w-full" @click="sendInvite">
            <svg v-if="loading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            {{ loading ? 'Sending…' : 'Send invite' }}
          </Button>
        </div>
      </div>

      <!-- Teams section -->
      <div v-else class="flex flex-col gap-4 px-5 py-5 flex-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">New team</label>
          <div class="flex gap-2">
            <Input v-model="newTeamName" placeholder="e.g. Engineering, Sales…" class="flex-1" @keydown.enter.prevent="createTeam" />
            <Button size="icon" @click="createTeam">
              <Plus class="size-4" />
            </Button>
          </div>
        </div>

        <div v-if="teams.length === 0" class="text-[12.5px] text-muted-foreground">No teams yet — create one above.</div>
        <div v-else class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Existing teams</label>
          <div
            v-for="t in teams"
            :key="t.id"
            class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-border bg-muted/30"
          >
            <div class="size-6 rounded-md bg-muted flex items-center justify-center">
              <Users class="size-3.5 text-muted-foreground" />
            </div>
            <span class="text-[13px] text-foreground flex-1">{{ t.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Right preview panel ── -->
    <div class="flex-1 bg-muted/30 flex flex-col items-center justify-center overflow-auto px-8">
      <div class="w-full max-w-[440px] flex flex-col gap-4">

        <!-- Org overview -->
        <Card>
          <CardContent class="pt-5 pb-5">
            <div class="flex items-center gap-4 mb-4">
              <div class="size-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                {{ (ctx?.org?.name ?? 'KC').slice(0, 2).toUpperCase() }}
              </div>
              <div>
                <p class="text-[15px] font-semibold text-foreground">{{ ctx?.org?.name ?? 'Your Organization' }}</p>
                <p class="text-[12.5px] text-muted-foreground mt-0.5 capitalize">{{ ctx?.member?.role ?? 'Owner' }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-0.5 px-4 py-3 rounded-lg bg-muted/50 border border-border">
                <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Teams</span>
                <span class="text-[22px] font-bold text-foreground">{{ teams.length }}</span>
              </div>
              <div class="flex flex-col gap-0.5 px-4 py-3 rounded-lg bg-muted/50 border border-border">
                <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Your role</span>
                <Badge variant="outline" class="mt-1 w-fit capitalize">{{ ctx?.member?.role ?? '—' }}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Teams list -->
        <Card v-if="teams.length > 0">
          <CardHeader class="pb-2 pt-4 px-4">
            <CardTitle class="text-[13px]">Teams</CardTitle>
          </CardHeader>
          <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-0">
            <div
              v-for="t in teams"
              :key="t.id"
              class="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
            >
              <div class="size-7 rounded-md bg-muted flex items-center justify-center">
                <Users class="size-3.5 text-muted-foreground" />
              </div>
              <span class="text-[13px] text-foreground flex-1">{{ t.name }}</span>
              <ChevronRight class="size-3.5 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <!-- Empty state -->
        <Card v-else>
          <CardContent class="py-8 flex flex-col items-center text-center gap-3">
            <div class="size-12 rounded-xl bg-muted flex items-center justify-center mb-1">
              <Users class="size-5 text-muted-foreground" />
            </div>
            <p class="text-[13.5px] font-semibold text-foreground">No teams yet</p>
            <p class="text-[12.5px] text-muted-foreground max-w-[260px]">Create teams to assign managers and organize your expense workflow.</p>
          </CardContent>
        </Card>

      </div>
    </div>

  </div>
</template>
