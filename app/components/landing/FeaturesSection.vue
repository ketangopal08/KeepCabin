<script setup lang="ts">
const features = [
  {
    icon: '📁',
    title: 'Sync from Drive',
    description: 'Connect any public Google Drive folder and pull all receipt images into KeepCabin instantly.',
  },
  {
    icon: '🔍',
    title: 'OCR Extraction',
    description: 'Tesseract-powered text recognition reads merchant names, dates, line items, and totals.',
  },
  {
    icon: '🧾',
    title: 'Receipt View',
    description: 'Every receipt is displayed as a clean, structured summary — ready to copy or download.',
  },
]
</script>

<template>
  <section class="py-20 px-6 bg-muted/40">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">Everything you need</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card v-for="f in features" :key="f.title">
          <CardHeader>
            <span class="text-4xl">{{ f.icon }}</span>
            <CardTitle class="mt-2">{{ f.title }}</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-muted-foreground">{{ f.description }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>
