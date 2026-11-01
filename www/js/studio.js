// Studio posts: writing pages (an esoteric prompt, or a blank page) that save as
// you type and download as .txt from the send button, and the character creator,
// whose saved character becomes the hero in the games.
import { el, toast, mulberry32 } from './util.js';
import { marrowAnims } from './marrow/sprites.js';
import { getHero, setHero, makeHero } from './hero.js';
import { S as CS, crystalSheet, drawFrame } from './crystal/sprites.js';
import { FIELDS, ERAS, swatch, personaFor, normPersona, personaToCrystal, personaToMarrow, describePersona } from './persona.js';
import { rollCharacter, fromSheet, toSheet, sheet as dndSheet, adventurerPersona, RACES, CLASSES, BACKGROUNDS, ALIGN, TRAITS, IDEALS, BONDS, FLAWS, QUIRKS, HOOKS } from './dnd.js';

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
// One character, two styles: the creator edits one persona and previews it as a Crystal sprite (the style most games
// use) or a MARROW body (the brawler's simulated fighters), with a D&D sheet beside it. Stats are flavour only.
const MANIMS = { guard: 10, fwalk: 8, punch: 6, kick: 7, spinkick: 8, dance: 8 };
const MSEQ = ['guard', 'fwalk', 'punch', 'kick', 'guard', 'spinkick', 'dance'];
// the Crystal preview runs through every animation, turning to show the directions
const CSEQ = [['idle', 'S', 1.2], ['walk', 'SW', 1.4], ['walk', 'W', 1.2], ['run', 'NW', 1], ['run', 'N', 1], ['jump', 'E', 0.6], ['land', 'E', 0.3], ['attack', 'SE', 0.5], ['shoot', 'S', 0.5], ['cast', 'SW', 1.1],
  ['flinch', 'S', 0.4], ['knockdown', 'E', 1.4], ['kneel', 'S', 1], ['wave', 'S', 1.2], ['cheer', 'SE', 1.2], ['laugh', 'S', 1], ['nod', 'SW', 0.9], ['shake', 'S', 0.9], ['surprise', 'S', 0.8],
  ['think', 'SW', 1.2], ['angry', 'S', 1], ['sad', 'S', 1.2], ['love', 'S', 1.2], ['idle', 'NE', 0.8]];
const CTOTAL = CSEQ.reduce((a, s) => a + s[2], 0);
// the sheet's editable choices: [key, label, values, shown as]
const DPARTS = [
  ['race', 'Race', RACES.map((r) => r.n)], ['cls', 'Class', CLASSES.map((c) => c.n)], ['bg', 'Background', BACKGROUNDS.map((b) => b[0])], ['align', 'Alignment', ALIGN],
  ['trait', 'Trait', TRAITS], ['trait2', 'Trait', TRAITS], ['ideal', 'Ideal', IDEALS], ['bond', 'Bond', BONDS], ['flaw', 'Flaw', FLAWS], ['quirk', 'Quirk', QUIRKS], ['hook', 'Hook', HOOKS],
];
const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
const newSeed = () => Math.floor(Math.random() * 1e9) + 1;

export function creatorMedia() {
  const saved = getHero();
  let seed = saved?.seed || newSeed(), persona = saved ? normPersona(saved.persona, seed) : personaFor(seed, 'Fantasy');
  let dseed = saved?.dnd?.dseed || newSeed(), choice = {}, ch = null;
  const reroll = () => { ch = rollCharacter(mulberry32(dseed), { ...choice, persona, name: name.value.trim() || undefined }); ch.dseed = dseed; };
  let sheet = null, anims = null, style = 'crystal', open = 'look';
  const cv = el('canvas.creator-cv'); cv.width = 240; cv.height = 240;
  const name = el('input.creator-name', { value: saved?.name || 'Nameless One', maxlength: 24, placeholder: 'Name' });
  for (const ev of ['pointerdown', 'click', 'keydown']) name.addEventListener(ev, (e) => e.stopPropagation());
  name.addEventListener('input', () => { if (ch) { ch.name = name.value.trim() || 'Nameless One'; paintSheet(); } });
  if (saved?.dnd) { ch = fromSheet(saved.dnd); ch.persona = persona; for (const [k] of DPARTS) choice[k] = k === 'race' || k === 'cls' ? ch[k].n : ch[k]; } else reroll();
  const tabs = el('div.creator-tabs'), sec = el('div.creator-tabs'), rows = el('div.creator-rows'), extra = el('div');
  const status = el('div.muted.creator-status', saved ? `${saved.name} is your hero in the games.` : 'Make someone, then save them to star in the games.');
  const busy = el('div.muted.creator-busy', ''), desc = el('p.muted', { style: { fontSize: '12.5px', margin: '6px 0' } });
  const row = (lab, val, sw, step) => el('div.creator-row', el('span', lab), el('button.btn.sm', { onclick: stop(() => step(-1)) }, '‹'),
    el('b', { style: { color: sw || '' }, title: String(val) }, sw ? `● ${val}` : String(val)), el('button.btn.sm', { onclick: stop(() => step(1)) }, '›'));
  const cycle = (vals, v, d) => vals[(Math.max(0, vals.indexOf(v)) + d + vals.length) % vals.length];
  function paintSheet() { if (open === 'sheet' && ch) extra.replaceChildren(dndSheet(ch)); }
  function render() {
    tabs.replaceChildren(...[['crystal', 'Crystal style'], ['marrow', 'MARROW style']].map(([k, t]) => el(`button.btn.sm${style === k ? '.primary' : ''}`, { onclick: stop(() => { style = k; render(); }) }, t)));
    sec.replaceChildren(...[['look', 'Look'], ['sheet', 'D&D sheet']].map(([k, t]) => el(`button.btn.sm${open === k ? '.primary' : ''}`, { onclick: stop(() => { open = k; render(); }) }, t)));
    desc.textContent = describePersona(persona);
    if (open === 'look') {
      rows.replaceChildren(...FIELDS.map(([k, lab, vals]) => row(lab, persona[k], swatch(k, persona[k]), (d) => { persona = { ...persona, [k]: cycle(vals, persona[k], d) }; changed(); })));
      extra.replaceChildren();
    } else {
      rows.replaceChildren(...DPARTS.map(([k, lab, vals]) => {
        const v = k === 'race' || k === 'cls' ? ch[k].n : ch[k];
        return row(lab, v.length > 26 ? `${v.slice(0, 24)}…` : v, '', (d) => { choice[k] = cycle(vals, v, d); reroll(); render(); });
      }));
      paintSheet();
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (style === 'crystal') { const next = crystalSheet(seed, { char: personaToCrystal(persona), cache: false }); next.ready.then(() => { if (next.ok) sheet = next; }); return; }
      busy.textContent = 'simulating muscles, cloth and hair…';
      const next = marrowAnims(seed, MANIMS, { size: 96, look: personaToMarrow(persona), face: true, grit: 0 });
      next.ready.then(() => { anims = next; busy.textContent = ''; });
    }, 250);
  }
  let timer = 0;
  const changed = () => { if (ch) { ch.persona = persona; ch.appearance = describePersona(persona); } render(); };
  render();
  let raf = 0, t0 = performance.now();
  const draw = (now) => {
    const x = cv.getContext('2d'), t = (now - t0) / 1000;
    x.clearRect(0, 0, 240, 240);
    const g = x.createRadialGradient(120, 130, 10, 120, 130, 130); g.addColorStop(0, style === 'crystal' ? '#2a3550' : '#3a2a20'); g.addColorStop(1, style === 'crystal' ? '#0c1020' : '#120d0a'); x.fillStyle = g; x.fillRect(0, 0, 240, 240);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(120, 222, 50, 8, 0, 0, 7); x.fill();
    x.imageSmoothingEnabled = false;
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '600 11px ui-monospace, monospace'; x.textAlign = 'left';
    if (style === 'crystal' && sheet) {
      let u = t % CTOTAL, k = 0;
      while (u > CSEQ[k][2]) { u -= CSEQ[k][2]; k++; }
      const [anim, dir] = CSEQ[k], A = CS.animations[anim];
      const f = A.loop ? Math.floor(u * A.fps) % A.frames : Math.min(A.frames - 1, Math.floor(u * A.fps));
      drawFrame(x, sheet, anim, dir, f, 120, 226, 5.2);
      x.fillText(`${anim} · ${dir}`, 8, 16);
    } else if (style === 'marrow' && anims?.guard) {
      const clip = MSEQ[Math.floor(t / 1.4) % MSEQ.length], fr = anims[clip], k = Math.floor((t % 1.4) / 1.4 * fr.length);
      x.drawImage(fr[Math.min(fr.length - 1, k)], 0, -8, 240, 240);
      x.fillText(clip === 'fwalk' ? 'walk' : clip === 'guard' ? 'stance' : clip, 8, 16);
    } else { x.fillStyle = '#c9b8a0'; x.font = '600 13px ui-monospace, monospace'; x.textAlign = 'center'; x.fillText('…', 120, 120); }
    raf = requestAnimationFrame(draw);
  };
  const save = () => {
    const n = name.value.trim() || 'Nameless One'; if (ch) ch.name = n;
    setHero(makeHero(n, { ...persona, seed }, ch ? { ...toSheet(ch), persona: undefined, dseed } : null));
    status.textContent = `Saved. ${n} stars in the platformer, survivors, robotron, downhill, crypt and RPGs in Crystal style, and fights in Street Brawl in MARROW style.`; toast('Hero saved');
  };
  const buttons = el('div.btnrow',
    el('button.btn', { onclick: stop(() => { seed = newSeed(); persona = personaFor(seed, ERAS[seed % 3]); changed(); }) }, 'Random look'),
    el('button.btn', { onclick: stop(() => { dseed = newSeed(); choice = {}; const r = mulberry32(dseed); const c0 = rollCharacter(r); persona = adventurerPersona(c0.race, c0.cls, mulberry32(dseed ^ 0x9e3779b9), seed); choice = { race: c0.race.n, cls: c0.cls.n }; name.value = ''; reroll(); name.value = ch.name; changed(); }) }, 'Roll adventurer'),
    el('button.btn.primary', { onclick: stop(save) }, 'Save hero'),
    el('button.btn', { onclick: stop(() => { setHero(null); status.textContent = 'Removed. Games use their own heroes again.'; }) }, 'Remove'));
  const media = el('div.media.creator', cv);
  const body = el('div.creator-body', tabs, name, desc, sec, rows, extra, busy, buttons, status);
  return { media, body, activate: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }, deactivate: () => cancelAnimationFrame(raf) };
}
