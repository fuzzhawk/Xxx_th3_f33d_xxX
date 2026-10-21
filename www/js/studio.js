// Studio posts: writing pages (an esoteric prompt, or a blank page) that save as
// you type and download as .txt from the send button, and the character creator,
// whose saved character becomes the hero in the games.
import { el, toast } from './util.js';
import { marrowAnims } from './marrow/sprites.js';
import { OUTFITS, HAIR_STYLES, HAIR_COLORS } from './marrow/engine.js';
import { SKINS, PRESET_NAMES } from './marrow/params.js';
import { getHero, setHero } from './hero.js';

const draftKey = (id) => `feed-write-${id}`;
const load = (id) => { try { return localStorage.getItem(draftKey(id)) || ''; } catch { return ''; } };
const store = (id, v) => { try { localStorage.setItem(draftKey(id), v); } catch { /* private mode */ } };
export function download(name, text) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

// ------------------------------------------------ writing
export function writingBody(p) {
  const ta = el('textarea.write-area', { placeholder: p.prompt ? 'Begin here…' : 'A blank page. Write anything.', rows: p.prompt ? 7 : 11, spellcheck: true });
  ta.value = load(p.id);
  const count = el('span.muted.write-count');
  const upd = () => { const n = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0; count.textContent = `${n} word${n === 1 ? '' : 's'} · saved on this device · tap ✈ to download`; };
  ta.addEventListener('input', () => { store(p.id, ta.value); upd(); });
  for (const ev of ['pointerdown', 'click', 'touchstart']) ta.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  upd();
  const body = el('div.write', p.prompt ? el('div.write-prompt', p.prompt) : el('div.write-prompt.blank', p.title || 'Blank page'), ta, count);
  const send = () => {
    const text = ta.value.trim();
    if (!text) { toast('Nothing written yet'); return; }
    const head = p.prompt ? `${p.prompt}\n\n` : '';
    download(`${(p.prompt || p.title || 'page').replace(/[^\w]+/g, '-').slice(0, 40).replace(/^-|-$/g, '') || 'page'}.txt`, `${head}${text}\n`);
  };
  return { body, send };
}

// ------------------------------------------------ character creator (MARROW bodies)
const TOPS = ['#5d6f4a', '#9b3d2a', '#2d4fbf', '#d8d4cc', '#202228', '#c86a1e', '#3b3f8f', '#7a1f2b', '#2f7d55', '#d9a441', '#e05a9c', '#6b4a2e'];
const PANTS = ['#4a4036', '#36507a', '#202228', '#3e4a5c', '#6b4a2e', '#7a1f2b', '#2f4a2f', '#c9c2b0'];
const PARTS = [
  ['preset', 'Body', ['Average adult', ...PRESET_NAMES.filter((n) => n !== 'Average adult')]], ['outfit', 'Outfit', Object.keys(OUTFITS)], ['hairStyle', 'Hair', HAIR_STYLES.map((h) => h[0])],
  ['hairColor', 'Hair colour', HAIR_COLORS], ['skin', 'Skin', SKINS], ['topColor', 'Top colour', TOPS], ['pantsColor', 'Bottoms', PANTS],
  ['capeOn', 'Cape', [false, true]], ['beard', 'Beard', ['none', 'stubble', 'short', 'long']]
];
const isColour = (v) => typeof v === 'string' && v[0] === '#';
const label = (k, v) => (k === 'hairStyle' ? (HAIR_STYLES.find((h) => h[0] === v)?.[1] || v) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : isColour(v) ? '●' : String(v));
const randomLook = () => Object.fromEntries(PARTS.map(([k, , vals]) => { const v = vals.filter((x) => x !== 'Nothing'); return [k, v[Math.floor(Math.random() * v.length)]]; }));
const ANIMS = { walk: 8, punch: 6, kick: 6, dance: 8, spinkick: 8 };

export function creatorMedia() {
  const saved = getHero();
  let look = saved?.marrow || randomLook(), seed = saved?.seed || Math.floor(Math.random() * 1e9), anims = null, tick = 0;
  const cv = el('canvas.creator-cv'); cv.width = 240; cv.height = 240;
  const name = el('input.creator-name', { value: saved?.name || 'Nameless One', maxlength: 24, placeholder: 'Name' });
  for (const ev of ['pointerdown', 'click']) name.addEventListener(ev, (e) => e.stopPropagation());
  const rows = el('div.creator-rows');
  const status = el('div.muted.creator-status', saved ? `${saved.name} is your hero in the games.` : 'Make someone, then save them to star in the games.');
  const busy = el('div.muted.creator-busy', '');
  // the outfit sets its own colours; picking an outfit resets them to the outfit's
  const step = (k, dir) => {
    const vals = PARTS.find((p) => p[0] === k)[2], i = Math.max(0, vals.indexOf(look[k]));
    look[k] = vals[(i + dir + vals.length) % vals.length];
    if (k === 'outfit') { delete look.topColor; delete look.pantsColor; delete look.capeOn; }
    render();
  };
  let timer = 0;
  const render = () => {
    rows.replaceChildren(...PARTS.map(([k, lab]) => el('div.creator-row', el('span', lab),
      el('button.btn.sm', { onclick: (e) => { e.stopPropagation(); step(k, -1); } }, '‹'),
      el('b', { style: { color: isColour(look[k]) ? look[k] : '' } }, look[k] === undefined ? 'outfit' : label(k, look[k])),
      el('button.btn.sm', { onclick: (e) => { e.stopPropagation(); step(k, 1); } }, '›'))));
    clearTimeout(timer);
    timer = setTimeout(() => {
      busy.textContent = 'simulating muscles, cloth and hair…';
      const next = marrowAnims(seed, ANIMS, { size: 96, look, face: true, grit: 0 });
      next.ready.then(() => { anims = next; busy.textContent = ''; });
    }, 250);
  };
  render();
  let raf = 0, t0 = performance.now();
  const seq = ['walk', 'walk', 'punch', 'kick', 'spinkick', 'dance'];
  const draw = (now) => {
    const x = cv.getContext('2d'), t = (now - t0) / 1000;
    x.clearRect(0, 0, 240, 240);
    const g = x.createRadialGradient(120, 130, 10, 120, 130, 130); g.addColorStop(0, '#3a2a20'); g.addColorStop(1, '#120d0a'); x.fillStyle = g; x.fillRect(0, 0, 240, 240);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(120, 222, 50, 8, 0, 0, 7); x.fill();
    if (anims) {
      const clip = seq[Math.floor(t / 1.6) % seq.length], fr = anims[clip], k = Math.floor((t % 1.6) / 1.6 * fr.length);
      x.imageSmoothingEnabled = false; x.drawImage(fr[Math.min(fr.length - 1, k)], 0, -8, 240, 240);
    } else { x.fillStyle = '#c9b8a0'; x.font = '600 13px ui-monospace, monospace'; x.textAlign = 'center'; x.fillText('…', 120, 120); }
    raf = requestAnimationFrame(draw);
  };
  const buttons = el('div.btnrow',
    el('button.btn', { onclick: (e) => { e.stopPropagation(); look = randomLook(); seed = Math.floor(Math.random() * 1e9); render(); } }, 'Randomize'),
    el('button.btn.primary', { onclick: (e) => { e.stopPropagation(); const n = name.value.trim() || 'Nameless One'; setHero({ name: n, seed, marrow: { ...look } }); status.textContent = `Saved. ${n} will star in the platformer, mystery, survivors, robotron, downhill, brawler and RPGs.`; toast('Hero saved'); } }, 'Save hero'),
    el('button.btn', { onclick: (e) => { e.stopPropagation(); setHero(null); status.textContent = 'Removed. Games use their own heroes again.'; } }, 'Remove'));
  const media = el('div.media.creator', cv);
  const body = el('div.creator-body', name, rows, busy, buttons, status);
  return { media, body, activate: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }, deactivate: () => cancelAnimationFrame(raf) };
}
