// Bladeview on its own page (bundled by tools/build-bladeview.mjs into standalone/bladeview/index.html).
// The city fills the window. A click, Space or → moves the camera on; 1–9 and 0 go to a level; A
// turns the slow tour on or off (a new view every 45 s); F is full screen; H hides the hints. The
// view's seed rides in the address (#s=…&lv=…), so a view can be bookmarked or shared.
import { BladeView } from '../../www/js/bladeview.js';

const RW = globalThis.BV_RW, RH = globalThis.BV_RH, TOUR = 45;
const $ = (id) => document.getElementById(id);
const cv = $('city'), hint = $('hint'), where = $('where'), tuning = $('tuning'), tourTag = $('tour');
const store = { get: (k, d) => { try { const v = localStorage.getItem(`bladeview.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(`bladeview.${k}`, JSON.stringify(v)); } catch { /* private window */ } } };

// the canvas keeps the render's shape, as large as the window allows
function fit() {
  const k = Math.min(innerWidth / RW, innerHeight / RH), w = Math.floor(RW * k), h = Math.floor(RH * k);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
}
addEventListener('resize', fit); fit();

let tour = store.get('tour', true), tourT = 0, lastLv = null, wantLv = null;
const V = new BladeView(cv, (i) => {
  // a new view is in: show where we are, put its seed in the address, forget a one-off level choice
  const v = V.view;
  where.textContent = `${i.name} · level ${i.level} · ${i.weather} · ${i.clock}`;
  const q = new URLSearchParams({ s: String(v.seed) }); if (V.forceLv != null) q.set('lv', String(V.forceLv + 1));
  history.replaceState(null, '', `#${q}`);
  V.forceLv = undefined; lastLv = i.level; tourT = 0; tuning.hidden = true;
});
// a view from the address, if there is one
{
  const q = new URLSearchParams(location.hash.slice(1)), s = parseInt(q.get('s'), 10), lv = parseInt(q.get('lv'), 10);
  if (Number.isFinite(s)) V.seed = s >>> 0;
  if (lv >= 1 && lv <= 10) V.forceLv = lv - 1;
}
V.start();

const next = (lv) => { if (lv != null) V.forceLv = lv; V.tap(); tourT = 0; };
cv.addEventListener('click', () => next());
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'arrowright' || k === 'enter') { e.preventDefault(); next(); }
  else if (/^[0-9]$/.test(k)) next(k === '0' ? 9 : +k - 1);
  else if (k === 'a') { tour = !tour; store.set('tour', tour); showTour(); }
  else if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
  else if (k === 'h') { hint.classList.toggle('off'); store.set('hints', !hint.classList.contains('off')); }
  wake();
});
if (store.get('hints', true) === false) hint.classList.add('off');

// the hints fade when the mouse is still, and come back when it moves
let idleT = 0;
const wake = () => { idleT = 0; document.body.classList.remove('still'); };
addEventListener('pointermove', wake); addEventListener('pointerdown', wake);
const showTour = () => { tourTag.textContent = tour ? `tour · a new view every ${TOUR} s` : 'tour off'; tourTag.classList.add('show'); setTimeout(() => tourTag.classList.remove('show'), 1800); };

// the slow tour, and nothing at all while the page is hidden
let last = performance.now();
(function tick(now) {
  const dt = Math.min(1, (now - last) / 1000); last = now;
  if ((idleT += dt) > 4) document.body.classList.add('still');
  if (tour && V.state === 'live' && (tourT += dt) > TOUR) next();
  requestAnimationFrame(tick);
})(last);
document.addEventListener('visibilitychange', () => { if (document.hidden) V.stop(); else { V.start(); last = performance.now(); } });
if (lastLv == null) tuning.hidden = false;
