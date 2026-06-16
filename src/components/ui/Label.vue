<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], default: '' },
  id: { type: String, default: '' },
})
</script>

<template>
  <label
    :for="props.id"
    :class="cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground',
      props.class
    )"
  >
    <slot />
  </label>
</template>
