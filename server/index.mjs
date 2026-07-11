import { execFile } from 'node:child_process';
import { rm, mkdir, readFile, copyFile } from 'node:fs/promises';
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

app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok' });
});

// ---- DOCX → PDF conversion -------------------------------------------------

app.post(['/api/convert', '/convert'], upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '未上传文件哦～' });
  }

  const workDir = join(tmpdir(), randomUUID());
  const ext = req.file.originalname.match(/\.([^.]+)$/)?.[1] || 'docx';
  const inputPath = join(workDir, `input.${ext}`);
  const pdfPath = join(workDir, 'input.pdf');

  try {
    await mkdir(workDir);

    // copy to work dir with ASCII name to avoid LibreOffice encoding issues
    await copyFile(req.file.path, inputPath);

    // headless conversion — use cwd so PDF lands in workDir
    await new Promise((resolve, reject) => {
      execFile(
        'libreoffice',
        ['--headless', '--convert-to', 'pdf', inputPath],
        { timeout: 120_000, cwd: workDir },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(stderr || stdout || err.message));
          } else {
            resolve(stdout);
          }
        },
      );
    });

    const pdfBuffer = await readFile(pdfPath);
    const outputName = basename(req.file.originalname).replace(/\.[^.]+$/, '.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(outputName)}`);
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
