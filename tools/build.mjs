#!/usr/bin/env node
// Сборка артефакта расширения для Chrome Web Store.
//
// Текущее состояние: vanilla content scripts без bundler — просто копируем
// рантайм-файлы в dist/, исключая node-репку MCP-сервера, docs, dev-файлы.
// Когда (если) перейдём на ESM-модули в options/ — этот же скрипт будет
// запускать esbuild перед копированием.
//
// Использование:
//   node tools/build.mjs           # → dist/ + tweai-v<version>.zip
//   node tools/build.mjs --no-zip  # только dist/

import { readFile, rm, mkdir, cp, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const INCLUDE = [
  'manifest.json',
  'background.js',
  'content_script.js',
  'selectors.js',
  'dev-logger.js',
  'ad-blocker.js',
  'profile-scraper.js',
  'options.html',
  'options.js',
  'options.css',
  'styles.css',
  'icons',
  '_locales',
  'LICENSE',
];

async function readVersion() {
  const m = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  return m.version;
}

async function copyTree(src, dst) {
  await cp(src, dst, { recursive: true });
}

async function zipDir(srcDir, outZip) {
  // Используем системный `zip` — он есть на macOS/Linux и GitHub Actions
  // runner. Без extra deps: добавлять JS-zip-библиотеку ради одной операции
  // не стоит.
  await new Promise((resolve, reject) => {
    const proc = spawn('zip', ['-r', outZip, '.'], { cwd: srcDir, stdio: 'inherit' });
    proc.on('exit', code => (code === 0 ? resolve() : reject(new Error(`zip exit ${code}`))));
    proc.on('error', reject);
  });
}

async function main() {
  const version = await readVersion();
  const wantZip = !process.argv.includes('--no-zip');

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const name of INCLUDE) {
    const src = join(ROOT, name);
    const dst = join(DIST, name);
    try {
      await stat(src);
    } catch {
      console.warn(`[build] skip missing: ${name}`);
      continue;
    }
    await copyTree(src, dst);
  }

  console.log(`[build] dist/ ready — version ${version}`);
  const entries = await readdir(DIST);
  console.log(`[build] ${entries.length} top-level entries`);

  if (wantZip) {
    const zipPath = join(ROOT, `tweai-v${version}.zip`);
    await rm(zipPath, { force: true });
    await zipDir(DIST, zipPath);
    const s = await stat(zipPath);
    console.log(`[build] wrote ${zipPath} (${(s.size / 1024).toFixed(1)} KB)`);
  }
}

main().catch(e => {
  console.error('[build] failed:', e);
  process.exit(1);
});
