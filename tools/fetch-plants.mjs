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
import { createHash } from 'node:crypto';
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
// things that turn up next to plants in game packs and are not plants
const JUNK = /key|jewel|gem|crystal|flag|coin|star|heart|arrow|sword|blade|skull|monster|hydra|figure|combat|paperdoll|hand|arms?(?![a-z])|legs?(?![a-z])|feet|torso|head|magic|summon|sumon|transmut|transform|poison|mapping|fire|flame|torch|shell|chest|ladder|lock|switch|spike|lava|bomb|weapon|bullet|potion|bridge|chain|rope|stem(?:corner|cross|left|right)|trunk|branchend|cornerleft|cornerright/i;
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
    else if ((H >= 195 || H <= 20 || (H >= 40 && H <= 62)) && S > 0.3 && V > 0.45) bloom++;   // petals: red, pink, violet, blue, yellow
    else if (H > 15 && H < 45 && V < 0.7) brown++;
  }
  // how much of the top, left and right sides is solid (plants have ragged outlines; tile pieces don't)
  const solid = (x, y) => d[(y * w + x) * 4 + 3] >= 128;
  let top = 0, left = 0, right = 0;
  for (let x = 0; x < w; x++) if (solid(x, 0)) top++;
  for (let y = 0; y < h; y++) { if (solid(0, y)) left++; if (solid(w - 1, y)) right++; }
  const cut = Math.max(w >= 6 ? top / w : 0, h >= 6 ? left / h : 0, h >= 6 ? right / h : 0);
  return { fill: n / (w * h), green: n ? green / n : 0, bloom: n ? bloom / n : 0, brown: n ? brown / n : 0, grey: n ? grey / n : 0, bottom: bottom / w, cut };
}
function kindOf(name, img, L) {
  for (const [k, re] of KIND) if (re.test(name)) return k;
  const tall = img.h / img.w;
  if (L.bloom > 0.12 && L.green < 0.8) return 'flower';
  if (tall > 1.3 && img.h >= 24) return 'tree';
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

// split an image into its separate shapes (pixels within 2 px of each other belong together)
function pieces(img) {
  const { w, h, d } = img, lab = new Int32Array(w * h).fill(-1), out = [];
  const solid = (x, y) => d[(y * w + x) * 4 + 3] > 24;
  for (let y0 = 0; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) {
    if (lab[y0 * w + x0] >= 0 || !solid(x0, y0)) continue;
    const id = out.length, q = [y0 * w + x0]; lab[q[0]] = id;
    let x1 = x0, y1 = y0, x2 = x0, y2 = y0;
    for (let qi = 0; qi < q.length && q.length < 200000; qi++) {
      const x = q[qi] % w, y = (q[qi] / w) | 0;
      if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (lab[j] < 0 && solid(nx, ny)) { lab[j] = id; q.push(j); }
      }
    }
    out.push([x1, y1, x2, y2, id]);
    if (out.length > 400) break;
  }
  return out.filter(([x1, y1, x2, y2]) => x2 - x1 >= 5 && y2 - y1 >= 5 && x2 - x1 < 200 && y2 - y1 < 220).slice(0, 60).map(([x1, y1, x2, y2, id]) => {
    const W = x2 - x1 + 1, H = y2 - y1 + 1, o = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y + y1) * w + x + x1; if (lab[j] === id) o.set(d.subarray(j * 4, j * 4 + 4), (y * W + x) * 4); }
    return { w: W, h: H, d: o };
  });
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
// the download link, wherever the page keeps it: a plain href, an escaped URL inside a script or
// JSON blob, or a /download route; failing that, log what the page does have so it can be fixed
async function zipUrl(html, pack) {
  const flat = html.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const found = [...flat.matchAll(/(?:href|data-href|data-url|content)=["']([^"']+\.zip[^"']*)["']/gi)].map((m) => m[1])
    .concat([...flat.matchAll(/((?:https?:)?\/\/[^"'\s()<>]+?\.zip(?:\?[^"'\s()<>]*)?)/gi)].map((m) => m[1]))
    .concat([...flat.matchAll(/["'](\/(?:media|content|files|download)[^"'\s]+?\.zip[^"'\s]*)["']/gi)].map((m) => m[1]));
  if (found.length) return new URL(found[0].startsWith('//') ? `https:${found[0]}` : found[0], 'https://kenney.nl').href;
  for (const tail of ['download', 'download/zip']) {
    try {
      const r = await fetch(`https://kenney.nl/assets/${pack.slug}/${tail}`, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      const type = r.headers.get('content-type') || '';
      if (r.ok && /zip|octet-stream/.test(type)) return r.url;
    } catch { /* next */ }
  }
  const title = (flat.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?';
  const links = [...new Set([...flat.matchAll(/(?:href|src|data-[a-z-]+)=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /download|zip|media|asset|file|itch/i.test(u)))].slice(0, 25);
  say(`  page "${title.trim()}" ${flat.length} chars; candidate links: ${links.join(' | ') || 'none'}`);
  say(`  page text: ${flat.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  throw new Error('no zip link on page');
}
// OpenGameArt: search, keep CC0 entries only, fetch their zips and PNGs into one folder
async function fromOGA(pack, tmp) {
  const q = pack.oga || `kenney ${pack.search || pack.slug.replace(/-/g, ' ')}`;
  const res = await get(`https://opengameart.org/art-search-advanced?keys=${encodeURIComponent(q)}&field_art_type_tid%5B%5D=9&sort_by=count&sort_order=DESC`).catch(() => get(`https://opengameart.org/art-search?keys=${encodeURIComponent(q)}`));
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !['kenney', 'pack', 'redux', 'art', 'the', 'and'].includes(w));
  const pages = [...new Set([...res.matchAll(/href="\/content\/([a-z0-9-]+)"/g)].map((m) => m[1]))].filter((x) => !/^(faq|art-search)/.test(x) && words.every((w) => x.includes(w))).slice(0, pack.ogaPages || 4);
  const dir = path.join(tmp, `oga-${pack.slug}`);
  fs.mkdirSync(dir, { recursive: true });
  let files = 0, bytes = 0;
  for (const slug of pages) {
    const html = await get(`https://opengameart.org/content/${slug}`).catch(() => '');
    if (!/publicdomain\/zero|>\s*CC0\s*</i.test(html)) { say(`  oga ${slug}: not CC0, skipped`); continue; }
    const links = [...new Set([...html.matchAll(/href="(https?:\/\/opengameart\.org\/sites\/default\/files\/[^"]+\.(?:zip|png))"/gi)].map((m) => m[1]))].slice(0, 6);
    for (const url of links) {
      if (bytes > 40e6) break;
      try {
        const data = await get(url, true); bytes += data.length;
        const base = `${slug}-${path.basename(new URL(url).pathname)}`.replace(/[^\w.-]+/g, '_');
        if (/\.zip$/i.test(url)) { const z = path.join(tmp, base); fs.writeFileSync(z, data); execFileSync('unzip', ['-q', '-o', z, '-d', path.join(dir, slug)]); }
        else fs.writeFileSync(path.join(dir, base), data);
        files++;
      } catch (e) { say(`  oga ${slug}: ${e.message}`); }
    }
    say(`  oga ${slug}: CC0, ${links.length} files`);
  }
  if (!files) throw new Error(`nothing CC0 on OpenGameArt for "${q}"`);
  pack._src = `opengameart.org (CC0): ${pages.join(', ')}`;
  return dir;
}
async function download(pack, tmp) {
  if (pack.from === 'oga') return fromOGA(pack, tmp);
  try { return await fromKenney(pack, tmp); }
  catch (e) { say(`${pack.slug}: kenney.nl failed (${e.message}); trying OpenGameArt`); return fromOGA(pack, tmp); }
}
async function fromKenney(pack, tmp) {
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
  const url = await zipUrl(html, pack);
  const zip = path.join(tmp, `${pack.slug}.zip`), dir = path.join(tmp, pack.slug);
  const data = await get(url, true);
  if (data.readUInt32LE(0) !== 0x04034b50) throw new Error(`not a zip at ${url} (${data.length} bytes)`);
  fs.writeFileSync(zip, data);
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  pack._src = `kenney.nl/assets/${pack.slug} (CC0)`;
  return dir;
}

function pick(pack, dir) {
  let files = walk(dir).map((f) => ({ f, rel: path.relative(dir, f) })).filter(({ rel }) => !/vector|preview|sample|tilemap|@2x|retina|double|\.svg/i.test(rel));
  const singles = files.filter(({ rel }) => !/sheet|atlas|tileset/i.test(path.basename(rel))).length;
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
    if (NOT.test(near.replace(/[\s_.-]+/g, '')) || JUNK.test(name)) continue;
    // a pack's combined sheet repeats its single sprites: use the singles when there are enough
    if (/sheet|atlas|tileset/i.test(name) && singles >= 12) continue;
    if (pack.mode === 'named' && !NAMED.test(name.replace(/([a-z])([A-Z])/g, '$1 $2'))) continue;
    if (fs.statSync(f).size > 600000) continue;
    let full;
    try { full = load(fs.readFileSync(f)); } catch { continue; }
    // a sheet of many plants on a clear background becomes one candidate per plant
    const parts = full.w > 72 && full.h > 72 && pack.split !== false ? pieces(full) : [full];
    parts.forEach((part, k) => {
      const img = trim(part);
      if (!img || img.w < 6 || img.h < 6) return;
      const L = looks(img);
      const named = pack.mode === 'named';
      if (L.fill < 0.12 || L.fill > (named ? 0.97 : 0.9)) return;
      if (L.bottom > 0.85 && img.w >= 14) return;   // a strip of ground
      if (L.grey > 0.6) return;                     // rocks, metal, shadows
      const asp = img.w / img.h;
      if (asp > 2.6 || (asp < 0.3 && !/tree|pine|cactus|reed/i.test(name))) return;   // slivers: trunks, poles, edges
      if (L.cut > 0.62 && !/cactus/i.test(name)) return;   // cut straight along a side: part of a tile
      if (!named && (L.green < 0.25 || L.green + L.bloom * 0.6 < 0.4)) return;   // even a flower has a green stem
      if (named && !/mushroom|shroom|toadstool|cactus|stump|crop|wheat|corn|carrot|pumpkin|potato/i.test(name) && L.green + L.bloom + L.brown < 0.35) return;
      const kind = kindOf(name.replace(/([a-z])([A-Z])/g, '$1 $2'), img, L);
      out.push({ rel: parts.length > 1 ? `${rel}#${k}` : rel, name: parts.length > 1 ? `${name}-${k}` : name, kind, img: shrink(img, kind), L });
    });
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
const items = [], seenPix = new Set();
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
      // the same picture reached through two packs (they share pages on OpenGameArt) is kept once
      const hash = createHash('sha1').update(x.img.d).digest('hex');
      if (seenPix.has(hash)) continue;
      seenPix.add(hash);
      fs.writeFileSync(path.join(OUT, `${id}.png`), encodePNG(x.img.w, x.img.h, new Uint8Array(x.img.d.buffer)));
      items.push({ id, f: `${id}.png`, w: x.img.w, h: x.img.h, kind: x.kind, pack: pack.slug, src: pack._src || 'local' });
    }
    say(`${pack.slug}: kept ${got.length} (${Object.entries(got.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {})).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'})`);
  } catch (e) {
    say(`WARN ${pack.slug}: ${e.message}`);
  }
}
const bytes = items.reduce((s, i) => s + fs.statSync(path.join(OUT, i.f)).size, 0);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ license: 'CC0 1.0: Kenney (www.kenney.nl) and CC0 entries on OpenGameArt (see src)', made: new Date().toISOString().slice(0, 10), items }));
say(`total ${items.length} sprites, ${(bytes / 1024).toFixed(0)} KB`, JSON.stringify(items.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {})));
fs.writeFileSync(path.join(OUT, 'fetch-log.txt'), log.join('\n') + '\n');
