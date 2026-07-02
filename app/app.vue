<script setup lang="ts">
const { init } = useTheme()
onMounted(init)

const { hide } = usePageLoader()
const router = useRouter()
router.afterEach(() => hide())
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PageLoader />
  </div>
</template>
