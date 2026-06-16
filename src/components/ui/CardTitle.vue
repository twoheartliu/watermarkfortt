<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], default: '' },
})
</script>

<template>
  <h3 :class="cn('font-semibold leading-none tracking-tight', props.class)">
    <slot />
  </h3>
</template>
