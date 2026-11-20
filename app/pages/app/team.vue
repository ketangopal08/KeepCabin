<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
onMounted(load)

const members = ref<{ id: string; user_id: string; role: string; email: string | null; full_name: string | null }[]>([])
const inviteEmail = ref('')
const loading = ref(false)

async function fetchMembers() {
  const teamId = ctx.value?.member?.team_id
  if (!teamId) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    // Server endpoint returns names + emails (stored in Supabase Auth, not org_members)
    members.value = await $fetch(`/api/teams/${teamId}/members` as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (e) {
    console.error(e)
  }
}

// Premium (crown): at the member cap, the invite button leads to the upgrade page instead
const { membersAtCap, load: loadBilling, refresh: refreshBilling } = useBilling()
onMounted(() => loadBilling())

async function sendInvite() {
  if (membersAtCap.value) { navigateTo('/app/upgrade'); return }
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
    refreshBilling()
    fetchMembers()
  } catch (e: any) {
    if (showPlanLimitToast(e)) return
    toast.error(e?.data?.message ?? 'Failed to send invite')
  } finally {
    loading.value = false
  }
}

watch(() => ctx.value, fetchMembers, { immediate: true })
</script>

<template>
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="My Team" description="Invite employees to your team." />

    <!-- Invite card -->
    <Card class="mb-7 gap-3 rounded-xl px-4 py-4">
      <div class="flex flex-col gap-2 sm:flex-row">
        <Input
          v-model="inviteEmail"
          type="email"
          placeholder="employee@company.com"
          class="h-9 flex-1 rounded-lg text-sm"
          @keydown.enter.prevent="sendInvite"
        />
        <Button :disabled="loading" class="h-9 gap-1.5 rounded-lg px-4" @click="sendInvite">
          <svg v-if="loading" class="size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <Icon name="solar:letter-linear" v-else class="size-4 shrink-0" />
          {{ loading ? 'Sending…' : 'Send invite' }}
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 shrink-0 text-amber-500" />
        </Button>
      </div>
      <p class="text-[13px] text-muted-foreground">
        Invited members join as <span class="font-medium text-foreground">employees</span> — they can submit and track their own expenses. You review and approve as their manager.
      </p>
    </Card>

    <!-- Tabs -->
    <AppPageTabs model-value="members" :tabs="[{ id: 'members', label: 'Members', count: members.length }]" />

    <AppTableCard>
      <!-- Empty -->
      <div v-if="members.length === 0" class="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
        <p class="text-[15px] text-foreground">No team members yet</p>
        <p class="-mt-1.5 max-w-[320px] text-sm text-muted-foreground">Invite employees above — they'll show up here once they accept.</p>
      </div>

      <!-- Members table -->
      <Table v-else>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="m in members" :key="m.id" class="border-border">
            <TableCell>
              <div class="flex items-center gap-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  :style="{ background: personColor(m.email ?? m.user_id) }"
                >
                  {{ personInitials(m.full_name ?? m.email) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-foreground">{{ m.full_name ?? m.email ?? 'Unknown' }}</p>
                  <p v-if="m.full_name && m.email" class="truncate text-[12.5px] text-muted-foreground">{{ m.email }}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="m.role === 'employee' ? 'neutral' : 'info'" class="capitalize">{{ m.role }}</Badge>
            </TableCell>
          </TableRow>
        </TableBody>
        <template #footer>
          Showing {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
        </template>
      </Table>
    </AppTableCard>

  </AppPage>
</template>
