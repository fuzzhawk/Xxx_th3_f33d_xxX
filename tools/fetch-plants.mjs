#!/usr/bin/env node
// Pulls CC0 plant sprites (trees, bushes, flowers, mushrooms, crops, grasses) out of Kenney asset
// packs, trims them, shrinks them to garden pixel sizes and writes www/assets/plants/ with an
// index. The garden picks a different handful of them every day as wild flora.
//
//   node tools/fetch-plants.mjs                 download the packs in tools/data/plants.json
//   node tools/fetch-plants.mjs --local <dir>   process PNGs already on disk (for testing)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/plants.json'), 'utf8'));
const OUT = path.join(ROOT, 'www/assets/plants');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const log = [];
const say = (...m) => { const l = m.join(' '); log.push(l); console.log(l); };

// ------------------------------------------------ what a plant is
const NAMED = /(^|[^a-z])(tree|trees|pine|palm|birch|oak|willow|bush|bushes|shrub|hedge|fern|plant|plants|flower|flowers|rose|tulip|daisy|lily|sunflower|lavender|poppy|mushroom|shroom|toadstool|cactus|crop|crops|wheat|corn|carrot|pumpkin|lettuce|cabbage|tomato|potato|berry|berries|grass|reed|reeds|clover|weed|vine|leaf|leaves|sapling|stump|lilypad|seaweed|coral)(?![a-z])/i;
const NOT = /(grass|dirt|sand|snow|stone)(block|center|mid|half|cliff|left|right|corner|hill|top|bottom|edge|ramp|slope|platform|tile|ground)|ground|terrain|platform|wall|floor|road|path|button|icon|ui_|hud|fence|sign|house|roof|door|window|car|truck|character|player|enemy/i;
const KIND = [
  ['tree', /tree|pine|palm|birch|oak|willow|sapling|stump/i],
  ['mushroom', /mushroom|shroom|toadstool/i],
  ['cactus', /cactus/i],
  ['crop', /crop|wheat|corn|carrot|pumpkin|lettuce|cabbage|tomato|potato/i],
  ['flower', /flower|rose|tulip|daisy|lily|sunflower|lavender|poppy/i],
  ['grass', /grass|reed|clover|weed|seaweed/i],
  ['bush', /bush|shrub|hedge|fern|berry|berries|plant|vine|leaf|leaves|coral/i]
];
// target height in world pixels (a tile is 16) and width cap
const SIZE = { tree: [34, 30], bush: [16, 20], flower: [13, 12], mushroom: [11, 12], cactus: [20, 14], crop: [14, 14], grass: [12, 14] };

const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255]; };

function load(buf) {
  const im = decodePNG(buf), { w, h } = im, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(im.rgba(x, y), (y * w + x) * 4);
  return { w, h, d };
}
// crop to the opaque pixels
function trim(img) {
  const { w, h, d } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const W = x1 - x0 + 1, H = y1 - y0 + 1, o = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) o.set(d.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * W * 4);
  return { w: W, h: H, d: o };
}
// how plant-like it looks: share of leaf-green and of flower colours among the opaque pixels,
// how full its box is, and whether its whole bottom row is solid (a ground tile, not a plant)
function looks(img) {
  const { w, h, d } = img;
  let n = 0, green = 0, bloom = 0, brown = 0, grey = 0, bottom = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] < 128) continue;
    if (y === h - 1) bottom++;
    const [H, S, V] = hsv(d[i], d[i + 1], d[i + 2]);
    if (V < 0.22) continue;   // outlines and shadow: neither leaf nor petal
    n++;
    if (S < 0.15) grey++;
    else if (H >= 50 && H <= 175) green++;
    else if ((H >= 280 || H <= 20 || (H >= 40 && H <= 62)) && S > 0.3 && V > 0.45) bloom++;
    else if (H > 15 && H < 45 && V < 0.7) brown++;
  }
  return { fill: n / (w * h), green: n ? green / n : 0, bloom: n ? bloom / n : 0, brown: n ? brown / n : 0, grey: n ? grey / n : 0, bottom: bottom / w };
}
function kindOf(name, img, L) {
  for (const [k, re] of KIND) if (re.test(name)) return k;
  const tall = img.h / img.w;
  if (tall > 1.3 && img.h >= 24) return 'tree';
  if (L.bloom > 0.12) return 'flower';
  if (tall < 0.7) return 'grass';
  return 'bush';
}
// area-average shrink (premultiplied), so detail turns into honest pixels rather than noise
function shrink(img, kind) {
  const [th, tw] = SIZE[kind];
  const k = Math.min(1, th / img.h, tw / img.w);
  if (k >= 1) return img;
  const W = Math.max(1, Math.round(img.w * k)), H = Math.max(1, Math.round(img.h * k)), o = new Uint8ClampedArray(W * H * 4);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const sx0 = (X / W) * img.w, sx1 = ((X + 1) / W) * img.w, sy0 = (Y / H) * img.h, sy1 = ((Y + 1) / H) * img.h;
    let r = 0, g = 0, b = 0, a = 0, wt = 0;
    for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
      const i = (y * img.w + x) * 4, A = img.d[i + 3] / 255; r += img.d[i] * A; g += img.d[i + 1] * A; b += img.d[i + 2] * A; a += A; wt++;
    }
    const j = (Y * W + X) * 4;
    if (a > 0) { o[j] = r / a; o[j + 1] = g / a; o[j + 2] = b / a; }
    o[j + 3] = (a / wt) * 255;
  }
  return { w: W, h: H, d: o };
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.png$/i.test(e.name)) out.push(p);
  }
  return out;
}
async function get(url, binary) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}
let sitemap = null;
async function download(pack, tmp) {
  let html;
  try { html = await get(`https://kenney.nl/assets/${pack.slug}`); }
  catch (e) {
    const q = pack.search || pack.slug.replace(/-/g, ' ');
    sitemap ??= (await get('https://kenney.nl/sitemap.xml').catch(() => '')) + (await get(`https://kenney.nl/assets?search=${encodeURIComponent(q)}`).catch(() => ''));
    const slugs = [...new Set([...sitemap.matchAll(/kenney\.nl\/assets\/([a-z0-9-]+)/g)].map((m) => m[1]))];
    const words = q.toLowerCase().split(' ');
    const hit = slugs.find((x) => words.every((w) => x.includes(w)));
    if (!hit) throw new Error(`${e.message}; no match for "${q}"`);
    say(`${pack.slug}: using ${hit}`);
    html = await get(`https://kenney.nl/assets/${hit}`);
  }
  const m = html.match(/href="([^"]+\.zip[^"]*)"/i) || html.match(/(https?:\/\/[^"'\s]+\.zip)/i);
  if (!m) throw new Error('no zip link on page');
  const zip = path.join(tmp, `${pack.slug}.zip`), dir = path.join(tmp, pack.slug);
  fs.writeFileSync(zip, await get(new URL(m[1].replace(/&amp;/g, '&'), 'https://kenney.nl').href, true));
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  return dir;
}

function pick(pack, dir) {
  let files = walk(dir).map((f) => ({ f, rel: path.relative(dir, f) })).filter(({ rel }) => !/vector|spritesheet|sheet|preview|sample|tilemap|@2x|retina|double/i.test(rel));
  if (pack.only) { const re = new RegExp(pack.only, 'i'), o = files.filter(({ rel }) => re.test(rel)); if (o.length) files = o; }
  if (pack.skip) { const re = new RegExp(pack.skip, 'i'); files = files.filter(({ rel }) => !re.test(rel)); }
  // one view of each model in 3D kits (renders come in four directions)
  if (pack.prefer) {
    const re = new RegExp(pack.prefer, 'i'), seen = new Set();
    files = files.filter(({ rel }) => re.test(rel)).filter(({ rel }) => { const base = path.basename(rel).replace(/_(NE|NW|SE|SW)\b.*$/i, ''); if (seen.has(base)) return false; seen.add(base); return true; });
  }
  const out = [];
  for (const { f, rel } of files) {
    const name = path.basename(rel, '.png');
    // judge by the file name and its folder only (zips often sit in a folder named after the pack)
    const near = `${path.basename(path.dirname(rel))} ${name}`;
    if (NOT.test(near.replace(/[\s_.-]+/g, ''))) continue;
    if (pack.mode === 'named' && !NAMED.test(name.replace(/([a-z])([A-Z])/g, '$1 $2'))) continue;
    if (fs.statSync(f).size > 600000) continue;
    let img;
    try { img = trim(load(fs.readFileSync(f))); } catch { continue; }
    if (!img || img.w < 6 || img.h < 6) continue;
    const L = looks(img);
    const named = pack.mode === 'named';
    if (L.fill < 0.12 || L.fill > (named ? 0.97 : 0.9)) continue;
    if (L.bottom > 0.85 && img.w >= 14) continue;   // a strip of ground
    if (L.grey > 0.6) continue;                     // rocks, metal, shadows
    if (!named && L.green + L.bloom * 0.6 < 0.4) continue;
    if (named && !/mushroom|shroom|toadstool|cactus|stump|crop|wheat|corn|carrot|pumpkin|potato/i.test(name) && L.green + L.bloom + L.brown < 0.35) continue;
    const kind = kindOf(name.replace(/([a-z])([A-Z])/g, '$1 $2'), img, L);
    out.push({ rel, name, kind, img: shrink(img, kind), L });
  }
  // spread the pack's budget across kinds
  const byKind = {};
  for (const x of out) (byKind[x.kind] ||= []).push(x);
  const kinds = Object.keys(byKind), per = Math.max(3, Math.ceil((pack.max || 20) / Math.max(1, kinds.length)));
  return kinds.flatMap((k) => byKind[k].sort((a, b) => a.rel.localeCompare(b.rel)).filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / per)) === 0).slice(0, per)).slice(0, pack.max || 20);
}

// ------------------------------------------------ run
const args = process.argv.slice(2), local = args[0] === '--local' ? args[1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plants-'));
const items = [];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const sources = local ? [{ slug: path.basename(local), mode: 'scan', max: 60, dir: local }] : cfg.packs;
for (const pack of sources) {
  try {
    const dir = pack.dir || (await download(pack, tmp));
    const got = pick(pack, dir);
    for (const x of got) {
      if (items.length >= cfg.maxSprites) break;
      const id = `${pack.slug}-${x.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (items.some((i) => i.id === id)) continue;
      fs.writeFileSync(path.join(OUT, `${id}.png`), encodePNG(x.img.w, x.img.h, new Uint8Array(x.img.d.buffer)));
      items.push({ id, f: `${id}.png`, w: x.img.w, h: x.img.h, kind: x.kind, pack: pack.slug });
    }
    say(`${pack.slug}: kept ${got.length} (${Object.entries(got.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {})).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'})`);
  } catch (e) {
    say(`WARN ${pack.slug}: ${e.message}`);
  }
}
const bytes = items.reduce((s, i) => s + fs.statSync(path.join(OUT, i.f)).size, 0);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ license: 'CC0 1.0, Kenney (www.kenney.nl)', made: new Date().toISOString().slice(0, 10), items }));
say(`total ${items.length} sprites, ${(bytes / 1024).toFixed(0)} KB`, JSON.stringify(items.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {})));
fs.writeFileSync(path.join(OUT, 'fetch-log.txt'), log.join('\n') + '\n');
