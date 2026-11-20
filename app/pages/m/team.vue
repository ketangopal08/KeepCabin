<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { personColor, personInitials } from '~/utils/avatarColors'

// Mobile version of /app/team — data + actions copied from app/pages/app/team.vue.
definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
onMounted(load)

const members = ref<{ id: string; user_id: string; role: string; email: string | null; full_name: string | null }[]>([])
const inviteEmail = ref('')
const loading = ref(false)
const showInvite = ref(false)


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

function openInvite() {
  if (membersAtCap.value) { navigateTo('/m/upgrade'); return }
  showInvite.value = true
}

async function sendInvite() {
  if (membersAtCap.value) { navigateTo('/m/upgrade'); return }
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
    showInvite.value = false
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

async function refreshAll() {
  await Promise.all([fetchMembers(), refreshBilling()])
}
</script>

<template>
  <div>
  <MobilePullToRefresh :on-refresh="refreshAll">
    <MobilePageHeader title="My Team" :subtitle="ctx?.team?.name ?? undefined" back="/m/settings">
      <template #action>
        <Button variant="secondary" size="icon-lg" class="m-press relative rounded-full" aria-label="Invite employee" @click="openInvite">
          <Icon name="solar:user-plus-linear" class="size-5" />
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="absolute -top-0.5 -right-0.5 size-4 text-amber-500" />
        </Button>
      </template>
    </MobilePageHeader>

    <div class="flex flex-col gap-5">
      <!-- ── Hero card ─────────────────────────────────────────────── -->
      <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
        <div class="flex items-center gap-3">
          <TeamAvatar v-if="ctx?.team?.name" :name="ctx.team.name" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="text-[12.5px] text-background/70">Team members</p>
            <p class="text-[28px] font-semibold leading-none tabular-nums">{{ members.length }}</p>
          </div>
        </div>
        <p class="mt-4 text-[12.5px] leading-relaxed text-background/70">
          Invited members join as <span class="font-medium text-background">employees</span> — they can submit and track their own expenses. You review and approve as their manager.
        </p>
        <Button
          class="m-press mt-5 h-12 w-full rounded-full bg-background/90 font-semibold text-foreground hover:bg-background"
          @click="openInvite"
        >
          <Icon name="solar:user-plus-linear" class="size-5" /> Invite employee
          <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
        </Button>
      </Card>

      <!-- ── Members ───────────────────────────────────────────────── -->
      <section class="m-rise" style="--d: 120ms">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-[15px] font-semibold text-foreground">Members</h2>
          <span class="text-[12.5px] tabular-nums text-muted-foreground">{{ members.length }}</span>
        </div>

        <Card v-if="members.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
          <Icon name="solar:users-group-rounded-linear" class="size-7 text-muted-foreground" />
          <p class="text-sm font-medium text-foreground">No team members yet</p>
          <p class="text-[12.5px] text-muted-foreground">Invite employees above — they'll show up here once they accept.</p>
        </Card>

        <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-3">
          <Card
            v-for="(m, i) in members"
            :key="m.id"
            class="m-rise flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0"
            :style="{ '--d': `${160 + i * 50}ms` }"
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              :style="{ background: personColor(m.email ?? m.user_id) }"
            >
              {{ personInitials(m.full_name ?? m.email) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] font-semibold text-foreground">{{ m.full_name ?? m.email ?? 'Unknown' }}</p>
              <p v-if="m.full_name && m.email" class="truncate text-[11.5px] text-muted-foreground">{{ m.email }}</p>
            </div>
            <Badge :variant="m.role === 'employee' ? 'neutral' : 'info'" class="shrink-0 rounded-full capitalize">{{ m.role }}</Badge>
          </Card>
        </TransitionGroup>
        <p v-if="members.length" class="mt-3 text-center text-[11.5px] text-muted-foreground">
          Showing {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
        </p>
      </section>
    </div>
  </MobilePullToRefresh>

  <!-- ═══════════════ Invite sheet ═══════════════ -->
  <Sheet v-model:open="showInvite">
    <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl px-5 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)">
      <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
      <SheetHeader class="px-0 text-left">
        <SheetTitle class="text-[17px] font-semibold">Invite employee</SheetTitle>
        <SheetDescription class="text-[13px]">
          Invited members join as <span class="font-medium text-foreground">employees</span> — they can submit and track their own expenses.
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-3 pb-2">
        <!-- Context card -->
        <Card class="flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
          <div class="min-w-0 flex-1">
            <p class="truncate text-[16px] font-semibold text-foreground">{{ ctx?.team?.name ?? 'My Team' }}</p>
            <p class="mt-0.5 text-[13px] text-muted-foreground">{{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}</p>
          </div>
          <div v-if="members.length" class="flex shrink-0 -space-x-2">
            <div
              v-for="m in members.slice(0, 3)"
              :key="m.id"
              class="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background"
              :style="{ background: personColor(m.email ?? m.user_id) }"
            >{{ personInitials(m.full_name ?? m.email) }}</div>
            <div
              v-if="members.length > 3"
              class="flex size-8 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-foreground ring-2 ring-background"
            >+{{ members.length - 3 }}</div>
          </div>
          <TeamAvatar v-else-if="ctx?.team?.name" :name="ctx.team.name" size="md" />
        </Card>

        <MobileField label="Email address" icon="solar:letter-linear" input-id="team-invite-email">
          <Input
            id="team-invite-email"
            v-model="inviteEmail"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="employee@company.com"
            class="m-field-input"
            @keydown.enter.prevent="sendInvite"
          />
        </MobileField>
      </div>

      <MobileSubmitButton placement="sheet" :loading="loading" @click="sendInvite">
        <Icon v-if="!loading" name="solar:letter-linear" class="size-4.5" />
        {{ loading ? 'Sending…' : 'Send invite' }}
        <Icon v-if="membersAtCap" name="solar:crown-linear" class="size-4 text-amber-500" />
      </MobileSubmitButton>
      <Button variant="ghost" class="mt-1 h-11 w-full rounded-full" @click="showInvite = false">Cancel</Button>
    </SheetContent>
  </Sheet>
  </div>
</template>
