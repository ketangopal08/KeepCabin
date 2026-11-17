<script setup lang="ts">

definePageMeta({ layout: 'app', middleware: 'auth' })

// Template page — notifications will be loaded here once the API exists
const notifications = ref<{ id: string; title: string; body: string; read: boolean; created_at: string }[]>([])

const activeTab = ref<'all' | 'unread'>('all')
function setTab(id: string) { activeTab.value = id as 'all' | 'unread' }

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const filtered = computed(() =>
  activeTab.value === 'unread' ? notifications.value.filter(n => !n.read) : notifications.value
)
</script>

<template>
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Notifications" description="Updates on expenses, approvals and payments.">
      <template #actions>
        <Button variant="outline" class="h-9 gap-1.5 rounded-lg px-4" :disabled="unreadCount === 0">
          <Icon name="solar:check-read-linear" class="size-4" /> Mark all as read
        </Button>
      </template>
    </AppPageHeader>

    <!-- Tabs -->
    <AppPageTabs
      :model-value="activeTab"
      :tabs="[
        { id: 'all', label: 'All', count: notifications.length },
        { id: 'unread', label: 'Unread', count: unreadCount },
      ]"
      @update:model-value="setTab"
    />

    <!-- Empty state -->
    <div v-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
      <Icon name="solar:bell-linear" class="size-7 text-muted-foreground" />
      <p class="text-[15px] text-foreground">You're all caught up</p>
      <p class="-mt-1.5 text-sm text-muted-foreground">
        {{ activeTab === 'unread' ? 'No unread notifications.' : 'New notifications will appear here.' }}
      </p>
    </div>

    <!-- List -->
    <div v-else class="flex flex-col">
      <div
        v-for="n in filtered"
        :key="n.id"
        class="flex items-start gap-3 border-b border-border px-2 py-4"
      >
        <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="n.read ? 'bg-transparent' : 'bg-primary'" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-foreground">{{ n.title }}</p>
          <p class="mt-0.5 text-[13px] text-muted-foreground">{{ n.body }}</p>
        </div>
        <span class="shrink-0 text-[12.5px] text-muted-foreground">
          {{ new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }}
        </span>
      </div>
    </div>

  </AppPage>
</template>
