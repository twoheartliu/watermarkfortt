<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { ChevronDown, Check, Plus, X } from 'lucide-vue-next'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Separator from '@/components/ui/Separator.vue'

const CUSTOM_PRESETS_KEY = 'watermark-text-custom-presets'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  builtInPresets: { type: Array, default: () => ['踢踢专用', '写稿大王踢踢', '严禁复制'] },
})

const emit = defineEmits(['update:modelValue'])

// ---- state ----
const isOpen = ref(false)
const localText = ref(props.modelValue)
const highlightIndex = ref(-1)
const dropdownRef = ref(null)
const triggerRef = ref(null)

// ---- custom presets from localStorage ----
const customPresets = ref([])

const loadCustomPresets = () => {
  try {
    const saved = localStorage.getItem(CUSTOM_PRESETS_KEY)
    if (saved) {
      customPresets.value = JSON.parse(saved)
    }
  } catch (e) {
    console.warn('读取自定义预设失败:', e)
  }
}

const saveCustomPresets = () => {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets.value))
  } catch (e) {
    console.warn('保存自定义预设失败:', e)
  }
}

loadCustomPresets()

// ---- all presets = built-in + custom ----
const allPresets = computed(() => {
  const merged = [...props.builtInPresets]
  customPresets.value.forEach((p) => {
    if (!merged.includes(p)) {
      merged.push(p)
    }
  })
  return merged
})

// ---- check if current text is already a preset ----
const isCurrentTextPreset = computed(() => {
  return allPresets.value.includes(props.modelValue.trim())
})

// ---- check if input has text ----
const hasText = computed(() => localText.value.length > 0)

// ---- clear text ----
const clearText = () => {
  localText.value = ''
}

// ---- sync external modelValue → localText ----
watch(
  () => props.modelValue,
  (val) => {
    localText.value = val
  }
)

// ---- actions ----
const toggleOpen = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    highlightIndex.value = -1
  }
}

const closeDropdown = () => {
  isOpen.value = false
  highlightIndex.value = -1
}

const selectPreset = (preset) => {
  localText.value = preset
  closeDropdown()
}

// sync typed text to parent
watch(localText, (val) => {
  emit('update:modelValue', val)
})

const addAsPreset = () => {
  const trimmed = localText.value.trim()
  if (!trimmed || allPresets.value.includes(trimmed)) return
  customPresets.value.push(trimmed)
  saveCustomPresets()
  closeDropdown()
}

const deleteCustomPreset = (preset) => {
  customPresets.value = customPresets.value.filter((p) => p !== preset)
  saveCustomPresets()
}

// ---- keyboard ----
const onKeydown = (e) => {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      isOpen.value = true
    }
    return
  }

  const items = allPresets.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = Math.min(highlightIndex.value + 1, items.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightIndex.value >= 0 && highlightIndex.value < items.length) {
      selectPreset(items[highlightIndex.value])
    } else {
      closeDropdown()
    }
  } else if (e.key === 'Escape') {
    closeDropdown()
  }
}

// ---- click outside ----
const onDocumentClick = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    closeDropdown()
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', onDocumentClick, true)
  } else {
    document.removeEventListener('click', onDocumentClick, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
})
</script>

<template>
  <div ref="dropdownRef" class="relative" @keydown="onKeydown">
    <!-- Input row -->
    <div class="flex">
      <div class="relative flex-1">
        <Input
          v-model="localText"
          type="text"
          :disabled="disabled"
          placeholder="输入水印文字，比如「踢踢YYDS」"
          :class="['rounded-r-none border-r-0 focus-visible:z-10', hasText && 'pr-8']"
        />
        <button
          v-if="hasText && !disabled"
          type="button"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="清空输入"
          @click="clearText"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <Button
        ref="triggerRef"
        variant="outline"
        size="icon"
        :disabled="disabled"
        class="shrink-0 rounded-l-none"
        @click="toggleOpen"
      >
        <ChevronDown
          :class="[
            'h-4 w-4 transition-transform duration-150',
            isOpen ? 'rotate-180' : '',
          ]"
        />
      </Button>
    </div>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <div class="max-h-56 overflow-y-auto p-1">
          <!-- Built-in section -->
          <div
            v-for="(preset, idx) in allPresets"
            :key="'p-' + preset"
            :ref="(el) => { if (idx === highlightIndex && el) el.scrollIntoView({ block: 'nearest' }) }"
            role="option"
            :aria-selected="preset === modelValue"
            :class="[
              'relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
              preset === modelValue
                ? 'bg-accent text-accent-foreground font-medium'
                : idx === highlightIndex
                  ? 'bg-accent/60 text-accent-foreground'
                  : 'hover:bg-accent/60 hover:text-accent-foreground',
            ]"
            @mousedown.prevent="selectPreset(preset)"
            @mouseenter="highlightIndex = idx"
          >
            <Check
              v-if="preset === modelValue"
              class="mr-2 h-4 w-4 shrink-0 text-primary"
            />
            <span v-else class="mr-2 h-4 w-4 shrink-0" />
            <span class="flex-1 text-left">{{ preset }}</span>
            <!-- Delete button for custom presets -->
            <button
              v-if="customPresets.includes(preset)"
              class="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              @mousedown.stop
              @click.stop="deleteCustomPreset(preset)"
              title="删除此预设"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Add custom text as preset -->
        <div v-if="localText.trim() && !isCurrentTextPreset">
          <Separator />
          <div class="p-1">
            <button
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none"
              @mousedown.prevent="addAsPreset"
            >
              <Plus class="h-4 w-4 shrink-0" />
              <span>新增 "</span>
              <span class="max-w-[160px] truncate font-medium text-foreground">{{ localText.trim() }}</span>
              <span>"</span>
            </button>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="allPresets.length === 0 && !localText.trim()"
          class="px-2 py-6 text-center text-sm text-muted-foreground"
        >
          暂无预设选项，输入文字后可新增
        </div>
      </div>
    </Transition>
  </div>
</template>
