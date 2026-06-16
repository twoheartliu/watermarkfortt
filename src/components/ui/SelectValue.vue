<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], default: '' },
})
</script>

<template>
  <span :class="cn('flex items-center gap-2', props.class)">
    <slot />
  </span>
</template>
