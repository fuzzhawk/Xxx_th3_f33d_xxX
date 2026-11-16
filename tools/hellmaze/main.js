// Hell Maze on its own page, played with a mouse and keyboard: WASD to move, the mouse to look
// (pointer lock), the left button to fire, 1–5 or the wheel for weapons, Space to jump, Shift to
// sprint, P for the autopilot. tools/build-hellmaze.mjs bundles this with the game into one HTML file.
import { HellMaze } from '../../www/js/games/hellmaze.js';
import { W, H } from '../../www/js/games/engine.js';
import { setTextures } from '../../www/js/games/assets.js';
import TEXTURES from '../../packages/2026-W46/textures.json';

setTextures(TEXTURES);

const $ = (s) => document.querySelector(s);
const canvas = $('#game'), shell = $('#shell'), veil = $('#veil'), status = $('#status');
const store = { get(k, d) { try { const v = localStorage.getItem('hm.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('hm.' + k, JSON.stringify(v)); } catch { /* private mode */ } } };
const opts = { sens: store.get('sens', 2.4), invert: store.get('invert', false) };

const q = new URLSearchParams(location.search);
const seed = (Number(q.get('seed')) >>> 0) || ((Math.random() * 2 ** 31) >>> 0) || 1;
const post = { seed, title: 'Hell Maze', theme: { proc: true, hue: (seed >>> 3) % 360, seed, name: 'Hell Maze' } };
const g = new HellMaze(canvas, post);
g.aimCone = 0.035; // the mouse aims; the lock-on only finds the height of what is under the crosshair

// the page fits the window at the game's own aspect; the backing store stays a sensible size
const fit = () => {
  const s = Math.min(innerWidth / W, innerHeight / H);
  shell.style.width = `${Math.floor(W * s)}px`; shell.style.height = `${Math.floor(H * s)}px`;
  g.resize();
};
g.resize = function () {
  const cw = canvas.clientWidth || W, dpr = Math.min(2, devicePixelRatio || 1), bw = Math.min(W * 2, Math.round(cw * dpr)); // past twice the logical size the pixel art gains nothing
  canvas.style.filter = this.mods.hue ? `hue-rotate(${(this.post.seed % 300) + 30}deg) saturate(1.6)` : this.mods.invert ? 'invert(1) hue-rotate(180deg)' : '';
  canvas.width = bw; canvas.height = Math.round((bw * H) / W); this.scale = bw / W;
};
addEventListener('resize', fit);

// ------------------------------------------------------------------ input
const keys = new Set();
let fireHeld = false, locked = false, playing = false, noLock = false;
const CODES = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump' };
const has = (k) => keys.has(k);

const ownedList = () => g.arms ? g.arms.map((_, i) => i).filter((i) => g.owned[i]) : [];
const pick = (i) => { if (g.owned?.[i] && i !== g.weapon) { g.lastWeapon = g.weapon; g.weapon = i; } };
const cycle = (d) => { const o = ownedList(); if (o.length < 2) return; const k = o.indexOf(g.weapon); pick(o[(k + d + o.length) % o.length]); };

// inputs go in before each fixed step, where the touch controls and the autopilot put theirs
const step0 = g.step.bind(g);
g.step = function (dt) {
  if (!this.auto && this.wd && this.p && this.dead <= 0) {
    const f = (has('f') ? 1 : 0) - (has('b') ? 1 : 0), s = (has('r') ? 1 : 0) - (has('l') ? 1 : 0), n = Math.hypot(f, s) || 1, sp = has('run') ? 5.4 : 3.7;
    this.inF = (f / n) * sp; this.inS = (s / n) * sp;
    const p = this.p;
    if (has('jump') && p.vz === 0 && p.z <= this.wd.floorAt(p.x, p.y, p.z, p.sec) + 0.01) p.vz = 5.6 * Math.sqrt(this.G);
    if (fireHeld) this.fire();
  }
  step0(dt);
};

const look = (dx, dy) => {
  if (!g.p || g.auto) return;
  const k = opts.sens / 1000;
  g.p.a += dx * k;
  const pt = Math.max(-0.85, Math.min(0.85, (g.pitch || 0) - dy * k * 1.15 * (opts.invert ? -1 : 1)));
  g.pitch = g.pitchT = pt;
};

addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat) { toggleFull(); return; }
  if (!playing) { if (e.code === 'KeyP' && !e.repeat) setAuto(!g.auto); return; }
  const k = CODES[e.code];
  if (k) { keys.add(k); e.preventDefault(); if (g.auto) setAuto(false); return; }
  if (e.repeat) return;
  if (/^Digit[1-5]$/.test(e.code)) pick(Number(e.code[5]) - 1);
  else if (e.code === 'KeyQ') pick(g.lastWeapon ?? 0);
  else if (e.code === 'KeyE' || e.code === 'BracketRight') cycle(1);
  else if (e.code === 'BracketLeft') cycle(-1);
  else if (e.code === 'KeyP') setAuto(!g.auto);
});
addEventListener('keyup', (e) => { const k = CODES[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => { keys.clear(); fireHeld = false; });
document.addEventListener('mousemove', (e) => { if (locked || (playing && noLock)) look(e.movementX, e.movementY); });
canvas.addEventListener('mousedown', (e) => {
  if (!locked && !(playing && noLock)) return;
  if (e.button === 0) { fireHeld = true; if (g.auto) setAuto(false); }
  else if (e.button === 2) cycle(1);
});
addEventListener('mouseup', (e) => { if (e.button === 0) fireHeld = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (playing && Math.abs(e.deltaY) > 2) cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });

// ------------------------------------------------------------------ play, pause, autopilot
const autoTag = $('#autotag');
function setAuto(on) {
  g.autoOK = true; g.setAuto(on);
  if (!on) { g.pitchT = g.pitch || 0; }
  autoTag.hidden = !on || !playing;
}
function lock() {
  // pointer lock where the browser allows it; without it (a sandboxed frame) the game still plays
  const r = canvas.requestPointerLock?.({ unadjustedMovement: true });
  if (r?.catch) r.catch(() => { try { canvas.requestPointerLock(); } catch { noLock = true; begin(); } });
  else if (!canvas.requestPointerLock) { noLock = true; begin(); }
}
function begin() {
  playing = true; veil.hidden = true; autoTag.hidden = !g.auto;
  if (!g.running) g.start();
}
function pause() {
  playing = false; keys.clear(); fireHeld = false;
  veil.hidden = false; autoTag.hidden = true; $('#title').textContent = 'Paused'; $('#go').textContent = 'Resume';
  g.stop();
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { if (g.auto && !$('#watch').checked) setAuto(false); begin(); } else if (playing) pause();
});
document.addEventListener('pointerlockerror', () => { noLock = true; begin(); });
$('#go').addEventListener('click', (e) => { e.stopPropagation(); setAuto($('#watch').checked); lock(); });
$('#again').addEventListener('click', (e) => { e.stopPropagation(); const u = new URL(location.href); u.searchParams.set('seed', ((Math.random() * 2 ** 31) >>> 0) || 1); location.href = u.href; });
canvas.addEventListener('click', () => { if (!locked && playing && !noLock) lock(); });

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().then(() => { if (playing && !locked) lock(); }).catch(() => {});
}
$('#full').addEventListener('click', (e) => { e.stopPropagation(); toggleFull(); });

const sens = $('#sens'), inv = $('#invert'), sensV = $('#sensv');
sens.value = String(opts.sens); inv.checked = opts.invert; sensV.textContent = opts.sens.toFixed(1);
sens.addEventListener('input', () => { opts.sens = Number(sens.value); sensV.textContent = opts.sens.toFixed(1); store.set('sens', opts.sens); });
inv.addEventListener('change', () => { opts.invert = inv.checked; store.set('invert', opts.invert); });

// the score line in the corner
g.onHud = (s) => { if (status.textContent !== s) status.textContent = s; };
$('#seed').textContent = `seed ${seed}`;
const mods = g.modLabels();
$('#mods').textContent = mods.length ? mods.join(' · ') : '';

// behind the title the autopilot plays (the attract mode); clicking takes over
fit();
setAuto(true);
g.start();
Object.assign(globalThis, { hm: g });
