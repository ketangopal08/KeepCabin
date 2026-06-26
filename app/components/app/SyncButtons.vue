<script setup lang="ts">
const emit = defineEmits<{ synced: [] }>()

const syncOpen = ref(false)
const importOpen = ref(false)
const folderUrl = ref(process.client ? (localStorage.getItem('keepcabin_folder_url') ?? '') : '')
const imageUrl = ref('')
const loading = ref(false)
const error = ref('')

async function handleSync() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/sync-drive', {
      method: 'POST',
      body: { folderUrl: folderUrl.value },
    })
    if (process.client) {
      localStorage.setItem('keepcabin_folder_url', folderUrl.value)
    }
    syncOpen.value = false
    emit('synced')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Sync failed'
  } finally {
    loading.value = false
  }
}

async function handleImport() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/import-url', {
      method: 'POST',
      body: { imageUrl: imageUrl.value },
    })
    imageUrl.value = ''
    importOpen.value = false
    emit('synced')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Import failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex gap-2">
    <!-- Sync Dialog -->
    <Dialog v-model:open="syncOpen">
      <DialogTrigger as-child>
        <Button variant="default">Sync</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync from Google Drive</DialogTitle>
          <DialogDescription>
            Paste the URL of a publicly shared Google Drive folder.
          </DialogDescription>
        </DialogHeader>
        <Input v-model="folderUrl" placeholder="https://drive.google.com/drive/folders/..." />
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button :disabled="loading || !folderUrl" @click="handleSync">
            {{ loading ? 'Syncing…' : 'Sync' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Import from URL Dialog -->
    <Dialog v-model:open="importOpen">
      <DialogTrigger as-child>
        <Button variant="outline">Import from URL</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from URL</DialogTitle>
          <DialogDescription>
            Paste a direct URL to a receipt image.
          </DialogDescription>
        </DialogHeader>
        <Input v-model="imageUrl" placeholder="https://example.com/receipt.jpg" />
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button :disabled="loading || !imageUrl" @click="handleImport">
            {{ loading ? 'Importing…' : 'Import' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
