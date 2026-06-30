<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: false })

const route = useRoute()
const supabase = useSupabase()
const token = route.query.token as string

const inviteInfo = ref<{ email: string; role: string; org_name: string; team_name: string | null } | null>(null)
const loading = ref(true)
const accepting = ref(false)
const error = ref('')

onMounted(async () => {
  if (!token) { error.value = 'Invalid invite link.'; loading.value = false; return }
  try {
    inviteInfo.value = await $fetch<{ email: string; role: string; org_name: string; team_name: string | null }>('/api/invites/validate' as string, { query: { token } })
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Invalid or expired invite.'
  } finally {
    loading.value = false
  }
})

async function acceptInvite() {
  accepting.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo(`/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`); return }
    await $fetch('/api/invites/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { token },
    })
    toast.success('You have joined the organization!')
    await navigateTo('/app')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Something went wrong.')
  } finally {
    accepting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white px-4">
    <Sonner position="bottom-right" theme="light" rich-colors />
    <div class="w-full max-w-[420px] flex flex-col gap-6">
      <div class="flex items-center gap-2">
        <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
        <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
      </div>

      <div v-if="loading" class="text-sm text-gray-500">Checking invite…</div>

      <div v-else-if="error" class="flex flex-col gap-3">
        <p class="text-sm text-red-600">{{ error }}</p>
        <NuxtLink to="/login" class="text-sm text-gray-500 underline">Go to login</NuxtLink>
      </div>

      <div v-else-if="inviteInfo" class="flex flex-col gap-4">
        <div>
          <h1 class="text-2xl font-normal text-gray-800">You've been invited</h1>
          <p class="text-sm text-gray-500 mt-1">
            Join <strong class="text-gray-800">{{ inviteInfo.org_name }}</strong>
            as a <strong class="text-gray-800 capitalize">{{ inviteInfo.role }}</strong>
            <template v-if="inviteInfo.team_name"> in <strong class="text-gray-800">{{ inviteInfo.team_name }}</strong></template>.
          </p>
        </div>
        <button
          :disabled="accepting"
          class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50"
          @click="acceptInvite"
        >
          {{ accepting ? 'Joining…' : 'Accept invite' }}
        </button>
      </div>
    </div>
  </div>
</template>
