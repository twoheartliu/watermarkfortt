<script setup>
import { SelectItem as RekaSelectItem } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  value: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Object, Array], default: '' },
})
</script>

<template>
  <RekaSelectItem
    :value="value"
    :disabled="disabled"
    :class="
      cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </RekaSelectItem>
</template>
