<script setup>
import { SelectRoot } from 'reka-ui'

defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :disabled="disabled"
  >
    <slot />
  </SelectRoot>
</template>
