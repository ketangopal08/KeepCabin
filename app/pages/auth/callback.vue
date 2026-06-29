<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'

definePageMeta({ layout: false })

const supabase = useSupabase()

onMounted(() => {
  // Supabase processes the hash/code from the URL automatically on client init.
  // Listen for the SIGNED_IN event then redirect.
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      navigateTo('/app', { replace: true })
    }
  })

  // Fallback: if session already established (e.g. fast redirect)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) navigateTo('/app', { replace: true })
  })
})
</script>

<template>
  <div class="min-h-screen bg-[#0e0e10] flex items-center justify-center">
    <div class="flex flex-col items-center gap-4 text-white/40 text-sm">
      <div class="size-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      Signing you in…
    </div>
  </div>
</template>
