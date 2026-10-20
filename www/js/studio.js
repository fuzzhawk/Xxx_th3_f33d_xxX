// Studio posts: writing pages (an esoteric prompt, or a blank page) that save as
// you type and download as .txt from the send button, and the character creator,
// whose saved character becomes the hero in the games.
import { el, toast } from './util.js';
import { humanoid, LOOK } from './games/creature.js';
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

// ------------------------------------------------ character creator
const range = (n, f = (i) => i) => Array.from({ length: n }, (_, i) => f(i)), HUES = range(12, (i) => i * 30), YN = [false, true];
const PARTS = [
  ['skin', 'Skin', range(LOOK.skins)], ['hair', 'Hair', HUES], ['outfit', 'Outfit', range(LOOK.outfits.length)], ['shirt', 'Top colour', HUES], ['pants', 'Bottoms', HUES],
  ['hat', 'Hat', [-1, 0, 1, 2, 3]], ['cape', 'Cape', YN], ['capeHue', 'Cape colour', HUES], ['prop', 'Holding', [-1, 0, 1, 2]], ['beard', 'Beard', YN], ['build', 'Build', [0.8, 1, 1.2, 1.4]], ['tall', 'Height', YN]
];
const HAT = ['none', 'top hat', 'wizard', 'crown', 'beanie'], PROP = ['nothing', 'staff', 'wand', 'torch'];
function valueLabel(k, v) {
  if (k === 'outfit') return LOOK.outfits[v];
  if (k === 'hat') return HAT[v + 1];
  if (k === 'prop') return PROP[v + 1];
  if (k === 'cape' || k === 'beard') return v ? 'yes' : 'no';
  if (k === 'tall') return v ? 'tall' : 'short';
  if (k === 'build') return ['slight', 'medium', 'sturdy', 'broad'][Math.round((v - 0.8) / 0.2)] || 'medium';
  return '●';
}
const randomLook = (r = Math.random) => ({ skin: Math.floor(r() * LOOK.skins), hair: Math.floor(r() * 12) * 30, outfit: Math.floor(r() * LOOK.outfits.length), shirt: Math.floor(r() * 12) * 30, pants: Math.floor(r() * 12) * 30, hat: Math.floor(r() * 5) - 1, cape: r() < 0.3, capeHue: Math.floor(r() * 12) * 30, prop: Math.floor(r() * 4) - 1, beard: r() < 0.25, build: 0.8 + Math.floor(r() * 4) * 0.2, tall: r() < 0.4 });

export function creatorMedia() {
  const saved = getHero();
  let look = saved?.look || randomLook(), seed = saved?.seed || Math.floor(Math.random() * 1e9);
  const cv = el('canvas.creator-cv'); cv.width = 240; cv.height = 240;
  const name = el('input.creator-name', { value: saved?.name || 'Nameless One', maxlength: 24, placeholder: 'Name' });
  for (const ev of ['pointerdown', 'click']) name.addEventListener(ev, (e) => e.stopPropagation());
  const rows = el('div.creator-rows');
  const status = el('div.muted.creator-status', saved ? `${saved.name} is your hero in the games.` : 'Make someone, then save them to star in the games.');
  const step = (k, dir) => {
    const vals = PARTS.find((p) => p[0] === k)[2];
    let i = vals.findIndex((v) => (typeof v === 'number' ? Math.abs(v - look[k]) < 1e-6 : v === !!look[k]));
    if (i < 0) i = 0;
    look[k] = vals[(i + dir + vals.length) % vals.length];
    render();
  };
  const render = () => {
    rows.replaceChildren(...PARTS.map(([k, label]) => el('div.creator-row', el('span', label),
      el('button.btn.sm', { onclick: (e) => { e.stopPropagation(); step(k, -1); } }, '‹'),
      el('b', { style: { color: ['hair', 'shirt', 'pants', 'capeHue'].includes(k) ? `hsl(${look[k]},55%,55%)` : '' } }, valueLabel(k, look[k])),
      el('button.btn.sm', { onclick: (e) => { e.stopPropagation(); step(k, 1); } }, '›'))));
    sheet = humanoid(seed, look.shirt || 0, { look });
  };
  let sheet; render();
  let raf = 0, t0 = performance.now();
  const poses = ['idle', 'walk1', 'walk2', 'walk1', 'idle', 'punch', 'kick', 'jump', 'special', 'block'];
  const draw = (now) => {
    const x = cv.getContext('2d'), t = (now - t0) / 1000, pose = poses[Math.floor(t * 2.5) % poses.length];
    x.clearRect(0, 0, 240, 240);
    const g = x.createRadialGradient(120, 130, 10, 120, 130, 130); g.addColorStop(0, '#3a2a20'); g.addColorStop(1, '#120d0a'); x.fillStyle = g; x.fillRect(0, 0, 240, 240);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(120, 214, 50, 9, 0, 0, 7); x.fill();
    x.imageSmoothingEnabled = false; x.drawImage(sheet[pose], 48, 22, 144, 192);
    raf = requestAnimationFrame(draw);
  };
  const buttons = el('div.btnrow',
    el('button.btn', { onclick: (e) => { e.stopPropagation(); look = randomLook(); seed = Math.floor(Math.random() * 1e9); render(); } }, 'Randomize'),
    el('button.btn.primary', { onclick: (e) => { e.stopPropagation(); setHero({ name: name.value.trim() || 'Nameless One', seed, hue: look.shirt || 0, look: { ...look } }); status.textContent = `Saved. ${name.value.trim() || 'Nameless One'} will star in the platformer, mystery, survivors, robotron, downhill, brawler and RPGs.`; toast('Hero saved'); } }, 'Save hero'),
    el('button.btn', { onclick: (e) => { e.stopPropagation(); setHero(null); status.textContent = 'Removed. Games use their own heroes again.'; } }, 'Remove'));
  const media = el('div.media.creator', cv);
  const body = el('div.creator-body', name, rows, buttons, status);
  return { media, body, activate: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }, deactivate: () => cancelAnimationFrame(raf) };
}
