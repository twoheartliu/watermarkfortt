# 图片水印支持 — 设计文档

> 日期：2026-07-11  
> 状态：已确认  
> 目标：新增图片水印模式，通过 Tab 切换与文件模式并存

## 范围

- **DO**: 支持 JPG/PNG/WebP 等常见图片格式上传，Canvas 加水印，保持原图格式输出，多图打包 ZIP
- **DO NOT**: 改动现有文件模式（PDF/DOCX）的行为；引入后端；支持 GIF 动画

## Tab 切换

页面顶部增加两个 Tab：

| Tab | 标签 | 文件选择 | 输出 |
|-----|------|----------|------|
| 文件水印 | 📄 文件水印 | 单文件 `.pdf,.docx` | 带水印 PDF |
| 图片水印 | 🖼️ 图片水印 | 多文件 `image/*` | 单张图片 或 ZIP |

水印样式设置区域完全共用，只文件选择区域随 Tab 切换。

## 架构

```
src/
├── utils/
│   ├── pdfWatermark.js       ← 不变
│   └── imageWatermark.js     ← 新增
├── App.vue                   ← 加 Tab + 图片模式
```

## 依赖

```diff
+ "jszip": "^3.10.1"   # 恢复，用于图片 ZIP 打包
```

## 核心流程

```
选择 N 张图片
  │
  ├─ N = 1 → Canvas 绘制原图 → 叠加水印文字 → toBlob → 单张下载
  │
  └─ N > 1 → 逐张 Canvas 加水印 → JSZip 打包 → 下载 水印版图片.zip
```

### `imageWatermark.js` 函数签名

```js
export async function addWatermarkToImages(files, watermarkOptions) => Promise<void>
```

内部复用 `generateWatermarkPositions()`（与 pdfWatermark.js 同款算法）。

### Canvas 渲染

1. `ctx.drawImage(img, 0, 0, canvas.width, canvas.height)` — 图片撑满画布
2. `ctx.textAlign = 'center'; ctx.textBaseline = 'middle'`
3. 遍历位置数组 → `ctx.save()` → `translate + rotate` → `fillText` → `ctx.restore()`
4. `canvas.toBlob(mimeType)` 按原图 MIME 导出

### 格式保持规则

| 原图格式 | 导出 MIME | 说明 |
|----------|-----------|------|
| PNG | `image/png` | 保持 |
| JPEG | `image/jpeg` | 保持 |
| WebP | `image/webp` | 保持 |
| 其他 | `image/png` | 降级 |

### 字体

通过 FontFace API 加载 `/fonts/simhei.ttf`，Canvas `ctx.font` 使用 `"SimHei"`，失败时降级系统字体。

## App.vue 变更

### Tab 状态

```js
const activeTab = ref('file') // 'file' | 'image'
```

### 图片模式文件处理

```js
const imageFiles = ref([]) // File[]

const handleImageChange = (event) => {
  const files = Array.from(event.target.files)
  imageFiles.value = files.filter(f => f.type.startsWith('image/'))
}
```

### 水印按钮逻辑

```js
if (activeTab.value === 'image') {
  await addWatermarkToImages(imageFiles.value, processedOptions)
} else {
  // 现有文件模式逻辑
}
```

## 错误处理

| 场景 | 处理 |
|------|------|
| 未选图片 | 提示"请先选择图片哦～" |
| 图片加载失败 | 跳过该张，继续处理其余，完成时提示"X 张处理成功，Y 张失败" |
| Canvas 不可用 | 同 PDF 方案，getContext 空值检查 |

## 不做的

- GIF 动画水印 — Canvas 只能处理静态帧
- 图片裁剪/缩放/压缩 — 保持原尺寸
- HEIC/RAW 等专业格式

## 测试策略

- 单张 PNG/JPG → 下载单文件，确认水印 + 原格式
- 多张混合格式 → ZIP 下载，解压确认每张
- Tab 切换不影响文件模式 PDF/DOCX
- 大图（>10MB）不卡死
