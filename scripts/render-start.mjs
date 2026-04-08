/**
 * Production start: ensures dist/ exists (Render may skip build or use wrong root).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distIndex = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.warn('[GreetEase] dist/ missing — running npm run build.');
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.error('[GreetEase] npm run build failed');
    process.exit(r.status ?? 1);
  }
}

await import('../server/index.mjs');
