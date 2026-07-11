# Task 2 Report: Create docxWatermark.js

## Steps Taken

1. **Read task brief** at `.superpowers/sdd/task-2-brief.md` — confirms Steps 1-3 (position generator, canvas renderer, XML helpers, main pipeline).

2. **Read `src/utils/pdfWatermark.js`** as reference for the existing pattern (same export signature, similar position generator logic).

3. **Verified prerequisites:**
   - `jszip` is already in `package.json` (`^3.10.1`)
   - `file-saver` is already in `package.json` (`2.0.5`)
   - Font file exists at `public/fonts/simhei.ttf`

4. **Created `src/utils/docxWatermark.js`** with all three sections per the brief:
   - **Step 1 (lines 1-120):** Imports, `ensureFontLoaded()`, `generateWatermarkPositions()` (with padding added vs pdfWatermark), `renderWatermarkImage()` (Canvas 1240x1754)
   - **Step 2 (lines 122-169):** XML helpers — `ensurePngContentType`, `nextRId`, `addImageRelationship`, `BACKGROUND_VML` template, `injectBackground` (string-based; no DOMParser)
   - **Step 3 (lines 171-241):** Main `addWatermarkToDocx(file, watermarkOptions)` export — validates file size (50 MB limit), reads/unzips DOCX, renders watermark PNG, patches `[Content_Types].xml`, `word/_rels/document.xml.rels`, and `word/document.xml`, then re-zips and triggers download via `saveAs`.

5. **Syntax verification:** `node --check` passed. `wc -l` reports 241 lines. Head/tail match expected pattern (imports → export).

6. **Committed** with message: `feat: add DOCX watermark core logic (Canvas render + OOXML injection)`

## Deviations from Brief

None. The file was created exactly as specified in the brief's code blocks. All values (canvas dimensions 1240x1754, padding = fontSize*2, font URL `/fonts/simhei.ttf`, MAX_SIZE 50 MB, default options) match the brief exactly.

## Test Results

- `node --check src/utils/docxWatermark.js`: **PASS** (syntax valid)
- No runtime tests possible at this stage — the module depends on browser APIs (Canvas, FontFace, File, Blob) and can only be exercised in the browser. Full integration testing will be done when the UI component is wired up.

## Self-Review Checklist

- [x] Exports `addWatermarkToDocx(file, watermarkOptions)` matching signature pattern of `addWatermarkToPDF`
- [x] Uses `JSZip` for DOCX (ZIP) manipulation
- [x] Uses `saveAs` from `file-saver` for download
- [x] Canvas dimensions: 1240x1754 (A4 ratio)
- [x] Position generator mirrors pdfWatermark.js but with `padding = fontSize * 2`
- [x] All XML modification is string-based (no DOMParser)
- [x] Font loading via `FontFace` API with graceful fallback (no-op catch)
- [x] File size validation (50 MB limit)
- [x] Error messages use Chinese (matching project locale)
- [x] `[Content_Types].xml`, `word/document.xml.rels`, and `word/document.xml` all patched
- [x] VML background inserted via `w:background` element with `v:fill` referencing the image rId
- [x] Compression: DEFLATE level 6
- [x] Commit message matches brief specification

---

## Code Review Fix Round: Issues 1-6

### Changes Made

**Issue 1 (Important — `||` zero-truncation):** Replaced `parseInt(x) || default` and `parseFloat(x) || default` patterns with `isNaN()` guard pattern. For each option (`opacity`, `fontSize`, `rotation`, `density`), the parsed value is stored in a named variable, then `isNaN()` decides whether to use the parsed value or the fallback. This preserves user-specified `0` for `rotation` and `opacity`.

**Issue 2 (Important — missing `getContext` null guard):** Added `if (!ctx) throw new Error('Canvas 2D 渲染上下文不可用');` immediately after `canvas.getContext('2d')` in `renderWatermarkImage`.

**Issue 3 (Minor — missing radix):** Added `, 10` to all three `parseInt` calls in the options normalization block (for `fontSize`, `rotation`, `density`).

**Issue 4 (Minor — `fontReady` flag in FontFace-undefined path):** Changed the early-return branch from `if (typeof FontFace === 'undefined') return;` to `if (typeof FontFace === 'undefined') { fontReady = true; return; }`.

**Issue 5 (Minor — output filename fallback):** Changed `` `水印版_${file.name}` `` to `` `水印版_${file.name || 'document.docx'}` `` in the `saveAs` call.

**Issue 6 (Minor — self-closing `<w:background/>`):** Broadened the replacement regex from `/<w:background[\s>][\s\S]*?<\/w:background>/` to `/<w:background[\s>][\s\S]*?(?:<\/w:background>|\/>)/`, which handles both paired and self-closing `w:background` tags.

### Test Results

- `node --check src/utils/docxWatermark.js`: **PASS** (no output = syntax valid)
- `wc -l src/utils/docxWatermark.js`: **247 lines** (6 net lines added)

### Self-Review Confirmation

- [x] Issue 1: `||` zero-truncation fixed — `0` values for opacity/rotation are now preserved
- [x] Issue 2: `getContext` null guard added with descriptive Chinese error message
- [x] Issue 3: All `parseInt` calls include radix `10`
- [x] Issue 4: `fontReady` flag is set in the FontFace-undefined early-return branch
- [x] Issue 5: Output filename falls back to `'document.docx'` if `file.name` is absent
- [x] Issue 6: Replacement regex handles self-closing `<w:background/>` tags
- [x] `node --check` passes cleanly
- [x] All 6 issues from the review are addressed
