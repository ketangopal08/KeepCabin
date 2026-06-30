<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
onMounted(load)

const teams = ref<{ id: string; name: string }[]>([])
const newTeamName = ref('')
const inviteEmail = ref('')
const inviteRole = ref<'manager' | 'finance'>('manager')
const inviteTeamId = ref('')
const loading = ref(false)

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

function setInviteRole(r: string) {
  inviteRole.value = r as 'manager' | 'finance'
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
  <div class="flex flex-col gap-8 max-w-2xl">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Organization</h1>
      <p class="text-sm text-gray-500">{{ ctx?.org?.name }}</p>
    </div>

    <!-- Teams -->
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Teams</h2>
      <div v-if="teams.length === 0" class="text-sm text-gray-400">No teams yet.</div>
      <div v-for="t in teams" :key="t.id" class="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800">
        {{ t.name }}
      </div>
      <div class="flex gap-2">
        <input
          v-model="newTeamName"
          placeholder="New team name"
          class="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400"
          @keydown.enter.prevent="createTeam"
        />
        <button
          class="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all"
          @click="createTeam"
        >Add</button>
      </div>
    </section>

    <!-- Invite -->
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Invite member</h2>
      <div class="flex flex-col gap-3 p-4 rounded-xl border border-gray-200">
        <input
          v-model="inviteEmail"
          type="email"
          placeholder="colleague@company.com"
          class="w-full px-4 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400"
        />
        <div class="flex gap-2">
          <button
            v-for="r in ['manager', 'finance']" :key="r"
            type="button"
            :class="[
              'px-4 py-2 rounded-xl text-sm border transition-all',
              inviteRole === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            ]"
            @click="setInviteRole(r)"
          >{{ r.charAt(0).toUpperCase() + r.slice(1) }}</button>
        </div>
        <select
          v-if="inviteRole === 'manager'"
          v-model="inviteTeamId"
          class="w-full px-4 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400"
        >
          <option value="">Select team…</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <button
          :disabled="loading"
          class="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 self-start"
          @click="sendInvite"
        >
          {{ loading ? 'Sending…' : 'Send invite' }}
        </button>
      </div>
    </section>
  </div>
</template>
