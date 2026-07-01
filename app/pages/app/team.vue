<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { Users, Mail } from '@lucide/vue'

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
  <div class="-m-6 flex h-[calc(100vh-44px)]">

    <!-- ── Left config panel ── -->
    <div class="w-[360px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">

      <div class="px-5 pt-5 pb-4 border-b border-border">
        <div class="flex items-center gap-2 mb-0.5">
          <Users class="size-4 text-muted-foreground" />
          <h1 class="text-[15px] font-semibold text-foreground">My Team</h1>
        </div>
        <p class="text-[12.5px] text-muted-foreground">Invite employees to your team</p>
      </div>

      <div class="flex flex-col gap-4 px-5 py-5 flex-1">

        <div class="flex flex-col gap-1.5">
          <label class="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Email address</label>
          <Input
            v-model="inviteEmail"
            type="email"
            placeholder="employee@company.com"
            @keydown.enter.prevent="sendInvite"
          />
        </div>

        <Card size="sm">
          <CardContent class="px-3.5 py-3 text-[12px] text-muted-foreground">
            Invited members join as <span class="font-semibold text-foreground">employees</span> — they can submit and track their own expenses. You review and approve as their manager.
          </CardContent>
        </Card>

        <div class="mt-auto pt-4 border-t border-border">
          <Button :disabled="loading" class="w-full gap-2" @click="sendInvite">
            <svg v-if="loading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <Mail v-else class="size-4 shrink-0" />
            {{ loading ? 'Sending…' : 'Send invite' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- ── Right panel: team members ── -->
    <div class="flex-1 bg-muted/30 flex flex-col overflow-auto">

      <div v-if="members.length === 0" class="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
        <div class="size-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-1">
          <Users class="size-6 text-muted-foreground/50" />
        </div>
        <p class="text-[14px] font-semibold text-foreground">No team members yet</p>
        <p class="text-[12.5px] text-muted-foreground max-w-[280px]">Invite employees from the panel on the left — they'll show up here once they accept.</p>
      </div>

      <div v-else class="p-6 flex flex-col gap-3 max-w-[640px] w-full mx-auto">
        <div class="flex items-center justify-between mb-1">
          <p class="text-[13px] font-semibold text-foreground">Team members</p>
          <span class="text-[12px] text-muted-foreground">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</span>
        </div>

        <Card v-for="m in members" :key="m.id" size="sm">
          <CardContent class="px-4 py-3 flex items-center gap-4">
            <div class="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span class="text-[13px] font-semibold text-muted-foreground">{{ m.user_id.slice(0, 2).toUpperCase() }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-foreground font-mono">{{ m.user_id.slice(0, 8) }}…</p>
              <p class="text-[11.5px] text-muted-foreground capitalize">{{ m.role }}</p>
            </div>
            <Badge
              :variant="m.role === 'employee' ? 'secondary' : 'outline'"
              class="capitalize"
            >{{ m.role }}</Badge>
          </CardContent>
        </Card>
      </div>
    </div>

  </div>
</template>
