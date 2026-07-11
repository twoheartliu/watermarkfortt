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
  if (!ctx) throw new Error('Canvas 2D 渲染上下文不可用');

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
      /<w:background[\s>][\s\S]*?(?:<\/w:background>|\/>)/,
      BACKGROUND_VML(rId),
    );
  }
  return documentXml.replace('<w:body', BACKGROUND_VML(rId) + '\n  <w:body');
}

// ---- main export -----------------------------------------------------------

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function addWatermarkToDocx(file, watermarkOptions) {
  // --- validate -------------------------------------------------------------

  if (file.size > MAX_SIZE) {
    throw new Error('文件过大，请选择小于 50MB 的 DOCX 文件哦～');
  }

  const parsedOpacity = parseFloat(watermarkOptions.opacity);
  const parsedFontSize = parseInt(watermarkOptions.fontSize, 10);
  const parsedRotation = parseInt(watermarkOptions.rotation, 10);
  const parsedDensity = parseInt(watermarkOptions.density, 10);

  const options = {
    text: watermarkOptions.text || '水印文本',
    color: watermarkOptions.color || '#000000',
    opacity: isNaN(parsedOpacity) ? 0.5 : parsedOpacity,
    fontSize: isNaN(parsedFontSize) ? 45 : parsedFontSize,
    rotation: isNaN(parsedRotation) ? 45 : parsedRotation,
    density: isNaN(parsedDensity) ? 2 : parsedDensity,
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
  saveAs(outputBlob, `水印版_${file.name || 'document.docx'}`);
}
