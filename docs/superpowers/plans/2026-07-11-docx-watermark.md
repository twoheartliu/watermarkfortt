# DOCX Watermark Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure front-end DOCX watermark support, producing a watermarked DOCX file via Canvas-rendered background image embedded through OOXML VML background.

**Architecture:** New `src/utils/docxWatermark.js` module with `addWatermarkToDocx(file, options)` — same signature as the existing `addWatermarkToPDF`. `App.vue` dispatches by file extension. JSZip handles ZIP decode/encode; Canvas API renders the watermark image; XML string interpolation injects `<w:background>` + relationship entries.

**Tech Stack:** Vue 3, JSZip (~20KB gzipped, zero deps), Canvas API, FontFace API, file-saver (already present)

## Global Constraints

- Dependency: `jszip` ^3.10.1, no new dependencies beyond that
- DO NOT modify `src/utils/pdfWatermark.js` or any other existing file except `src/App.vue` and `package.json`
- All processing in browser — no server uploads
- File size limit: 50MB for DOCX
- Watermark parameters identical to PDF: text, color (hex), opacity (0-1), fontSize (px), rotation (degrees), density (1-5)
- Canvas dimensions: 1240×1754 px (A4 ratio at 150 DPI)
- Font: load SimHei via FontFace API from `/fonts/simhei.ttf`, with system-fallback if unavailable
- XML modification: string interpolation only — never use DOMParser (preserves namespaces/DTD)
- Relationship IDs: scan existing rIds, use next available integer
- Existing `<w:background>` must be replaced, not duplicated
- Commit messages in the repo's language (Chinese)

---

### Task 1: Install jszip dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `jszip` available via `import JSZip from 'jszip'` for Task 2

- [ ] **Step 1: Install jszip**

Run:
```bash
pnpm add jszip
```

Expected: package.json updated with `"jszip": "^3.10.1"` (or newer patch), pnpm-lock.yaml updated.

- [ ] **Step 2: Verify installation**

Run:
```bash
node -e "const JSZip = require('jszip'); console.log('JSZip loaded, version:', require('jszip/package.json').version)"
```

Expected: prints JSZip version without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add jszip dependency for DOCX watermark support

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create docxWatermark.js — Canvas rendering + XML manipulation + main pipeline

**Files:**
- Create: `src/utils/docxWatermark.js`

**Interfaces:**
- Consumes: `jszip` from npm, `file-saver` (already in project), FontFace API (browser), Canvas API (browser)
- Produces: `export async function addWatermarkToDocx(file, watermarkOptions) => Promise<void>` — reads DOCX file, renders watermark image via Canvas, embeds it as `<w:background>` VML, triggers browser download

- [ ] **Step 1: Create docxWatermark.js — position generator (reused from pdfWatermark)**

Write the initial file scaffold:

```js
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ---- font loading ----------------------------------------------------------

let fontReady = false;

async function ensureFontLoaded() {
  if (fontReady) return;
  try {
    if (typeof FontFace === 'undefined') return;
    const font = new FontFace('SimHei', 'url(/fonts/simhei.ttf)');
    await font.load();
    document.fonts.add(font);
    fontReady = true;
  } catch {
    // proceed with system fonts — Chinese may render as tofu on non-CJK systems
  }
}

// ---- watermark position grid (mirrors pdfWatermark.js logic) ----------------

function generateWatermarkPositions(width, height, fontSize, density) {
  const positions = [];
  const padding = fontSize * 2;

  if (density > 1) {
    const gridSize = Math.max(2, density * 2);
    const spacingX = (width - padding * 2) / gridSize;
    const spacingY = (height - padding * 2) / gridSize;

    for (let row = 0; row <= gridSize; row++) {
      for (let col = 0; col <= gridSize; col++) {
        const x = padding + col * spacingX;
        const y = padding + row * spacingY;
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
      const x1 = padding + ((width - padding * 2) / diagCount) * i;
      const y1 = padding + ((height - padding * 2) / diagCount) * i;
      if (!positions.some(p => Math.abs(p.x - x1) < 50 && Math.abs(p.y - y1) < 50))
        positions.push({ x: x1, y: y1 });

      const x2 = padding + ((width - padding * 2) / diagCount) * i;
      const y2 = height - padding - ((height - padding * 2) / diagCount) * i;
      if (!positions.some(p => Math.abs(p.x - x2) < 50 && Math.abs(p.y - y2) < 50))
        positions.push({ x: x2, y: y2 });
    }
  }

  if (density === 5) {
    for (let i = 0; i < 15; i++) {
      positions.push({
        x: padding + Math.random() * (width - padding * 2),
        y: padding + Math.random() * (height - padding * 2),
      });
    }
  }

  return positions;
}

// ---- canvas watermark renderer ---------------------------------------------

function renderWatermarkImage(options) {
  const W = 1240;
  const H = 1754;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // transparent background — the DOCX page background shows through
  ctx.globalAlpha = options.opacity;
  ctx.fillStyle = options.color;
  ctx.font = `${options.fontSize}px "SimHei", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const positions = generateWatermarkPositions(W, H, options.fontSize, options.density);

  for (const pos of positions) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((options.rotation * Math.PI) / 180);
    ctx.fillText(options.text, 0, 0);
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob 返回空，浏览器可能不支持'));
    }, 'image/png');
  });
}
```

- [ ] **Step 2: Add XML manipulation helpers**

Append to `docxWatermark.js`:

```js
// ---- XML helpers (string-based — never use DOMParser) ----------------------

function ensurePngContentType(contentTypesXml) {
  if (contentTypesXml.includes('Extension="png"')) return contentTypesXml;
  return contentTypesXml.replace(
    '</Types>',
    '  <Default Extension="png" ContentType="image/png"/>\n</Types>',
  );
}

function nextRId(relsXml) {
  let max = 0;
  for (const m of relsXml.matchAll(/rId(\d+)/g)) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max + 1;
}

function addImageRelationship(relsXml, rId) {
  const rel = `  <Relationship Id="rId${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/watermark.png"/>\n`;
  return relsXml.replace('</Relationships>', rel + '</Relationships>');
}

const BACKGROUND_VML = (rId) =>
  `<w:background w:color="#FFFFFF">
  <v:background id="_x0000_s4096" o:bwmode="white" o:targetscreensize="1024,768"
    xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <v:fill r:id="rId${rId}" recolor="f" type="frame" o:title="watermark"/>
  </v:background>
</w:background>`;

function injectBackground(documentXml, rId) {
  // Replace if already exists; otherwise insert before <w:body
  if (/<w:background[\s>]/.test(documentXml)) {
    return documentXml.replace(
      /<w:background[\s>][\s\S]*?<\/w:background>/,
      BACKGROUND_VML(rId),
    );
  }
  return documentXml.replace('<w:body', BACKGROUND_VML(rId) + '\n  <w:body');
}
```

- [ ] **Step 3: Add main pipeline function**

Append to `docxWatermark.js`:

```js
// ---- main export -----------------------------------------------------------

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function addWatermarkToDocx(file, watermarkOptions) {
  // --- validate -------------------------------------------------------------

  if (file.size > MAX_SIZE) {
    throw new Error('文件过大，请选择小于 50MB 的 DOCX 文件哦～');
  }

  const options = {
    text: watermarkOptions.text || '水印文本',
    color: watermarkOptions.color || '#000000',
    opacity: parseFloat(watermarkOptions.opacity) || 0.5,
    fontSize: parseInt(watermarkOptions.fontSize) || 45,
    rotation: parseInt(watermarkOptions.rotation) || 45,
    density: parseInt(watermarkOptions.density) || 2,
  };

  // --- load font (best effort) ----------------------------------------------

  await ensureFontLoaded();

  // --- read & unzip ---------------------------------------------------------

  const arrayBuffer = await file.arrayBuffer();

  let zip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new Error('请选择有效的 DOCX 文件哦～（不是 ZIP 格式）');
  }

  // --- verify essential paths -----------------------------------------------

  const CONTENT_TYPES = '[Content_Types].xml';
  const DOC_XML = 'word/document.xml';
  const RELS_XML = 'word/_rels/document.xml.rels';

  if (!zip.file(DOC_XML)) {
    throw new Error('文档结构不标准，请尝试在 Word/WPS 中"另存为"后重试～');
  }

  // --- render watermark image -----------------------------------------------

  let pngBlob;
  try {
    pngBlob = await renderWatermarkImage(options);
  } catch (e) {
    throw new Error('水印图片生成失败: ' + e.message);
  }

  // --- embed image in ZIP ---------------------------------------------------

  zip.file('word/media/watermark.png', pngBlob);

  // --- patch Content_Types.xml ----------------------------------------------

  let ctXml = await zip.file(CONTENT_TYPES).async('string');
  ctXml = ensurePngContentType(ctXml);
  zip.file(CONTENT_TYPES, ctXml);

  // --- patch document.xml.rels ----------------------------------------------

  let relsXml;
  if (zip.file(RELS_XML)) {
    relsXml = await zip.file(RELS_XML).async('string');
  } else {
    // fallback: create minimal rels file
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n</Relationships>`;
  }
  const imgRId = nextRId(relsXml);
  relsXml = addImageRelationship(relsXml, imgRId);
  zip.file(RELS_XML, relsXml);

  // --- patch document.xml ---------------------------------------------------

  let docXml = await zip.file(DOC_XML).async('string');
  docXml = injectBackground(docXml, imgRId);
  zip.file(DOC_XML, docXml);

  // --- re-pack & download ---------------------------------------------------

  const outputBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  saveAs(outputBlob, `水印版_${file.name}`);
}
```

- [ ] **Step 4: Review the complete file for consistency**

Run:
```bash
wc -l src/utils/docxWatermark.js && head -5 src/utils/docxWatermark.js && tail -5 src/utils/docxWatermark.js
```

Expected: file ends with the `addWatermarkToDocx` export, no syntax errors visible.

- [ ] **Step 5: Commit**

```bash
git add src/utils/docxWatermark.js
git commit -m "feat: add DOCX watermark core logic (Canvas render + OOXML injection)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Modify App.vue for dual-format support

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `addWatermarkToDocx` from `@/utils/docxWatermark.js` (Task 2)
- Produces: file input accepts `.pdf,.docx`, handler dispatches to correct watermark function by extension

- [ ] **Step 1: Add import and update file accept attribute**

In `<script setup>`, add the import after the PDF import:

```js
import { addWatermarkToDocx } from './utils/docxWatermark'
```

Change the file input `accept` from `.pdf` to `.pdf,.docx`:

```html
accept=".pdf,.docx"
```

- [ ] **Step 2: Update CardTitle from "选择 PDF 文件" to "选择文件"**

Change:
```html
<CardTitle>📄 选择 PDF 文件</CardTitle>
```

To:
```html
<CardTitle>📄 选择文件</CardTitle>
```

- [ ] **Step 3: Update file validation to accept both PDF and DOCX**

Replace `handleFileChange` function:

Current:
```js
const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file && file.type === 'application/pdf') {
    selectedFile.value = file
    errorMessage.value = ''
  } else {
    selectedFile.value = null
    errorMessage.value = '请选择有效的 PDF 文件哦～'
  }
}
```

New:
```js
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
```

- [ ] **Step 4: Update handleAddWatermark to dispatch by extension**

Replace `handleAddWatermark` function:

Current:
```js
const handleAddWatermark = async () => {
  if (!selectedFile.value) {
    errorMessage.value = '请先选择一个 PDF 文件哦～'
    return
  }

  try {
    isProcessing.value = true
    errorMessage.value = ''
    successMessage.value = ''

    await addWatermarkToPDF(selectedFile.value, {
      ...watermarkOptions,
      opacity: parseFloat(watermarkOptions.opacity),
      fontSize: parseInt(watermarkOptions.fontSize),
      rotation: parseInt(watermarkOptions.rotation),
      density: parseInt(watermarkOptions.density),
    })

    successMessage.value = '水印已添加，文档已保护！✨'
  } catch (error) {
    console.error('处理PDF时出错:', error)
    errorMessage.value = `处理失败: ${error.message}`
  } finally {
    isProcessing.value = false
  }
}
```

New:
```js
const handleAddWatermark = async () => {
  if (!selectedFile.value) {
    errorMessage.value = '请先选择一个文件哦～'
    return
  }

  try {
    isProcessing.value = true
    errorMessage.value = ''
    successMessage.value = ''

    const isDocx = selectedFile.value.name.endsWith('.docx')
    const processedOptions = {
      ...watermarkOptions,
      opacity: parseFloat(watermarkOptions.opacity),
      fontSize: parseInt(watermarkOptions.fontSize),
      rotation: parseInt(watermarkOptions.rotation),
      density: parseInt(watermarkOptions.density),
    }

    if (isDocx) {
      await addWatermarkToDocx(selectedFile.value, processedOptions)
    } else {
      await addWatermarkToPDF(selectedFile.value, processedOptions)
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

- [ ] **Step 5: Update index.html meta description for accuracy**

Modify `index.html`:

```html
<meta name="description" content="twoheart 为踢踢量身定制的文档水印工具，守护她的每一篇稿件 ✨" />
```

- [ ] **Step 6: Commit**

```bash
git add src/App.vue index.html
git commit -m "feat: add DOCX file input support and format dispatch in App.vue

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Verify end-to-end

**Files:**
- No code changes — manual verification only

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```

Expected: Vite dev server starts on localhost.

- [ ] **Step 2: Smoke test — PDF regression**

1. Open the app in a browser
2. Select a PDF file — confirm it's accepted
3. Configure watermark settings and click "✨ 添加水印"
4. Confirm the watermarked PDF downloads and opens correctly

- [ ] **Step 3: Smoke test — DOCX watermark**

1. Select a `.docx` file — confirm it's accepted
2. Use default watermark settings, click "✨ 添加水印"
3. Confirm the watermarked `.docx` downloads
4. Open it in Word / WPS / LibreOffice — confirm the background watermark image displays on all pages

- [ ] **Step 4: Edge cases**

1. Try uploading a `.doc` file (should be rejected with error message)
2. Try a file without extension (should be rejected)
3. Try a DOCX > 50MB (should be rejected with size error)
4. Change watermark text to Chinese, adjust density/size — confirm output reflects settings
5. Verify the watermarked DOCX still has its original content (text, tables, images) intact

- [ ] **Step 5: Run production build**

Run:
```bash
pnpm build
```

Expected: build succeeds with no errors, `jszip` bundled correctly.

---
