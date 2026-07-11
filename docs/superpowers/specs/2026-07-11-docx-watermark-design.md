# DOCX 水印支持 — 设计文档

> 日期：2026-07-11  
> 状态：已确认  
> 目标：在现有 PDF 水印工具基础上，增加对 DOCX 格式的纯前端水印支持

## 范围

- **DO**: 支持 DOCX（Office Open XML）文件，添加图片背景水印，输出带水印的 DOCX
- **DO NOT**: 支持 .doc（二进制）、.wps 格式；引入后端服务；改动现有 PDF 功能

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 实现方式 | 图片背景水印（Canvas → PNG → `<w:background>`） | 密度/位置可控，效果最接近 PDF |
| 覆盖范围 | 所有页面 | 用户明确要求 |
| 部署模式 | 纯前端（浏览器） | 与现有隐私保证一致 |
| 核心依赖 | `jszip` | 纯 JS 库，浏览器端解包/打包 ZIP |

## 架构

```
src/
├── utils/
│   ├── pdfWatermark.js      ← 已有，不改动
│   └── docxWatermark.js     ← 新增
├── App.vue                   ← 修改：双格式文件选择 + 分发
```

### 函数签名

```js
// docxWatermark.js — 与 PDF 同签名，App.vue 按文件扩展名分发
export async function addWatermarkToDocx(file, watermarkOptions) => Promise<void>
```

### 依赖变更

```diff
# package.json
+ "jszip": "^3.10.1"
```

`jszip` 是成熟的纯 JS 库，零依赖，浏览器/Node 双环境，gzip 后约 20KB。

---

## 核心流程

```
DOCX 文件 (file)
  │
  ├─ 1. JSZip 读取 & 解包
  │     zip = await JSZip.loadAsync(arrayBuffer)
  │
  ├─ 2. Canvas 渲染水印图
  │     canvas (A4 比例, 150 DPI: 1240×1754 px)
  │     → 按 density 生成网格
  │     → 每格绘制旋转文字 (color / opacity / fontSize / rotation)
  │     → canvas.toBlob("image/png")
  │
  ├─ 3. 写入图片
  │     zip.file("word/media/watermark.png", pngBlob)
  │
  ├─ 4. 修改 XML
  │     ├─ [Content_Types].xml → 注册 image/png
  │     ├─ word/_rels/document.xml.rels → 添加图片关系
  │     └─ word/document.xml → 添加 <w:background> VML 元素
  │
  └─ 5. 重新打包 & 下载
        const outputBlob = await zip.generateAsync({ type: "blob" })
        saveAs(outputBlob, `水印版_${file.name}`)
```

---

## OOXML 修改细节

### 4a. `[Content_Types].xml` — 注册 PNG

如果不存在 `<Default Extension="png" ...>` 则追加：

```xml
<Default Extension="png" ContentType="image/png"/>
```

### 4b. `word/_rels/document.xml.rels` — 添加关系

追加新的 Relationship（rId 按已有最大值递增，如现有最大为 rId99 则新编 rId100，避免冲突）：

```xml
<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
  Target="media/watermark.png"/>
```

### 4c. `word/document.xml` — 添加背景

在 `<w:body>` 之前插入 `<w:background>`：

```xml
<w:background w:color="#FFFFFF">
  <v:background id="_x0000_s4096" o:bwmode="white" o:targetscreensize="1024,768"
    xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <v:fill r:id="rId100" recolor="f" type="frame" o:title="watermark"/>
  </v:background>
</w:background>
```

`type="frame"` 确保图片拉伸填充整页。`recolor="f"` 禁用重新着色以保持水印颜色。

> **兼容性说明**：`<w:background>` + VML 是 OOXML 标准做法，在 Word 桌面版、WPS Office、LibreOffice 中正常工作。但基于 Web 的阅读器（Google Docs、Office Online、SharePoint 预览）通常不完全支持 VML 背景渲染 — 这些环境下需要下载后打开才能看到水印，这是 OOXML 格式的固有限制。

### XML 操作策略

- **不要用 DOM parser** — 解析后会丢失命名空间、DTD 和格式化，重新序列化可能生成无效 OOXML
- **用字符串匹配插值** — `document.xml` 中搜索 `<w:body>` 标签，在前方插入 `<w:background>` 块；rels 文件在 `</Relationships>` 前追加子元素；Content_Types 在 `</Types>` 前追加
- 这种保守策略仅修改必要位置，不影响文档其他部分

---

## 水印图片渲染

Canvas 渲染算法复用 PDF 方案的位置生成逻辑，差异在于：

| 维度 | PDF | DOCX |
|------|-----|------|
| 渲染方式 | 每页独立绘制文字 | 一张整体图片覆盖所有页 |
| 画布尺寸 | 页面尺寸 | 固定 A4 比例 1240×1754 px |
| 旋转 | pdf-lib `degrees()` | Canvas `ctx.rotate()` |

其他参数（text / color / opacity / fontSize / rotation / density）保持一致，共用水印设置 UI。

---

## 错误处理

| 场景 | 处理 |
|------|------|
| 文件非 ZIP（如 .doc 伪装） | `JSZip.loadAsync` 失败 → 提示"请选择有效的 DOCX 文件" |
| 文件过大（>50MB） | 加载前检查 `file.size` → 提示限制 |
| XML 结构异常 | 关键标签匹配失败 → 提示"文档结构不标准，请尝试另存为后重试" |
| Canvas 不可用 | `document.createElement('canvas')` 检查 → 降级提示 |
| 已有背景被覆盖 | `document.xml` 中已有 `<w:background>` → 替换而非追加 |

---

## UI 变更（最小化）

仅改 App.vue 两处：

1. **文件选择器 accept**：`.pdf` → `.pdf,.docx`
2. **CardTitle**：`选择 PDF 文件` → `选择文件`
3. **校验逻辑**：`file.type === 'application/pdf'` → 增加对 `application/vnd.openxmlformats-officedocument.wordprocessingml.document` 的兼容（部分浏览器对 DOCX 返回空 MIME，需同时检查扩展名 `.docx`）

其余 UI（水印样式卡片、按钮、状态提示）完全不变。

---

## 测试策略

- **单元测试（手动）**：用空白 DOCX 测试 → 下载后 WPS/Word/LibreOffice 打开确认水印显示；验证参数组合（不同文字、颜色、密度）
- **回归测试**：PDF 功能不受影响
- **边界测试**：大文件、含表格/图片的复杂 DOCX、已有背景的 DOCX、各种 Word 版本生成的 DOCX

---

## 不做的

- .doc（Word 97-2003 二进制格式）— 浏览器无可靠解析方案
- .wps（WPS 格式）— 同上是二进制格式
- 水印不可去除 — DOCX 可编辑特性意味着导出后使用者可以手动删除水印背景，这不在范围内
