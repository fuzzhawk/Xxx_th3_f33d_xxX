#!/usr/bin/env node
// Copies the newest package into www/bundled/ so the APK works offline from the
// first launch, and writes www/build-info.js.
//
//   node tools/bundle-package.mjs [--src packages] [--id 2026-W43]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2);
const opt = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
const src = path.resolve(ROOT, opt('src') || 'packages');
const out = path.join(ROOT, 'www/bundled');

const sh = (c) => { try { return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const branch = process.env.BUILD_BRANCH || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || sh('git rev-parse --abbrev-ref HEAD') || 'main';
const sha = (process.env.GITHUB_SHA || sh('git rev-parse HEAD') || 'dev').slice(0, 7);
fs.writeFileSync(path.join(ROOT, 'www/build-info.js'), `window.BUILD = ${JSON.stringify({ branch, sha, date: new Date().toISOString().slice(0, 10) })};\n`);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let id = opt('id');
const indexPath = path.join(src, 'index.json');
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : { packages: [] };
if (!id) {
  id = index.latest || index.packages.at(-1)?.id;
  if (!id) {
    // no index (e.g. an offline test build): take the newest package directory
    id = fs.readdirSync(src).filter((d) => fs.existsSync(path.join(src, d, 'manifest.json'))).sort().at(-1);
  }
}
if (!id) { console.log('No package to bundle; the app will download one on first launch.'); fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ packages: [] })); process.exit(0); }
fs.cpSync(path.join(src, id), path.join(out, id), { recursive: true });
const man = JSON.parse(fs.readFileSync(path.join(src, id, 'manifest.json'), 'utf8'));
const entry = index.packages.find((p) => p.id === id) || { id, title: man.title, created: man.created, total: man.total, counts: man.counts, estHours: man.estHours };
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ latest: id, packages: [entry] }, null, 2));
console.log(`Bundled ${id} (${man.total} posts) · build ${branch}@${sha}`);
