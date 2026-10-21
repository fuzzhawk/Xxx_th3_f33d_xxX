// Studio posts: writing pages (an esoteric prompt, or a blank page) that save as
// you type and download as .txt from the send button, and the character creator,
// whose saved character becomes the hero in the games.
import { el, toast } from './util.js';
import { marrowAnims } from './marrow/sprites.js';
import { OUTFITS, HAIR_STYLES, HAIR_COLORS } from './marrow/engine.js';
import { SKINS, PRESET_NAMES } from './marrow/params.js';
import { getHero, setHero } from './hero.js';
import { S as CS, crystalSheet, drawFrame } from './crystal/sprites.js';

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
// Two styles: Crystal (the FF-style sprites most games use) and MARROW (the
// simulated bodies of the brawler). Each keeps its own look; both are saved.
const TOPS = ['#5d6f4a', '#9b3d2a', '#2d4fbf', '#d8d4cc', '#202228', '#c86a1e', '#3b3f8f', '#7a1f2b', '#2f7d55', '#d9a441', '#e05a9c', '#6b4a2e'];
const PANTS = ['#4a4036', '#36507a', '#202228', '#3e4a5c', '#6b4a2e', '#7a1f2b', '#2f4a2f', '#c9c2b0'];
const PARTS = [
  ['preset', 'Body', ['Average adult', ...PRESET_NAMES.filter((n) => n !== 'Average adult')]], ['outfit', 'Outfit', Object.keys(OUTFITS)], ['hairStyle', 'Hair', HAIR_STYLES.map((h) => h[0])],
  ['hairColor', 'Hair colour', HAIR_COLORS], ['skin', 'Skin', SKINS], ['topColor', 'Top colour', TOPS], ['pantsColor', 'Bottoms', PANTS],
  ['capeOn', 'Cape', [false, true]], ['beard', 'Beard', ['none', 'stubble', 'short', 'long']]
];
const O = CS.options, CLOTH = Object.keys(CS.palettes.cloth);
const CPARTS = [
  ['job', 'Job', Object.keys(CS.jobs).filter((j) => j !== 'Mannequin')], ['skin', 'Skin', O.skin], ['hair', 'Hair', O.hair], ['hairColor', 'Hair colour', O.hairColor],
  ['head', 'Headwear', O.head], ['headColor', 'Hat colour', CLOTH], ['top', 'Top', O.top], ['topColor', 'Top colour', CLOTH], ['bot', 'Bottoms', O.bot], ['botColor', 'Bottoms colour', CLOTH],
  ['feet', 'Feet', O.feet], ['hands', 'Hands', O.hands], ['weapon', 'Weapon', O.weapon], ['weaponColor', 'Weapon colour', CLOTH], ['trimColor', 'Trim', CLOTH]
];
const swatch = (k, v) => (k === 'skin' ? CS.palettes.skin[v]?.[1] : /hairColor/.test(k) ? CS.palettes.hair[v]?.[2] : /Color$/.test(k) ? CS.palettes.cloth[v]?.[2] : '');
const isColour = (v) => typeof v === 'string' && v[0] === '#';
const label = (k, v) => (k === 'hairStyle' ? (HAIR_STYLES.find((h) => h[0] === v)?.[1] || v) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : isColour(v) ? '●' : String(v));
const randomLook = () => Object.fromEntries(PARTS.map(([k, , vals]) => { const v = vals.filter((x) => x !== 'Nothing'); return [k, v[Math.floor(Math.random() * v.length)]]; }));
const ANIMS = { walk: 8, punch: 6, kick: 6, dance: 8, spinkick: 8 };
// the Crystal preview runs through every animation, turning to show the directions
const CSEQ = [['idle', 'S', 1.2], ['walk', 'SW', 1.4], ['walk', 'W', 1.2], ['run', 'NW', 1], ['run', 'N', 1], ['jump', 'E', 0.6], ['land', 'E', 0.3], ['attack', 'SE', 0.5], ['shoot', 'S', 0.5], ['cast', 'SW', 1.1],
  ['flinch', 'S', 0.4], ['knockdown', 'E', 1.4], ['kneel', 'S', 1], ['wave', 'S', 1.2], ['cheer', 'SE', 1.2], ['laugh', 'S', 1], ['nod', 'SW', 0.9], ['shake', 'S', 0.9], ['surprise', 'S', 0.8],
  ['think', 'SW', 1.2], ['angry', 'S', 1], ['sad', 'S', 1.2], ['love', 'S', 1.2], ['idle', 'NE', 0.8]];
const CTOTAL = CSEQ.reduce((a, s) => a + s[2], 0);

export function creatorMedia() {
  const saved = getHero();
  let look = saved?.marrow || randomLook(), seed = saved?.seed || Math.floor(Math.random() * 1e9), anims = null;
  let char = saved?.crystal || CS.randomCharacter(seed, 'Fantasy'), sheet = null, style = 'crystal';
  const cv = el('canvas.creator-cv'); cv.width = 240; cv.height = 240;
  const name = el('input.creator-name', { value: saved?.name || 'Nameless One', maxlength: 24, placeholder: 'Name' });
  for (const ev of ['pointerdown', 'click']) name.addEventListener(ev, (e) => e.stopPropagation());
  const rows = el('div.creator-rows');
  const status = el('div.muted.creator-status', saved ? `${saved.name} is your hero in the games.` : 'Make someone, then save them to star in the games.');
  const busy = el('div.muted.creator-busy', '');
  const tabs = el('div.creator-tabs');
  // the outfit (MARROW) or job (Crystal) sets its own colours and parts
  const step = (k, dir) => {
    if (style === 'crystal') {
      const vals = CPARTS.find((p) => p[0] === k)[2], i = Math.max(0, vals.indexOf(char[k]));
      const v = vals[(i + dir + vals.length) % vals.length];
      char = k === 'job' ? { ...CS.setCharacter({ job: v }, seed), job: v } : { ...char, [k]: v };
    } else {
      const vals = PARTS.find((p) => p[0] === k)[2], i = Math.max(0, vals.indexOf(look[k]));
      look[k] = vals[(i + dir + vals.length) % vals.length];
      if (k === 'outfit') { delete look.topColor; delete look.pantsColor; delete look.capeOn; }
    }
    render();
  };
  let timer = 0;
  const render = () => {
    tabs.replaceChildren(...[['crystal', 'Crystal style'], ['marrow', 'MARROW style']].map(([k, t]) => el(`button.btn.sm${style === k ? '.primary' : ''}`, { onclick: (e) => { e.stopPropagation(); style = k; render(); } }, t)));
    const parts = style === 'crystal' ? CPARTS : PARTS, cur = style === 'crystal' ? char : look;
    rows.replaceChildren(...parts.map(([k, lab]) => {
      const sw = style === 'crystal' ? swatch(k, cur[k]) : isColour(cur[k]) ? cur[k] : '';
      return el('div.creator-row', el('span', lab),
        el('button.btn.sm', { onclick: (e) => { e.stopPropagation(); step(k, -1); } }, '‹'),
        el('b', { style: { color: sw || '' } }, cur[k] === undefined ? (style === 'crystal' ? 'job' : 'outfit') : style === 'crystal' ? (sw ? `● ${cur[k]}` : String(cur[k] || 'custom')) : label(k, cur[k])),
        el('button.btn.sm', { onclick: (e) => { e.stopPropagation(); step(k, 1); } }, '›'));
    }));
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (style === 'crystal') {
        const next = crystalSheet(seed, { char, cache: false });
        next.ready.then(() => { if (next.ok) sheet = next; });
        return;
      }
      busy.textContent = 'simulating muscles, cloth and hair…';
      const next = marrowAnims(seed, ANIMS, { size: 96, look, face: true, grit: 0 });
      next.ready.then(() => { anims = next; busy.textContent = ''; });
    }, 200);
  };
  render();
  let raf = 0, t0 = performance.now();
  const seq = ['walk', 'walk', 'punch', 'kick', 'spinkick', 'dance'];
  const draw = (now) => {
    const x = cv.getContext('2d'), t = (now - t0) / 1000;
    x.clearRect(0, 0, 240, 240);
    const g = x.createRadialGradient(120, 130, 10, 120, 130, 130); g.addColorStop(0, style === 'crystal' ? '#2a3550' : '#3a2a20'); g.addColorStop(1, style === 'crystal' ? '#0c1020' : '#120d0a'); x.fillStyle = g; x.fillRect(0, 0, 240, 240);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(120, 222, 50, 8, 0, 0, 7); x.fill();
    x.imageSmoothingEnabled = false;
    if (style === 'crystal' && sheet) {
      let u = t % CTOTAL, k = 0;
      while (u > CSEQ[k][2]) { u -= CSEQ[k][2]; k++; }
      const [anim, dir] = CSEQ[k], A = CS.animations[anim];
      const f = A.loop ? Math.floor(u * A.fps) % A.frames : Math.min(A.frames - 1, Math.floor(u * A.fps));
      drawFrame(x, sheet, anim, dir, f, 120, 226, 5.2);
      x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '600 11px ui-monospace, monospace'; x.textAlign = 'left'; x.fillText(`${anim} · ${dir}`, 8, 16);
    } else if (style === 'marrow' && anims) {
      const clip = seq[Math.floor(t / 1.6) % seq.length], fr = anims[clip], k = Math.floor((t % 1.6) / 1.6 * fr.length);
      x.drawImage(fr[Math.min(fr.length - 1, k)], 0, -8, 240, 240);
    } else { x.fillStyle = '#c9b8a0'; x.font = '600 13px ui-monospace, monospace'; x.textAlign = 'center'; x.fillText('…', 120, 120); }
    raf = requestAnimationFrame(draw);
  };
  const buttons = el('div.btnrow',
    el('button.btn', { onclick: (e) => { e.stopPropagation(); seed = Math.floor(Math.random() * 1e9); if (style === 'crystal') char = CS.randomCharacter(seed, ['Fantasy', 'Present day', 'Sci-fi'][seed % 3]); else look = randomLook(); render(); } }, 'Randomize'),
    el('button.btn.primary', { onclick: (e) => { e.stopPropagation(); const n = name.value.trim() || 'Nameless One'; setHero({ name: n, seed, marrow: { ...look }, crystal: { ...char } }); status.textContent = `Saved. ${n} stars in the platformer, mystery, survivors, robotron, downhill and RPGs in Crystal style, and in MARROW style wherever bodies are simulated.`; toast('Hero saved'); } }, 'Save hero'),
    el('button.btn', { onclick: (e) => { e.stopPropagation(); setHero(null); status.textContent = 'Removed. Games use their own heroes again.'; } }, 'Remove'));
  const media = el('div.media.creator', cv);
  const body = el('div.creator-body', tabs, name, rows, busy, buttons, status);
  return { media, body, activate: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }, deactivate: () => cancelAnimationFrame(raf) };
}
