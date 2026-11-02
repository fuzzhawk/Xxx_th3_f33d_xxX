#!/usr/bin/env node
// Builds www/data/rhymes.txt, the offline rhyming dictionary, from the CMU Pronouncing Dictionary (npm package
// cmu-pronouncing-dictionary, ISC; the dictionary itself is Carnegie Mellon University's, see www/data/rhymes-LICENSE.txt).
// Only common words are kept: those in the SCOWL list the word games use (www/data/words.txt, levels 10–50) that have a
// pronunciation. One line per word: <level 1–5><word> <pronunciation> [<variant>…], sounds one letter each (see rhymes.js).
//   node tools/build-rhymes.mjs [path/to/cmu-pronouncing-dictionary/index.js]
// Without a path it uses the installed package, or fetches it with `npm pack` into a temporary folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePron, analyse } from '../www/js/rhymes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'www/data/rhymes.txt');
const SLURS = /^(nigg|fagg?ot|fags?$|spic|kike|chink|gook|wetback|tranny|retard|coon$|coons$|darkie|paki$|raghead|towelhead|beaner|cracker$|whore|slut|cunt)/;

async function loadDictionary() {
  let file = process.argv[2] && path.resolve(process.argv[2]);
  if (!file) {
    try { return (await import('cmu-pronouncing-dictionary')).dictionary; } catch { /* not installed */ }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmu-'));
    execFileSync('npm', ['pack', 'cmu-pronouncing-dictionary@3.0.0', '--silent'], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'] });
    execFileSync('tar', ['xzf', fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'))], { cwd: tmp });
    file = path.join(tmp, 'package/index.js');
  }
  return (await import(pathToFileURL(file).href)).dictionary;
}

const LEVEL = { 10: 1, 20: 2, 35: 3, 40: 4, 50: 5 };
const level = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'www/data/words.txt'), 'utf8').split('\n')) {
  const [lv, ...ws] = line.trim().split(' ');
  for (const w of ws) if (LEVEL[lv] && (!level.has(w) || LEVEL[lv] < level.get(w))) level.set(w, LEVEL[lv]);
}

const dictionary = await loadDictionary();
const prons = new Map(); // word -> encoded pronunciations (CMU lists variants as word, word(2), word(3)…)
for (const [k, v] of Object.entries(dictionary)) {
  const w = k.replace(/\(\d+\)$/, '');
  if (!/^[a-z]+$/.test(w) || !level.has(w) || SLURS.test(w)) continue;
  const e = encodePron(v.split('#')[0].trim()); // some entries end in a comment
  if (!analyse(e)) continue;
  const l = prons.get(w) || [];
  if (!l.includes(e)) l.push(e);
  prons.set(w, l);
}
const lines = [...prons].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([w, l]) => `${level.get(w)}${w} ${l.slice(0, 3).join(' ')}`);
fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`${lines.length} words, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> ${path.relative(ROOT, OUT)}`);
