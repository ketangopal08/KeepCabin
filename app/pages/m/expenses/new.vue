<script setup lang="ts">
// Tab bar hidden: the screen has its own sticky submit button at the bottom.
definePageMeta({ layout: 'mobile', middleware: 'mobile', hideTabBar: true, pageTransition: { name: 'm-page', mode: 'out-in' } })

provideNewExpense()
</script>

<template>
  <MobileNewExpense />
</template>
