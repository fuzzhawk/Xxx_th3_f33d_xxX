// Builds Hell Maze as one self-contained HTML page (standalone/hellmaze/index.html) to host on its own,
// for example by dropping the standalone/hellmaze folder onto Netlify. Everything is inlined: the
// game and three.js as one module script, the monster-drawing worker as a blob, and the wall photos
// as data URIs. Needs esbuild, which the app itself does not:
//   npm i --no-save esbuild@0.24.2 && node tools/build-hellmaze.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'standalone/hellmaze/index.html');

let esbuild;
try { esbuild = await import('esbuild'); } catch {
  console.error('esbuild is missing: npm i --no-save esbuild@0.24.2');
  process.exit(1);
}

// the engine's logical screen is a fixed 360×420 in the app; here it follows the window's shape,
// set by a small script in the page before the game's module runs
const screenSize = {
  name: 'screen-size',
  setup(b) {
    b.onLoad({ filter: /games[\\/]engine\.js$/ }, async (a) => {
      const src = await readFile(a.path, 'utf8'), from = 'export const W = 360, H = 420;';
      if (!src.includes(from)) throw new Error(`engine.js no longer has "${from}"; update tools/build-hellmaze.mjs`);
      return { contents: src.replace(from, 'export const W = globalThis.HM_W || 360, H = globalThis.HM_H || 420;'), loader: 'js' };
    });
  }
};

const common = { bundle: true, minify: true, write: false, target: 'es2022', legalComments: 'none', logLevel: 'warning', charset: 'utf8' };
const [main, worker] = await Promise.all([
  esbuild.build({ ...common, entryPoints: [join(ROOT, 'tools/hellmaze/main.js')], format: 'esm', plugins: [screenSize], loader: { '.json': 'json' } }),
  esbuild.build({ ...common, entryPoints: [join(ROOT, 'www/js/horror-worker.js')], format: 'iife' })
]);
// nothing in an inline script may close its tag early
const inline = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const mainJs = inline(main.outputFiles[0].text), workerJs = inline(worker.outputFiles[0].text);

const page = await readFile(join(ROOT, 'tools/hellmaze/page.html'), 'utf8');
for (const mark of ['/*HM_MAIN*/', '/*HM_WORKER*/']) if (page.split(mark).length !== 2) throw new Error(`page.html needs exactly one ${mark}`);
const html = page.replace('/*HM_WORKER*/', () => workerJs).replace('/*HM_MAIN*/', () => mainJs);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html);
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`${OUT.slice(ROOT.length + 1)}: ${kb(Buffer.byteLength(html))} (game ${kb(mainJs.length)}, worker ${kb(workerJs.length)})`);
