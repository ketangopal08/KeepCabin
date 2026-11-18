<script setup lang="ts">
// Shared page container — matches the ElevenLabs-style content spacing.
// Cancels the layout's p-6 so each page controls its own padding.
</script>

<template>
  <div class="-m-6 min-h-full [--text-sm:0.8rem]">
    <div class="w-full px-6 pt-5 pb-12 lg:px-12 lg:pt-6">
      <slot />
    </div>
  </div>
</template>
