#!/usr/bin/env node
// Pulls CC0 photo textures (grass, moss, leaf litter, sand, dirt, paving, rock) from Poly Haven
// (ambientCG as the fallback), turns each into a small seamless greyscale detail tile and writes
// www/assets/textures/ with an index. The garden lays these over its painted ground.
//
//   npm i --no-save jpeg-js && node tools/fetch-textures.mjs
//   node tools/fetch-textures.mjs --local <dir-of-jpgs>     (testing: one set per file name)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/textures.json'), 'utf8'));
const OUT = path.join(ROOT, 'www/assets/textures');
const UA = 'TheFeed-texture-fetcher/1.0 (https://github.com/fuzzhawk/Xxx_th3_f33d_xxX)';
const S = cfg.size || 64;
const log = [];
const say = (...m) => { const l = m.join(' '); log.push(l); console.log(l); };
const jpeg = (await import('jpeg-js')).default;

async function get(url, binary) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
}

// a photo becomes a seamless greyscale detail tile: area-average down to S×S (seamless textures stay
// seamless), then centre the brightness on mid-grey and set a steady contrast, so 'overlay' adds
// the photo's grain without shifting the painted colour
function detail(buf) {
  const im = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 }), { width: w, height: h, data: d } = im;
  const side = Math.min(w, h), lum = new Float32Array(S * S);
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) {
    const x0 = Math.floor((X / S) * side), x1 = Math.floor(((X + 1) / S) * side), y0 = Math.floor((Y / S) * side), y1 = Math.floor(((Y + 1) / S) * side);
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; n++; }
    lum[Y * S + X] = sum / Math.max(1, n);
  }
  let mean = 0; for (const v of lum) mean += v; mean /= lum.length;
  let sd = 0; for (const v of lum) sd += (v - mean) ** 2; sd = Math.sqrt(sd / lum.length) || 1;
  const out = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { const g = Math.max(0, Math.min(255, Math.round(128 + ((lum[i] - mean) / sd) * 34))); out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g; out[i * 4 + 3] = 255; }
  return out;
}
const words = (a) => `${a.name || ''} ${(a.tags || []).join(' ')} ${(a.categories || []).join(' ')}`.toLowerCase().replace(/[_-]+/g, ' ');
const matches = (txt, set) => set.any.some((w) => txt.includes(w)) && !(set.not || []).some((w) => txt.includes(w));

// ------------------------------------------------ Poly Haven
let phList = null;
async function polyHaven(key, set, used) {
  phList ??= await get('https://api.polyhaven.com/assets?t=textures');
  const cands = Object.entries(phList).filter(([id, a]) => !used.has(id) && matches(`${id} ${words(a)}`, set)).sort((a, b) => (b[1].download_count || 0) - (a[1].download_count || 0));
  const got = [];
  for (const [id] of cands) {
    if (got.length >= set.keep) break;
    try {
      let url = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}_diff_1k.jpg`;
      try { const f = await get(`https://api.polyhaven.com/files/${id}`); const D = f.Diffuse || f.diffuse || f.Color || f.diff; url = D?.['1k']?.jpg?.url || url; } catch { /* the usual path */ }
      got.push({ id, src: `polyhaven.com/a/${id}`, buf: await get(url, true) });
      used.add(id);
    } catch (e) { say(`  polyhaven ${id}: ${e.message}`); }
  }
  return got;
}
// ------------------------------------------------ ambientCG
async function ambientCG(key, set, used, tmp) {
  const q = encodeURIComponent(set.ambient || key);
  const j = await get(`https://ambientcg.com/api/v2/full_json?type=Material&q=${q}&include=downloadData&sort=Popular&limit=12`);
  const got = [];
  for (const a of j.foundAssets || []) {
    if (got.length >= set.keep) break;
    if (used.has(a.assetId) || !matches(`${a.assetId} ${words({ name: a.displayName, tags: a.tags, categories: [a.displayCategory] })}`, set)) continue;
    const dl = (a.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads || []).find((d) => /^1K-JPG$/i.test(d.attribute));
    if (!dl) continue;
    try {
      const zip = path.join(tmp, `${a.assetId}.zip`), dir = path.join(tmp, a.assetId);
      fs.writeFileSync(zip, await get(dl.fullDownloadPath || dl.downloadLink, true));
      execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
      const col = fs.readdirSync(dir).find((f) => /_Color\.jpe?g$/i.test(f));
      if (!col) continue;
      got.push({ id: a.assetId, src: `ambientcg.com/view?id=${a.assetId}`, buf: fs.readFileSync(path.join(dir, col)) });
      used.add(a.assetId);
    } catch (e) { say(`  ambientcg ${a.assetId}: ${e.message}`); }
  }
  return got;
}

// ------------------------------------------------ run
const args = process.argv.slice(2), local = args[0] === '--local' ? args[1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tex-'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const index = { license: 'CC0 1.0: Poly Haven (polyhaven.com) and ambientCG (ambientcg.com)', made: new Date().toISOString().slice(0, 10), size: S, sets: {}, credits: {} };
const used = new Set();
for (const [key, set] of Object.entries(cfg.sets)) {
  let got = [];
  if (local) {
    got = fs.readdirSync(local).filter((f) => f.startsWith(key) && /\.jpe?g$/i.test(f)).map((f) => ({ id: f.replace(/\.\w+$/, ''), src: 'local', buf: fs.readFileSync(path.join(local, f)) }));
  } else {
    try { got = await polyHaven(key, set, used); } catch (e) { say(`  polyhaven list: ${e.message}`); }
    if (got.length < set.keep) { try { got = got.concat(await ambientCG(key, set, used, tmp)).slice(0, set.keep); } catch (e) { say(`  ambientcg: ${e.message}`); } }
  }
  for (const g of got) {
    try {
      const f = `${key}-${g.id}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
      fs.writeFileSync(path.join(OUT, f), encodePNG(S, S, detail(g.buf)));
      (index.sets[key] ||= []).push(f); index.credits[f] = g.src;
    } catch (e) { say(`  ${key} ${g.id}: ${e.message}`); }
  }
  say(`${key}: ${(index.sets[key] || []).map((f) => index.credits[f]).join(', ') || 'none'}`);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
say(`total ${Object.values(index.sets).flat().length} textures`);
fs.writeFileSync(path.join(OUT, 'fetch-log.txt'), log.join('\n') + '\n');
