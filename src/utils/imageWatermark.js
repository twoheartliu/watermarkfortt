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
