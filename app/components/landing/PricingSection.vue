<script setup lang="ts">
const tiers = [
  {
    name: 'Free',
    price: '$0',
    features: ['50 receipts/mo', 'Drive Sync', 'OCR Extraction'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9',
    features: ['Unlimited receipts', 'Drive Sync', 'Priority Support'],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$29',
    features: ['Unlimited receipts', 'Team Access', 'API Access'],
    cta: 'Contact Us',
    highlighted: false,
  },
]
</script>

<template>
  <section class="py-20 px-6">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">Simple pricing</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          v-for="tier in tiers"
          :key="tier.name"
          :class="tier.highlighted ? 'border-primary ring-2 ring-primary' : ''"
        >
          <CardHeader>
            <CardTitle>{{ tier.name }}</CardTitle>
            <div class="text-4xl font-bold mt-2">
              {{ tier.price }}<span class="text-base font-normal text-muted-foreground">/mo</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li v-for="feat in tier.features" :key="feat" class="flex items-center gap-2 text-sm">
                <span class="text-green-500">✓</span> {{ feat }}
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <NuxtLink to="/app" class="w-full">
              <Button :variant="tier.highlighted ? 'default' : 'outline'" class="w-full">
                {{ tier.cta }}
              </Button>
            </NuxtLink>
          </CardFooter>
        </Card>
      </div>
    </div>
  </section>
</template>
