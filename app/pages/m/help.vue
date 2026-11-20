<script setup lang="ts">
definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

type TopicId = 'start' | 'expenses' | 'payments' | 'reports' | 'billing' | 'team'

const topics: { id: TopicId; title: string; desc: string; icon: string }[] = [
  { id: 'start',    title: 'Getting started',       desc: 'Set up your workspace and invite people.',   icon: 'solar:rocket-2-linear' },
  { id: 'expenses', title: 'Expenses & approvals',  desc: 'Submit receipts and get them approved.',     icon: 'solar:bill-list-linear' },
  { id: 'payments', title: 'Payments',              desc: 'Reimburse approved expenses with a UTR.',    icon: 'solar:card-linear' },
  { id: 'reports',  title: 'Reports',               desc: 'Monthly overview and CSV exports.',          icon: 'solar:file-download-linear' },
  { id: 'billing',  title: 'Plans & billing',       desc: 'Trial, limits, upgrades and invoices.',      icon: 'solar:crown-linear' },
  { id: 'team',     title: 'Team & roles',          desc: 'Owners, managers, finance and employees.',   icon: 'solar:users-group-rounded-linear' },
]

const faqs: { topic: TopicId; q: string; a: string }[] = [
  // Getting started
  { topic: 'start', q: 'How do I set up my workspace?', a: 'After signing up you create your organization, add teams (a Finance team is created for you), and choose a plan. You become the workspace owner.' },
  { topic: 'start', q: 'How do I invite people?', a: 'Go to Organization → Invite member, enter their email and pick a role. Managers can also invite employees into their own team. Invites expire after 7 days.' },
  { topic: 'start', q: 'Can I sync receipts from Google Drive?', a: 'Yes, on Pro and Business. Use the Drive sync option to import receipts from a shared Google Drive folder.' },

  // Expenses & approvals
  { topic: 'expenses', q: 'How do I submit an expense?', a: 'Open Submit Expense, snap or upload the receipt, check the amount, vendor, date and category, then submit. KeepCabin reads the receipt for you, so most fields are filled automatically.' },
  { topic: 'expenses', q: 'What happens after I submit?', a: 'The expense goes to your team manager for approval. Once approved it moves to Finance, who pays it and records the UTR. You can follow every step in the expense’s activity log.' },
  { topic: 'expenses', q: 'Why was my expense rejected?', a: 'The rejection reason is shown on the expense. Fix what was asked (for example a clearer receipt or the right category) and submit a new expense.' },
  { topic: 'expenses', q: 'Is there a limit on how many expenses we can submit?', a: 'Free allows 30 expenses a month, Pro 500 and Business unlimited. Counts reset on the 1st of each month (IST).' },

  // Payments
  { topic: 'payments', q: 'How does Finance pay an expense?', a: 'Finance opens Payments, transfers the money from your bank as usual, then enters the UTR (bank reference) in KeepCabin. The expense is marked Paid and the employee is notified.' },
  { topic: 'payments', q: 'Does KeepCabin move money?', a: 'No. KeepCabin tracks approvals and records payments; the actual transfer happens in your own bank.' },

  // Reports
  { topic: 'reports', q: 'How do I export expenses?', a: 'Open Reports, pick a month and click Download CSV. The file includes every expense dated in that month with status, team, vendor, amount and UTR.' },
  { topic: 'reports', q: 'Why can’t I export an older month?', a: 'On the Free plan you can export the current month only. Pro and Business can export any month.' },

  // Plans & billing
  { topic: 'billing', q: 'Is there a free trial?', a: 'Every new workspace gets Pro free for 14 days, no card needed. After that it moves to Free unless you subscribe.' },
  { topic: 'billing', q: 'What are the plan limits?', a: 'Free: 3 members, 1 team plus Finance, 30 expenses a month. Pro: 15 members, unlimited teams, 500 expenses a month. Business: 50 members and unlimited expenses. Enterprise is custom.' },
  { topic: 'billing', q: 'What happens if we go over a limit?', a: 'Nothing is deleted and nobody is removed. New invites, teams or submissions are paused until you upgrade or (for expenses) the month resets.' },
  { topic: 'billing', q: 'How do upgrades and downgrades work?', a: 'Upgrades apply immediately and the unused part of your current plan is refunded. Downgrades take effect at the end of the current billing period.' },
  { topic: 'billing', q: 'How do I pay, and where are my invoices?', a: 'Plans renew automatically via Razorpay (UPI AutoPay, cards or e-mandate). Prices exclude 18% GST. Invoices are in Settings → Billing.' },
  { topic: 'billing', q: 'How do I cancel?', a: 'The workspace owner can cancel in Settings → Billing or on the Upgrade page. Your plan stays active until the end of the paid period.' },

  // Team & roles
  { topic: 'team', q: 'What can each role do?', a: 'Owner manages the workspace, billing and teams. Manager approves expenses for their team. Finance pays approved expenses and exports reports. Employee submits expenses and sees their own history.' },
  { topic: 'team', q: 'How do I change someone’s role or team?', a: 'Owners can change roles from Organization → Members. Team membership and managers are managed from each team’s page.' },
]

const search = ref('')
const activeTopic = ref<TopicId | null>(null)
const openIndex = ref<number | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return faqs
    .map((f, i) => ({ ...f, i }))
    .filter(f => !activeTopic.value || f.topic === activeTopic.value)
    .filter(f => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
})

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

function toggleTopic(id: TopicId) {
  haptic()
  activeTopic.value = activeTopic.value === id ? null : id
  openIndex.value = null
}
function toggleFaq(i: number) {
  haptic()
  openIndex.value = openIndex.value === i ? null : i
}
const topicTitle = (id: TopicId) => topics.find(t => t.id === id)?.title ?? ''
</script>

<template>
  <div class="flex flex-col">
    <MobilePageHeader title="Help center" subtitle="Answers to common questions" />

    <!-- ── Search ──────────────────────────────────────────────── -->
    <div class="m-rise relative mb-5" style="--d: 60ms">
      <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="search"
        type="search"
        placeholder="Search help articles…"
        class="h-13 rounded-full pl-11 text-base transition-shadow md:text-base focus-visible:shadow-[0_6px_24px_-10px_rgba(0,0,0,0.25)]"
      />
    </div>

    <!-- ── Topics ──────────────────────────────────────────────── -->
    <section class="m-rise mb-6" style="--d: 120ms">
      <h2 class="mb-3 text-[15px] font-semibold text-foreground">Browse topics</h2>
      <div class="grid grid-cols-2 gap-2.5">
        <Button
          v-for="t in topics"
          :key="t.id"
          variant="ghost"
          class="m-press h-auto flex-col items-start justify-start gap-2.5 rounded-3xl p-3.5 text-left font-normal whitespace-normal"
          :class="activeTopic === t.id ? 'bg-foreground text-background hover:bg-foreground hover:text-background' : 'bg-muted/60 hover:bg-muted/60'"
          :aria-pressed="activeTopic === t.id"
          @click="toggleTopic(t.id)"
        >
          <span
            class="flex size-9 items-center justify-center rounded-xl"
            :class="activeTopic === t.id ? 'bg-background/15' : 'bg-background'"
          >
            <Icon :name="t.icon" class="size-4.5" />
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-semibold leading-tight">{{ t.title }}</span>
            <span
              class="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug"
              :class="activeTopic === t.id ? 'text-background/70' : 'text-muted-foreground'"
            >{{ t.desc }}</span>
          </span>
        </Button>
      </div>
    </section>

    <!-- ── FAQ ─────────────────────────────────────────────────── -->
    <section class="m-rise mb-6" style="--d: 180ms">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="truncate text-[15px] font-semibold text-foreground">
          {{ activeTopic ? topicTitle(activeTopic) : 'Frequently asked questions' }}
        </h2>
        <Button
          v-if="activeTopic || search"
          variant="link"
          size="sm"
          class="h-auto shrink-0 p-0 text-[13px] text-foreground"
          @click="activeTopic = null; search = ''; haptic()"
        >
          Clear filters
        </Button>
      </div>

      <TransitionGroup v-if="filtered.length" name="m-list" tag="div" class="relative flex flex-col gap-2">
        <Card
          v-for="f in filtered"
          :key="f.i"
          class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 p-0 shadow-none ring-0"
        >
          <Button
            variant="ghost"
            class="h-auto w-full items-start justify-between gap-3 rounded-none px-4 py-3.5 text-left font-normal whitespace-normal hover:bg-transparent"
            :aria-expanded="openIndex === f.i"
            @click="toggleFaq(f.i)"
          >
            <span class="text-[13.5px] font-semibold leading-snug text-foreground">{{ f.q }}</span>
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-background transition-transform duration-300"
              :class="openIndex === f.i ? 'rotate-180' : ''"
            >
              <Icon name="solar:alt-arrow-down-linear" class="size-3.5 text-muted-foreground" />
            </span>
          </Button>
          <Transition name="m-faq">
            <div v-if="openIndex === f.i" class="m-faq-body">
              <div class="overflow-hidden">
                <p class="px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">{{ f.a }}</p>
              </div>
            </div>
          </Transition>
        </Card>
      </TransitionGroup>

      <Card v-else class="items-center gap-1 rounded-3xl border-0 bg-muted/60 px-6 py-10 text-center shadow-none ring-0">
        <Icon name="solar:magnifer-linear" class="mb-2 size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">No results for “{{ search }}”</p>
        <p class="text-[12.5px] text-muted-foreground">Try different words, or contact us below.</p>
      </Card>
    </section>

    <!-- ── Contact ─────────────────────────────────────────────── -->
    <Card class="m-rise gap-0 rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 240ms">
      <div class="flex items-start gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background/15">
          <Icon name="solar:letter-linear" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="text-[15px] font-semibold">Still need help?</p>
          <p class="mt-0.5 text-[12.5px] text-background/70">Email our team — Pro and Business workspaces get priority support.</p>
        </div>
      </div>
      <Button class="m-press mt-4 h-12 w-full rounded-full bg-background font-semibold text-foreground hover:bg-background/90" as-child>
        <a href="mailto:hello@keepcabin.com?subject=KeepCabin%20support" @click="haptic">
          <Icon name="solar:letter-linear" class="size-5" /> Contact support
        </a>
      </Button>
    </Card>
  </div>
</template>

<style scoped>
/* Smooth height expand/collapse via grid-template-rows 0fr → 1fr */
.m-faq-body {
  display: grid;
  grid-template-rows: 1fr;
}
.m-faq-enter-active,
.m-faq-leave-active {
  transition: grid-template-rows 300ms cubic-bezier(.16, 1, .3, 1), opacity 220ms ease;
}
.m-faq-enter-from,
.m-faq-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
</style>
