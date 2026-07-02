<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route   = useRoute()
const supabase = useSupabase()

const team    = ref<Team | null>(null)
const loading = ref(true)

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  try {
    const teams = await $fetch<Team[]>('/api/teams', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    team.value = teams.find(t => t.id === route.params.id) ?? null
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="p-8">
    <template v-if="loading">
      <Skeleton class="h-7 w-48 mb-2" />
      <Skeleton class="h-4 w-64" />
    </template>
    <template v-else-if="team">
      <h1 class="text-2xl font-semibold text-foreground">{{ team.name }}</h1>
      <p class="text-sm text-muted-foreground mt-1">Team workspace</p>
    </template>
    <template v-else>
      <p class="text-sm text-muted-foreground">Team not found.</p>
    </template>
  </div>
</template>
