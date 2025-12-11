import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import config from '../config.js';

export async function ensureDir(dir) {
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
}

export async function saveFileTemp(tempPath, workspaceId, filename) {
  const dir = path.join(config.storagePath, workspaceId);
  await ensureDir(dir);
  const dest = path.join(dir, filename);
  await fs.copyFile(tempPath, dest);
  return dest;
}

export async function readFile(filePath) {
  return fs.readFile(filePath);
}

export async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // ignore
  }
}
