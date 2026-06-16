<script setup>
import { SelectContent as RekaSelectContent } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], default: '' },
  position: { type: String, default: 'popper' },
  sideOffset: { type: Number, default: 8 },
})
</script>

<template>
  <RekaSelectContent
    :position="position"
    :side-offset="sideOffset"
    :class="cn(
      'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      props.class
    )"
    v-bind="$attrs"
  >
    <slot />
  </RekaSelectContent>
</template>
