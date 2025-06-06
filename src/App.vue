<script setup>
import { ref, reactive } from 'vue'
import { addWatermarkToPDF } from './utils/pdfWatermark'

// 文件上传相关
const fileInput = ref(null)
const selectedFile = ref(null)
const isProcessing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// 处理颜色选择器变化
const handleColorChange = (event) => {
  // 保存十六进制颜色值
  watermarkOptions.color = event.target.value
  console.log('颜色已更改为:', watermarkOptions.color)
}

// 确保数值类型正确
const ensureNumberValues = () => {
  // 确保这些值是数字类型
  watermarkOptions.opacity = parseFloat(watermarkOptions.opacity)
  watermarkOptions.fontSize = parseInt(watermarkOptions.fontSize)
  watermarkOptions.rotation = parseInt(watermarkOptions.rotation)
  watermarkOptions.density = parseInt(watermarkOptions.density)
}

// 修改初始颜色为十六进制格式
const watermarkOptions = reactive({
  text: '严禁复制',
  color: '#000000', // 使用十六进制格式
  opacity: 0.9,
  fontSize: 50,
  rotation: 45,
  density: 2
})

// 处理文件选择
const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/pdf') {
    selectedFile.value = file
    errorMessage.value = ''
  } else {
    selectedFile.value = null
    errorMessage.value = '请选择有效的PDF文件'
  }
}

// 处理水印添加
const handleAddWatermark = async () => {
  if (!selectedFile.value) {
    errorMessage.value = '请先选择PDF文件'
    return
  }

  try {
    isProcessing.value = true
    errorMessage.value = ''
    successMessage.value = ''

    // 确保数值类型正确
    ensureNumberValues()

    console.log('处理前的水印选项:', {
      ...watermarkOptions,
      opacityType: typeof watermarkOptions.opacity
    })

    await addWatermarkToPDF(selectedFile.value, watermarkOptions)

    successMessage.value = '水印添加成功，文件已下载'
  } catch (error) {
    console.error('处理PDF时出错:', error)
    errorMessage.value = `处理PDF时出错: ${error.message}`
  } finally {
    isProcessing.value = false
  }
}

// 重置表单
const resetForm = () => {
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  selectedFile.value = null
  errorMessage.value = ''
  successMessage.value = ''

  // 重置水印选项为默认值
  Object.assign(watermarkOptions, {
    text: '严禁复制',
    color: '#000000', // 使用十六进制格式
    opacity: 0.9,
    fontSize: 50,
    rotation: 45,
    density: 2
  })
}
</script>
<template>
  <div class="container">
    <header>
      <h1>PDF 水印工具</h1>
      <p>为您的 PDF 文件添加自定义水印</p>
    </header>

    <main>
      <div class="card upload-section">
        <h2>选择 PDF 文件</h2>
        <input type="file" ref="fileInput" accept=".pdf" @change="handleFileChange" :disabled="isProcessing" />
        <div v-if="selectedFile" class="selected-file">
          已选择: {{ selectedFile.name }} ({{ (selectedFile.size / 1024).toFixed(2) }} KB)
        </div>
      </div>

      <div class="card watermark-options">
        <h2>水印设置</h2>

        <div class="form-group">
          <label for="watermarkText">水印文本:</label>
          <input id="watermarkText" v-model="watermarkOptions.text" type="text" :disabled="isProcessing" />
        </div>

        <div class="form-group">
          <label for="watermarkColor">水印颜色:</label>
          <div class="color-picker-container">
            <input id="watermarkColor" v-model="watermarkOptions.color" type="color" :disabled="isProcessing"
              @input="handleColorChange" />
            <span class="color-value">{{ watermarkOptions.color }}</span>
          </div>
        </div>
        <!-- 修改透明度输入 -->
        <div class="form-group">
          <label for="watermarkOpacity">透明度:</label>
          <div class="range-container">
            <input id="watermarkOpacity" v-model.number="watermarkOptions.opacity" type="range" min="0.1" max="1"
              step="0.1" :disabled="isProcessing" />
            <span>{{ watermarkOptions.opacity }}</span>
          </div>
        </div>

        <!-- 修改字体大小输入 -->
        <div class="form-group">
          <label for="watermarkFontSize">字体大小:</label>
          <div class="range-container">
            <input id="watermarkFontSize" v-model.number="watermarkOptions.fontSize" type="range" min="10" max="100"
              step="1" :disabled="isProcessing" />
            <span>{{ watermarkOptions.fontSize }}</span>
          </div>
        </div>

        <!-- 修改旋转角度输入 -->
        <div class="form-group">
          <label for="watermarkRotation">旋转角度:</label>
          <div class="range-container">
            <input id="watermarkRotation" v-model.number="watermarkOptions.rotation" type="range" min="-90" max="90"
              step="5" :disabled="isProcessing" />
            <span>{{ watermarkOptions.rotation }}°</span>
          </div>
        </div>

        <!-- 修改水印密度输入 -->
        <div class="form-group">
          <label for="watermarkDensity">水印密度:</label>
          <div class="range-container">
            <input id="watermarkDensity" v-model.number="watermarkOptions.density" type="range" min="1" max="5" step="1"
              :disabled="isProcessing" />
            <span>{{ watermarkOptions.density }}</span>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="handleAddWatermark" :disabled="!selectedFile || isProcessing">
          {{ isProcessing ? '处理中...' : '添加水印' }}
        </button>

        <button class="btn btn-secondary" @click="resetForm" :disabled="isProcessing">
          重置
        </button>
      </div>

      <div v-if="errorMessage" class="message error">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="message success">
        {{ successMessage }}
      </div>
    </main>

    <footer>
      <p>基于 Vue 3 + Vite 构建的 PDF 水印工具</p>
    </footer>
  </div>
</template>

<style>
:root {
  --primary-color: #FF69B4;
  /* 热粉色 */
  --primary-hover: #FF5CA8;
  /* 稍深的粉色用于悬停效果 */
  --secondary-color: #FFF0F5;
  /* 淡粉色背景 */
  --text-color: #333;
  --border-color: #FFD1DC;
  /* 淡粉色边框 */
  --error-color: #f44336;
  --success-color: #FF69B4;
  /* 使成功颜色也保持粉色系 */
  --card-bg: white;
  --body-bg: #FFF5F8;
  /* 非常淡的粉色背景 */
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--body-bg);
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

header h1 {
  font-size: 2.5rem;
  color: var(--primary-color);
  margin-bottom: 10px;
}

header p {
  font-size: 1.2rem;
  color: #666;
}

main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background-color: var(--card-bg);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.card h2 {
  margin-bottom: 15px;
  color: var(--primary-color);
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input[type="text"],
input[type="file"] {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
}

input[type="range"] {
  width: calc(100% - 50px);
}

.range-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.range-container span {
  min-width: 40px;
  text-align: right;
}

.selected-file {
  margin-top: 10px;
  padding: 10px;
  background-color: #e9f7ef;
  border-radius: 4px;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 1s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: var(--text-color);
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e0e0e0;
}

.message {
  padding: 15px;
  border-radius: 4px;
  margin-top: 15px;
}

.error {
  background-color: #ffebee;
  color: var(--error-color);
  border: 1px solid #ffcdd2;
}

.success {
  background-color: #e8f5e9;
  color: var(--success-color);
  border: 1px solid #c8e6c9;
}

footer {
  text-align: center;
  margin-top: 40px;
  padding: 20px 0;
  color: #666;
  font-size: 0.9rem;
  border-top: 1px solid var(--border-color);
}

/* 在样式部分添加 */
.color-picker-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

input[type="color"] {
  -webkit-appearance: none;
  width: 50px;
  height: 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-value {
  font-family: monospace;
}


@media (max-width: 600px) {
  .container {
    padding: 10px;
  }

  header h1 {
    font-size: 2rem;
  }

  .actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>