<script setup>
import { cn } from '@/lib/utils'
import { Separator as RekaSeparator } from 'reka-ui'

const props = defineProps({
  orientation: { type: String, default: 'horizontal' },
  class: { type: [String, Object, Array], default: '' },
  decorative: { type: Boolean, default: true },
})
</script>

<template>
  <RekaSeparator
    :orientation="orientation"
    :decorative="decorative"
    :class="cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      props.class
    )"
  />
</template>
