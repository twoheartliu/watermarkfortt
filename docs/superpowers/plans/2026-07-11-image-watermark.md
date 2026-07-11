# Image Watermark Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image watermark mode with tab switching — upload JPG/PNG/WebP images, apply Canvas-based watermarks, download individually or as ZIP bundle.

**Architecture:** New `src/utils/imageWatermark.js` module reuses the grid-position algorithm from `pdfWatermark.js`. `App.vue` gains a two-tab layout (文件/图片) where only the file-input area changes — watermark settings remain shared. Single images download directly; multiple images are bundled via JSZip.

**Tech Stack:** Canvas API, FontFace API, JSZip (re-added)

## Global Constraints

- Re-add `jszip` ^3.10.1 to dependencies
- DO NOT modify `src/utils/pdfWatermark.js` or `server/index.mjs`
- Watermark parameters shared with PDF mode: text, color (hex), opacity (0-1), fontSize (px), rotation (degrees), density (1-5)
- Font: load SimHei via FontFace API from `/fonts/simhei.ttf`, system-fallback if unavailable
- Format preservation: PNG→PNG, JPEG→JPEG, WebP→WebP, other→PNG
- Single image → direct download; multiple images → ZIP download
- Commit messages in Chinese

---

### Task 1: Re-add jszip dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `jszip` available via `import JSZip from 'jszip'` for Task 2

- [ ] **Step 1: Install jszip**

```bash
pnpm add jszip
```

Expected: `"jszip": "^3.10.1"` (or newer) added to `package.json`.

- [ ] **Step 2: Verify**

```bash
node -e "const JSZip = require('jszip'); console.log('JSZip OK:', require('jszip/package.json').version)"
```

Expected: prints version without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: re-add jszip for image ZIP packaging

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create imageWatermark.js

**Files:**
- Create: `src/utils/imageWatermark.js`

**Interfaces:**
- Consumes: `jszip` from npm, `file-saver` (already in project), FontFace API (browser), Canvas API (browser)
- Produces: `export async function addWatermarkToImages(files, watermarkOptions) => Promise<void>` — renders watermark on each image via Canvas, downloads single file or ZIP bundle

- [ ] **Step 1: Write imageWatermark.js**

Create `src/utils/imageWatermark.js` with the complete implementation:

```js
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ---- font loading ----------------------------------------------------------

let fontReady = false;

async function ensureFontLoaded() {
  if (fontReady) return;
  try {
    if (typeof FontFace === 'undefined') { fontReady = true; return; }
    const font = new FontFace('SimHei', 'url(/fonts/simhei.ttf)');
    await font.load();
    document.fonts.add(font);
    fontReady = true;
  } catch {
    fontReady = true;
  }
}

// ---- watermark position grid (same algorithm as pdfWatermark.js) -----------

function generateWatermarkPositions(width, height, fontSize, density) {
  const positions = [];

  if (density > 1) {
    const gridSize = Math.max(2, density * 2);
    const spacingX = width / gridSize;
    const spacingY = height / gridSize;

    for (let row = 0; row <= gridSize; row++) {
      for (let col = 0; col <= gridSize; col++) {
        const x = col * spacingX;
        const y = row * spacingY;
        const isDuplicate = positions.some(
          p => Math.abs(p.x - x) < 50 && Math.abs(p.y - y) < 50,
        );
        if (!isDuplicate) positions.push({ x, y });
      }
    }
  }

  if (density >= 4) {
    const diagCount = density * 2;
    for (let i = 0; i <= diagCount; i++) {
      const x1 = (width / diagCount) * i;
      const y1 = (height / diagCount) * i;
      if (!positions.some(p => Math.abs(p.x - x1) < 50 && Math.abs(p.y - y1) < 50))
        positions.push({ x: x1, y: y1 });

      const x2 = (width / diagCount) * i;
      const y2 = height - (height / diagCount) * i;
      if (!positions.some(p => Math.abs(p.x - x2) < 50 && Math.abs(p.y - y2) < 50))
        positions.push({ x: x2, y: y2 });
    }
  }

  if (density === 5) {
    for (let i = 0; i < 15; i++) {
      positions.push({
        x: Math.random() * width,
        y: Math.random() * height,
      });
    }
  }

  return positions;
}

// ---- single image watermark renderer --------------------------------------

function getMimeType(file) {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/jpeg') return 'image/jpeg';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/png'; // fallback
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`无法加载图片: ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

async function watermarkOneImage(file, options) {
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 渲染上下文不可用');

  // draw original image
  ctx.drawImage(img, 0, 0);

  // draw watermark text
  ctx.globalAlpha = options.opacity;
  ctx.fillStyle = options.color;
  ctx.font = `${options.fontSize}px "SimHei", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const positions = generateWatermarkPositions(canvas.width, canvas.height, options.fontSize, options.density);

  for (const pos of positions) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((options.rotation * Math.PI) / 180);
    ctx.fillText(options.text, 0, 0);
    ctx.restore();
  }

  // revoke object URL to free memory
  URL.revokeObjectURL(img.src);

  const mimeType = getMimeType(file);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob 返回空'));
    }, mimeType);
  });
}

// ---- main export -----------------------------------------------------------

export async function addWatermarkToImages(files, watermarkOptions) {
  if (!files || files.length === 0) {
    throw new Error('请先选择图片哦～');
  }

  const options = {
    text: watermarkOptions.text || '水印文本',
    color: watermarkOptions.color || '#000000',
    opacity: parseFloat(watermarkOptions.opacity) || 0.5,
    fontSize: parseInt(watermarkOptions.fontSize, 10) || 45,
    rotation: parseInt(watermarkOptions.rotation, 10) || 45,
    density: parseInt(watermarkOptions.density, 10) || 2,
  };

  await ensureFontLoaded();

  const fileArray = Array.isArray(files) ? Array.from(files) : [files];

  // process images, collecting successes and failures
  const results = [];
  for (const file of fileArray) {
    try {
      const blob = await watermarkOneImage(file, options);
      results.push({ file, blob, success: true });
    } catch (err) {
      console.error(`处理图片 ${file.name} 失败:`, err);
      results.push({ file, success: false });
    }
  }

  const succeeded = results.filter(r => r.success);

  if (succeeded.length === 0) {
    throw new Error('所有图片处理都失败了，请检查图片格式～');
  }

  if (succeeded.length === 1) {
    // single image — direct download
    const { blob, file } = succeeded[0];
    const ext = file.name.match(/\.([^.]+)$/)?.[1] || 'png';
    saveAs(blob, `水印版_${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
  } else {
    // multiple images — ZIP bundle
    const zip = new JSZip();
    for (const { blob, file } of succeeded) {
      zip.file(`水印版_${file.name}`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    saveAs(zipBlob, '水印版图片.zip');
  }

  // report partial failures
  const failed = results.length - succeeded.length;
  if (failed > 0) {
    console.warn(`${succeeded.length} 张处理成功，${failed} 张失败`);
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check src/utils/imageWatermark.js
```

Expected: no output = pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/imageWatermark.js
git commit -m "feat: add image watermark core logic (Canvas render + JSZip bundle)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Modify App.vue — tab switching + image mode

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `addWatermarkToImages` from `./utils/imageWatermark.js` (Task 2)
- Produces: tab switching between file mode (existing) and image mode (new), shared watermark settings

- [ ] **Step 1: Add import and tab state**

In `<script setup>`, add after the `addWatermarkToPDF` import:

```js
import { addWatermarkToImages } from './utils/imageWatermark'

const activeTab = ref('file') // 'file' | 'image'
```

- [ ] **Step 2: Add image mode state and handler**

Add after the existing `selectedFile` ref:

```js
const imageFiles = ref([])

const handleImageChange = (event) => {
  const files = Array.from(event.target.files || [])
  imageFiles.value = files.filter(f => f.type.startsWith('image/'))
  errorMessage.value = ''
  if (imageFiles.value.length === 0 && files.length > 0) {
    errorMessage.value = '请选择有效的图片文件哦～'
  }
}
```

- [ ] **Step 3: Update handleAddWatermark for tab dispatch**

Replace the current `handleAddWatermark` function with:

```js
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

    successMessage.value = '水印已添加，文档已保护！✨'
  } catch (error) {
    console.error('处理文件时出错:', error)
    errorMessage.value = `处理失败: ${error.message}`
  } finally {
    isProcessing.value = false
  }
}
```

- [ ] **Step 4: Update resetForm for image mode**

Replace the current `resetForm` with:

```js
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
```

- [ ] **Step 5: Replace template — file upload Card with tab-aware version**

Replace the entire File Upload Card (from `<Card>` with CardTitle "📄 选择文件" to its closing `</Card>`) with:

```html
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
          'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
          'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
      <Label id="upload-label">选择文件</Label>
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
      <Label id="upload-label">选择图片（可多选）</Label>
      <Input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        :disabled="isProcessing"
        aria-labelledby="upload-label"
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
```

- [ ] **Step 6: Build verification**

```bash
npx vite build
```

Expected: build succeeds, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.vue
git commit -m "feat: add tab switching and image watermark mode

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Verify end-to-end

**Files:**
- No code changes — manual verification

- [ ] **Step 1: Start services**

```bash
pnpm dev:all
```

Expected: frontend on :5173, server on :3001.

- [ ] **Step 2: Test file mode (regression)**

1. Upload a PDF → add watermark → downloads watermarked PDF ✅
2. Upload a DOCX → add watermark → downloads watermarked PDF ✅

- [ ] **Step 3: Test image mode**

1. Switch to 🖼️ 图片水印 tab
2. Select 1 image → add watermark → downloads single watermarked image ✅
3. Select 3+ images → add watermark → downloads ZIP with all watermarked images ✅

- [ ] **Step 4: Test edge cases**

1. Switch tab back and forth — settings preserved ✅
2. Try non-image file in image mode — rejected ✅
3. Try large image (>10MB) — processes without crash ✅

- [ ] **Step 5: Production build**

```bash
npx vite build
```

Expected: succeeds.

---
