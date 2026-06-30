<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
onMounted(load)

const members = ref<{ id: string; user_id: string; role: string }[]>([])
const inviteEmail = ref('')
const loading = ref(false)

async function fetchMembers() {
  if (!ctx.value?.member?.team_id) return
  const { data, error } = await supabase
    .from('org_members')
    .select('id, user_id, role')
    .eq('team_id', ctx.value.member.team_id)
  if (error) { console.error(error); return }
  members.value = data ?? []
}

async function sendInvite() {
  if (!inviteEmail.value.trim()) { toast.error('Email required'); return }
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/invites/send' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { email: inviteEmail.value.trim(), role: 'employee' },
    })
    toast.success(`Invite sent to ${inviteEmail.value}`)
    inviteEmail.value = ''
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to send invite')
  } finally {
    loading.value = false
  }
}

watch(() => ctx.value, fetchMembers, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-6 max-w-xl">
    <h1 class="text-xl font-semibold text-gray-900">My Team</h1>

    <div v-if="members.length === 0" class="text-sm text-gray-400">No members yet — invite some employees.</div>
    <div v-for="m in members" :key="m.id" class="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 flex items-center justify-between">
      <span class="text-gray-500 text-xs font-mono">{{ m.user_id.slice(0,8) }}…</span>
      <span class="capitalize text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">{{ m.role }}</span>
    </div>

    <div class="flex gap-2">
      <input
        v-model="inviteEmail"
        type="email"
        placeholder="employee@company.com"
        class="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400"
        @keydown.enter.prevent="sendInvite"
      />
      <button
        :disabled="loading"
        class="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
        @click="sendInvite"
      >
        {{ loading ? '…' : 'Invite' }}
      </button>
    </div>
  </div>
</template>
