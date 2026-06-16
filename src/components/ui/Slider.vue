<script setup>
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  modelValue: { type: Array, default: () => [0] },
  max: { type: Number, default: 100 },
  min: { type: Number, default: 0 },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Object, Array], default: '' },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <SliderRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :max="max"
    :min="min"
    :step="step"
    :disabled="disabled"
    :class="cn('relative flex w-full touch-none select-none items-center', props.class)"
  >
    <SliderTrack class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      class="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
