import { execFile } from 'node:child_process';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

import express from 'express';
import cors from 'cors';
import multer from 'multer';

const PORT = process.env.PORT || 3001;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const app = express();
const upload = multer({ dest: tmpdir(), limits: { fileSize: MAX_SIZE } });

app.use(cors());

// ---- health check -----------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---- DOCX → PDF conversion -------------------------------------------------

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '未上传文件哦～' });
  }

  const workDir = join(tmpdir(), randomUUID());
  const inputPath = join(workDir, req.file.originalname);
  let pdfPath;

  try {
    await mkdir(workDir);

    // move multer file to work dir with original name (so LibreOffice uses correct extension)
    await (await import('node:fs/promises')).copyFile(req.file.path, inputPath);

    // headless conversion
    await new Promise((resolve, reject) => {
      execFile(
        'libreoffice',
        ['--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath],
        { timeout: 120_000 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(stderr || stdout || err.message));
          } else {
            resolve(stdout);
          }
        },
      );
    });

    // find the generated PDF
    const inputBase = basename(req.file.originalname).replace(/\.[^.]+$/, '');
    pdfPath = join(workDir, `${inputBase}.pdf`);

    const pdfBuffer = await readFile(pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inputBase}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('转换失败:', err);
    res.status(500).json({ message: `文档转换失败: ${err.message}` });
  } finally {
    // cleanup — best-effort, don't block response
    rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (req.file && req.file.path) {
      rm(req.file.path, { force: true }).catch(() => {});
    }
  }
});

// ---- start ------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`水印转换服务已启动 http://localhost:${PORT}`);
});
