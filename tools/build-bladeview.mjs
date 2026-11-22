// Builds Bladeview as one self-contained HTML page (standalone/bladeview/index.html) to host on its
// own, for example by dropping the standalone/bladeview folder onto Netlify. Everything is inlined:
// the scene and three.js as one module script, and Vitriol's generators (Greebleworks for the
// facades and skies, Mercforge for the people, Crawlerforge for the abominations) as one classic
// script, so nothing is fetched. Needs esbuild, which the app itself does not:
//   npm i --no-save esbuild@0.24.2 && node tools/build-bladeview.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'standalone/bladeview/index.html');
const GEN = ['greebleworks', 'mercforge', 'crawlerforge'].map((n) => join(ROOT, `www/ext/vitriol/src/gen/${n}.js`));

let esbuild;
try { esbuild = await import('esbuild'); } catch {
  console.error('esbuild is missing: npm i --no-save esbuild@0.24.2');
  process.exit(1);
}

// the card renders at a fixed 192×224 in a 360×420 frame; here the render takes the window's shape,
// set by a small script in the page before the module runs (BV_RW, BV_RH, BV_FOV)
const screenSize = {
  name: 'screen-size',
  setup(b) {
    b.onLoad({ filter: /bladeview\.js$/ }, async (a) => {
      const src = await readFile(a.path, 'utf8'), from = 'const W = 360, H = 420, RW = 192, RH = 224, FOV = 58;';
      if (!src.includes(from)) throw new Error(`bladeview.js no longer has "${from}"; update tools/build-bladeview.mjs`);
      const to = 'const RW = globalThis.BV_RW || 192, RH = globalThis.BV_RH || 224, H = 420, W = Math.round((H * RW) / RH), FOV = globalThis.BV_FOV || 58;';
      return { contents: src.replace(from, to), loader: 'js' };
    });
  }
};

const common = { minify: true, target: 'es2022', legalComments: 'none', logLevel: 'warning', charset: 'utf8' };
const main = await esbuild.build({ ...common, bundle: true, write: false, entryPoints: [join(ROOT, 'tools/bladeview/main.js')], format: 'esm', plugins: [screenSize] });
const gens = await Promise.all(GEN.map(async (f) => (await esbuild.transform(await readFile(f, 'utf8'), { ...common, loader: 'js' })).code));

// nothing in an inline script may close its tag early
const inline = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const mainJs = inline(main.outputFiles[0].text), genJs = inline(gens.join(';\n'));
if (/\bimport\(/.test(mainJs.replace(/import\.meta/g, ''))) console.warn('warning: the bundle still has a dynamic import; check that three.js was inlined');

const page = await readFile(join(ROOT, 'tools/bladeview/page.html'), 'utf8');
for (const mark of ['/*BV_MAIN*/', '/*BV_GEN*/']) if (page.split(mark).length !== 2) throw new Error(`page.html needs exactly one ${mark}`);
const html = page.replace('/*BV_GEN*/', () => genJs).replace('/*BV_MAIN*/', () => mainJs);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html);
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`${OUT.slice(ROOT.length + 1)}: ${kb(Buffer.byteLength(html))} (scene and three.js ${kb(mainJs.length)}, generators ${kb(genJs.length)})`);
