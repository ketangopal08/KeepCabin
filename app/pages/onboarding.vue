<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: false })

const supabase = useSupabase()
const orgName = ref('')
const orgSize = ref('1-10')
const loading = ref(false)

const sizes = ['1-10', '11-50', '51-200', '200+']

async function handleCreate() {
  if (!orgName.value.trim()) { toast.error('Please enter your company name.'); return }
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/orgs/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { name: orgName.value.trim(), size: orgSize.value },
    })
    toast.success('Organization created!')
    await navigateTo('/app')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Something went wrong.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { navigateTo('/login'); return }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white px-4">
    <Sonner position="bottom-right" theme="light" rich-colors />
    <div class="w-full max-w-[420px] flex flex-col gap-6">
      <div class="flex items-center gap-2">
        <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
        <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
      </div>
      <div>
        <h1 class="text-2xl font-normal text-gray-800">Set up your organization</h1>
        <p class="text-sm text-gray-500 mt-1">You'll be the owner. Invite your team next.</p>
      </div>
      <form class="flex flex-col gap-4" @submit.prevent="handleCreate">
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-gray-500">Company name</label>
          <input
            v-model="orgName"
            type="text"
            placeholder="Acme Corp"
            class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-gray-500">Company size</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="s in sizes" :key="s"
              type="button"
              :class="[
                'px-4 py-2 rounded-xl text-sm border transition-all',
                orgSize === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              ]"
              @click="orgSize = s"
            >{{ s }}</button>
          </div>
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50"
        >
          {{ loading ? 'Creating…' : 'Create organization' }}
        </button>
      </form>
    </div>
  </div>
</template>
