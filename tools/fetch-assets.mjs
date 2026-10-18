#!/usr/bin/env node
// Downloads Kenney asset packs (CC0) and copies a curated, size-capped set of
// PNG sprites into www/assets/kenney/, with an index of roles for the games.
//
//   node tools/fetch-assets.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/assets.json'), 'utf8'));
const OUT = path.join(ROOT, 'www/assets/kenney');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kenney-'));
const logLines = [];
const say = (...m) => { const l = m.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); logLines.push(l); console.log(l); };

const ROLES = [
  ['bg', /background|backdrop|(^|[_/-])bg[_-]|sky|clouds?\d|hills?\d|mountain/i],
  ['car', /\bcar|car_|vehicle|truck|motorcycle|police|ambulance|taxi|buggy|kart/i],
  ['ship', /ship|ufo|spaceship|playership|enemy(Black|Blue|Green|Red)/i],
  ['meteor', /meteor|asteroid/i],
  ['block', /element(Wood|Stone|Metal|Glass|Explosive)|crate|box(?!.*ball)/i],
  ['ball', /ball/i],
  ['enemy', /enemy|monster|slime|fly|bee|snail|worm|fish|ghost|bat|spider|mouse|frog|ladybug|zombie|skeleton/i],
  ['char', /player|character|alien|hero|adventurer|robot|female|male|soldier|person|wizard|knight/i],
  ['item', /coin|gem|star|key|heart|jewel|fruit|mushroom|flag|item|powerup|pill|bolt|shield|potion|chest|diamond/i],
  ['road', /road|track|tribune|cone|barrier|tree|bush|tent|arrow|sign/i],
  ['tile', /tile|ground|grass|dirt|stone|sand|snow|planet|castle|brick|block|metal|wood|ice|cake|choco|wall|floor|bridge/i],
  ['fx', /particle|spark|flame|fire|smoke|light|magic|circle|trace|scorch|twirl|flare/i]
];

function pngSize(file) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
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

const index = { license: 'CC0 1.0, Kenney (www.kenney.nl)', packs: {}, roles: {} };
let total = 0;
const cap = cfg.maxTotalMB * 1024 * 1024;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const pack of cfg.packs) {
  if (!pack.max) continue;
  try {
    const html = await get(`https://kenney.nl/assets/${pack.slug}`);
    const m = html.match(/href="([^"]+\.zip[^"]*)"/i) || html.match(/(https?:\/\/[^"'\s]+\.zip)/i);
    if (!m) throw new Error('no zip link on page');
    const zipUrl = new URL(m[1].replace(/&amp;/g, '&'), 'https://kenney.nl').href;
    const zip = path.join(tmp, `${pack.slug}.zip`);
    fs.writeFileSync(zip, await get(zipUrl, true));
    const dir = path.join(tmp, pack.slug);
    execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
    let files = walk(dir).filter((f) => !/vector|spritesheet|sheet|double|@2x|retina|preview|sample|tilemap|\bsvg\b/i.test(path.relative(dir, f)));
    const byRole = {};
    for (const f of files) {
      const rel = path.relative(dir, f);
      const sz = pngSize(f);
      const bytes = fs.statSync(f).size;
      if (!sz) continue;
      let role = pack.slug === 'animal-pack-redux' ? 'animal' : (ROLES.find(([, re]) => re.test(rel)) || ['deco'])[0];
      const isBg = role === 'bg';
      if (sz.w < 12 || sz.h < 12 || sz.w > (isBg ? 1400 : 300) || sz.h > (isBg ? 1400 : 300) || bytes > (isBg ? 450000 : 90000)) continue;
      (byRole[role] ||= []).push({ f, rel, ...sz, bytes });
    }
    // spread the per-pack budget across roles
    const roles = Object.keys(byRole);
    const per = Math.max(4, Math.floor(pack.max / Math.max(1, roles.length)));
    const kept = [];
    for (const r of roles) {
      const list = byRole[r].sort(() => Math.random() - 0.5).slice(0, r === 'bg' ? 8 : per);
      for (const x of list) {
        if (total + x.bytes > cap) break;
        const name = `${pack.slug}/${x.rel.replace(/[^\w.-]+/g, '_')}`;
        fs.mkdirSync(path.join(OUT, pack.slug), { recursive: true });
        fs.copyFileSync(x.f, path.join(OUT, name));
        total += x.bytes;
        kept.push({ f: name, w: x.w, h: x.h, role: r });
        (index.roles[r] ||= []).push(name);
      }
    }
    index.packs[pack.slug] = kept.length;
    say(`${pack.slug}: kept ${kept.length} of ${files.length} (${roles.join(', ')})`);
  } catch (e) {
    say(`WARN ${pack.slug}: ${e.message}`);
  }
}
index.dims = {};
for (const r of Object.values(index.roles)) for (const f of r) { const s = pngSize(path.join(OUT, f)); index.dims[f] = [s.w, s.h]; }
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
say(`total ${(total / 1048576).toFixed(1)} MB`, Object.fromEntries(Object.entries(index.roles).map(([k, v]) => [k, v.length])));
fs.writeFileSync(path.join(OUT, 'fetch-log.txt'), logLines.join('\n') + '\n');
