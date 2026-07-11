<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { addWatermarkToPDF } from './utils/pdfWatermark'
import { addWatermarkToImages } from './utils/imageWatermark'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Slider from '@/components/ui/Slider.vue'
import Separator from '@/components/ui/Separator.vue'
import WatermarkTextSelect from '@/components/WatermarkTextSelect.vue'

const STORAGE_KEY = 'watermark-options'
const watermarkTextPresets = ['踢踢专用', '写稿大王踢踢', '严禁复制', '心心写稿']

const fileInput = ref(null)
const selectedFile = ref(null)
const imageFiles = ref([])
const activeTab = ref('file') // 'file' | 'image'
const isProcessing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const defaultOptions = {
  text: '踢踢专用',
  color: '#cc785c',
  opacity: 0.5,
  fontSize: 45,
  rotation: 45,
  density: 2,
}

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...defaultOptions, ...parsed }
    }
  } catch (e) {
    console.warn('读取水印缓存失败:', e)
  }
  return { ...defaultOptions }
}

const saveToStorage = (options) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch (e) {
    console.warn('保存水印缓存失败:', e)
  }
}

const watermarkOptions = reactive(loadFromStorage())

watch(
  watermarkOptions,
  (newOptions) => {
    saveToStorage(newOptions)
  },
  { deep: true }
)

const isValidFile = (file) => {
  if (!file) return false
  // PDF
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return true
  // DOCX — some browsers return empty MIME, so check extension as well
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) return true
  return false
}

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file && isValidFile(file)) {
    selectedFile.value = file
    errorMessage.value = ''
  } else {
    selectedFile.value = null
    errorMessage.value = '请选择有效的 PDF 或 DOCX 文件哦～'
  }
}

const handleImageChange = (event) => {
  const files = Array.from(event.target.files || [])
  imageFiles.value = files.filter(f => f.type.startsWith('image/'))
  errorMessage.value = ''
  if (imageFiles.value.length === 0 && files.length > 0) {
    errorMessage.value = '请选择有效的图片文件哦～'
  }
}

const handleAddWatermark = async () => {
  // validate
  if (activeTab.value === 'image') {
    if (imageFiles.value.length === 0) {
      errorMessage.value = '请先选择图片哦～'
      return
    }
  } else {
    if (!selectedFile.value) {
      errorMessage.value = '请先选择一个文件哦～'
      return
    }
  }

  try {
    isProcessing.value = true
    errorMessage.value = ''
    successMessage.value = ''

    const processedOptions = {
      ...watermarkOptions,
      opacity: parseFloat(watermarkOptions.opacity),
      fontSize: parseInt(watermarkOptions.fontSize, 10),
      rotation: parseInt(watermarkOptions.rotation, 10),
      density: parseInt(watermarkOptions.density, 10),
    }

    if (activeTab.value === 'image') {
      await addWatermarkToImages(imageFiles.value, processedOptions)
    } else {
      const isDocx = selectedFile.value.name.endsWith('.docx')
      if (isDocx) {
        const formData = new FormData()
        formData.append('file', selectedFile.value)
        const res = await fetch('/api/convert', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: '文档转换失败' }))
          throw new Error(err.message || '文档转换失败')
        }
        const pdfBlob = await res.blob()
        const pdfFile = new File([pdfBlob], selectedFile.value.name.replace(/\.docx$/i, '.pdf'), {
          type: 'application/pdf',
        })
        await addWatermarkToPDF(pdfFile, processedOptions)
      } else {
        await addWatermarkToPDF(selectedFile.value, processedOptions)
      }
    }

    successMessage.value = '水印已添加！✨'
  } catch (error) {
    console.error('处理文件时出错:', error)
    errorMessage.value = `处理失败: ${error.message}`
  } finally {
    isProcessing.value = false
  }
}

const resetForm = () => {
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  selectedFile.value = null
  imageFiles.value = []
  errorMessage.value = ''
  successMessage.value = ''

  Object.assign(watermarkOptions, { ...defaultOptions })
  localStorage.removeItem(STORAGE_KEY)
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- Header -->
      <header class="mb-10 text-center">
        <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          踢踢的水印小工具 🪄
        </h1>
        <p class="mt-3 text-base text-muted-foreground">
          写稿大王踢踢专属，文档、图片都能保护
        </p>
      </header>

      <!-- Main Content -->
      <main class="space-y-6">
        <!-- File Upload -->
        <Card>
          <CardHeader>
            <CardTitle>📄 选择文件</CardTitle>
          </CardHeader>
          <CardContent>
            <!-- Tab switcher -->
            <div class="mb-4 flex rounded-lg bg-muted p-1">
              <button
                :class="[
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                  activeTab === 'file'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ]"
                @click="activeTab = 'file'"
              >
                📄 文件水印
              </button>
              <button
                :class="[
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                  activeTab === 'image'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ]"
                @click="activeTab = 'image'"
              >
                🖼️ 图片水印
              </button>
            </div>

            <!-- File mode -->
            <div v-if="activeTab === 'file'" class="space-y-2">
              <Label id="upload-label">选择文件（支持 PDF、DOCX）</Label>
              <Input
                ref="fileInput"
                type="file"
                accept=".pdf,.docx"
                :disabled="isProcessing"
                aria-labelledby="upload-label"
                @change="handleFileChange"
              />
              <div
                v-if="selectedFile"
                class="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              >
                已选择: {{ selectedFile.name }} ({{ (selectedFile.size / 1024).toFixed(2) }} KB)
              </div>
            </div>

            <!-- Image mode -->
            <div v-if="activeTab === 'image'" class="space-y-2">
              <Label id="image-upload-label">选择图片（支持 JPG、PNG、WebP，可多选）</Label>
              <Input
                ref="fileInput"
                type="file"
                accept="image/*"
                multiple
                :disabled="isProcessing"
                aria-labelledby="image-upload-label"
                @change="handleImageChange"
              />
              <div
                v-if="imageFiles.length > 0"
                class="mt-2 space-y-1"
              >
                <p class="text-sm text-muted-foreground">
                  已选择 {{ imageFiles.length }} 张图片{{ imageFiles.length > 1 ? '，将打包为 ZIP' : '' }}
                </p>
                <ul class="max-h-32 space-y-0.5 overflow-y-auto text-sm text-muted-foreground">
                  <li v-for="(f, i) in imageFiles" :key="i">
                    🖼️ {{ f.name }} ({{ (f.size / 1024).toFixed(2) }} KB)
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Watermark Settings -->
        <Card>
          <CardHeader>
            <CardTitle>✨ 水印样式</CardTitle>
          </CardHeader>
          <CardContent class="space-y-5">
            <!-- Text -->
            <div class="space-y-2">
              <Label id="watermark-text-label">水印文字</Label>
              <WatermarkTextSelect
                :model-value="watermarkOptions.text"
                @update:model-value="watermarkOptions.text = $event"
                :built-in-presets="watermarkTextPresets"
                :disabled="isProcessing"
              />
            </div>

            <Separator />

            <!-- Color -->
            <div class="space-y-2">
              <Label>水印颜色</Label>
              <div class="flex items-center gap-3">
                <input
                  type="color"
                  :value="watermarkOptions.color"
                  @input="watermarkOptions.color = $event.target.value"
                  :disabled="isProcessing"
                  class="h-9 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
                  aria-label="选择水印颜色"
                />
                <span class="font-mono text-sm text-muted-foreground">{{ watermarkOptions.color }}</span>
              </div>
            </div>

            <Separator />

            <!-- Opacity -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>透明度</Label>
                <span class="text-sm tabular-nums text-muted-foreground">{{ watermarkOptions.opacity }}</span>
              </div>
              <Slider
                :model-value="[watermarkOptions.opacity]"
                @update:model-value="watermarkOptions.opacity = $event[0]"
                :min="0.1"
                :max="1"
                :step="0.1"
                :disabled="isProcessing"
                aria-label="透明度"
              />
            </div>

            <!-- Font Size -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>字体大小</Label>
                <span class="text-sm tabular-nums text-muted-foreground">{{ watermarkOptions.fontSize }}</span>
              </div>
              <Slider
                :model-value="[watermarkOptions.fontSize]"
                @update:model-value="watermarkOptions.fontSize = $event[0]"
                :min="10"
                :max="100"
                :step="1"
                :disabled="isProcessing"
                aria-label="字体大小"
              />
            </div>

            <!-- Rotation -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>旋转角度</Label>
                <span class="text-sm tabular-nums text-muted-foreground">{{ watermarkOptions.rotation }}°</span>
              </div>
              <Slider
                :model-value="[watermarkOptions.rotation]"
                @update:model-value="watermarkOptions.rotation = $event[0]"
                :min="-90"
                :max="90"
                :step="5"
                :disabled="isProcessing"
                aria-label="旋转角度"
              />
            </div>

            <!-- Density -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>水印密度</Label>
                <span class="text-sm tabular-nums text-muted-foreground">{{ watermarkOptions.density }}</span>
              </div>
              <Slider
                :model-value="[watermarkOptions.density]"
                @update:model-value="watermarkOptions.density = $event[0]"
                :min="1"
                :max="5"
                :step="1"
                :disabled="isProcessing"
                aria-label="水印密度"
              />
            </div>
          </CardContent>
        </Card>

        <!-- Actions -->
        <div class="flex gap-3">
          <Button
            :disabled="(activeTab === 'file' ? !selectedFile : imageFiles.length === 0) || isProcessing"
            @click="handleAddWatermark"
          >
            {{ isProcessing ? '正在处理中...' : '✨ 一键添加水印' }}
          </Button>
          <Button
            variant="outline"
            :disabled="isProcessing"
            @click="resetForm"
          >
            恢复默认
          </Button>
        </div>

        <!-- Error Message -->
        <div
          v-if="errorMessage"
          role="alert"
          class="relative w-full rounded-lg border border-destructive/50 px-4 py-3 text-sm text-destructive"
        >
          <p class="font-medium">出错了 🥺</p>
          <p class="mt-1 text-destructive/80">{{ errorMessage }}</p>
        </div>

        <!-- Success Message -->
        <div
          v-if="successMessage"
          role="status"
          class="relative w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <p class="font-medium text-foreground">搞定啦 🎉</p>
          <p class="mt-1 text-muted-foreground">{{ successMessage }}</p>
        </div>
      </main>

      <!-- Footer -->
      <footer class="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        <p>
          由
          <a
            href="https://github.com/twoheartliu/watermarkfortt"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-primary hover:underline"
          >twoheart</a>
          <span class="text-primary"> ❤️ </span>
          为踢踢打造
        </p>
      </footer>
    </div>
  </div>
</template>
