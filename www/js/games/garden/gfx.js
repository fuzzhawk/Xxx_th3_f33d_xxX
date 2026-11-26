// The garden's graphics options (Makhana's, adapted for a card): presets, then every knob, saved on
// the phone. The menu's Graphics page draws these rows and drags their sliders.
export const GFX_DEF = { preset: 'DRIFTER', dof: 'DEPTH', scale: 2, zoom: 208, pitch: 22, fov: 60, blur: 5, band: 0.3, focus: 0, sat: 1.04, contrast: 1.04, bright: 1, fog: 1.7, fogOv: 1.5, parts: 1.4, vig: 1.4, dither: 1, fps: 60 };
export const GPRESETS = {
  DRIFTER: { dof: 'DEPTH', scale: 2, pitch: 22, fov: 60, blur: 5, band: 0.3, focus: 0, sat: 1.04, contrast: 1.04, fog: 1.7, fogOv: 1.5, parts: 1.4, vig: 1.4 },
  DIORAMA: { dof: 'DEPTH', pitch: 45, fov: 24, blur: 2.4, band: 0.15, focus: 0, sat: 1.12, contrast: 1, fog: 1, fogOv: 1, parts: 1, vig: 1 },
  MINIATURE: { dof: 'SCREEN', pitch: 52, fov: 30, blur: 5, band: 0.05, focus: 0, sat: 1.3, contrast: 1.12, fog: 0.8 },
  'LOW ANGLE': { pitch: 12, fov: 40, blur: 3.2, band: 0.14, focus: 0.06, sat: 1.06, contrast: 1.06, fog: 1.4 },
  CLASSIC: { pitch: 76, fov: 8, blur: 0, band: 0.15, focus: 0, sat: 1, contrast: 1, fog: 0.6 },
  'CRISP HD': { scale: 3, blur: 1.2, band: 0.22, sat: 1.04, contrast: 1 },
  'BATTERY SAVER': { scale: 1, blur: 2, parts: 0.6, fogOv: 0.8, fps: 30 },
  'NO BLUR': { blur: 0 }
};
export const GROWS = [
  { k: 'preset', label: 'Preset', type: 'choice', opts: Object.keys(GPRESETS), help: 'one-tap looks; fine-tune below' },
  { k: 'dof', label: 'Focus mode', type: 'choice', opts: ['DEPTH', 'SCREEN'], help: 'depth: true depth of field. screen: a tilt-shift strip' },
  { k: 'scale', label: 'Resolution', min: 0.5, max: 4, step: 0.25, fmt: (v) => `${v}×`, help: 'pixels drawn per view pixel; 1× is the gritty original' },
  { k: 'zoom', label: 'View size', min: 140, max: 300, step: 4, fmt: (v) => `${v}`, help: 'how much of the world fits in the card' },
  { k: 'pitch', label: 'Camera', min: 8, max: 85, step: 1, fmt: (v) => `${v}°`, help: '8 skims the ground, 85 looks straight down' },
  { k: 'fov', label: 'Lens', min: 4, max: 110, step: 1, fmt: (v) => `${v}°`, help: 'low is a flat miniature, high a strong depth' },
  { k: 'blur', label: 'Blur', min: 0, max: 16, step: 0.1, fmt: (v) => v.toFixed(1), help: 'how soft the out-of-focus world goes' },
  { k: 'band', label: 'Focus range', min: 0, max: 1.2, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%`, help: 'how much depth round you stays sharp' },
  { k: 'focus', label: 'Focus distance', min: -0.3, max: 0.3, step: 0.01, fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`, help: '+ farther, − nearer' },
  { k: 'sat', label: 'Saturation', min: 0.4, max: 1.8, step: 0.02, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'contrast', label: 'Contrast', min: 0.7, max: 1.4, step: 0.02, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'bright', label: 'Brightness', min: 0.6, max: 1.4, step: 0.02, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'fog', label: 'Depth fog', min: 0, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, help: 'haze with distance' },
  { k: 'fogOv', label: 'Fog wisps', min: 0, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, help: 'the drifting dithered fog' },
  { k: 'parts', label: 'Weather', min: 0, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, help: 'rain, ash, spores, sand, snow' },
  { k: 'vig', label: 'Vignette', min: 0, max: 4, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: 'dither', label: 'Fades', type: 'choice', opts: ['DITHER', 'SOLID'], map: { DITHER: 1, SOLID: 0 }, help: 'how far things fade out' },
  { k: 'fps', label: 'Frame rate', type: 'choice', opts: ['60', '30'], map: { 60: 60, 30: 30 }, help: '30 saves battery' },
  { k: 'reset', label: 'Reset to defaults', type: 'button' }
];
const KEY = 'garden.gfx';
export const GFX = { ...GFX_DEF };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(GFX, s); } catch { /* none saved */ }
export function gfxSave() { try { localStorage.setItem(KEY, JSON.stringify(GFX)); } catch { /* private */ } }
export function gfxValue(R) { if (R.type === 'choice') { if (R.map) return Object.keys(R.map).find((k) => R.map[k] === GFX[R.k]) ?? R.opts[0]; return GFX[R.k]; } return GFX[R.k]; }
export function gfxSet(k, v) {
  const R = GROWS.find((r) => r.k === k); if (R && R.min !== undefined) { v = Math.min(R.max, Math.max(R.min, Math.round(v / R.step) * R.step)); v = +v.toFixed(3); }
  if (GFX[k] === v) return; GFX[k] = v; if (k !== 'preset') GFX.preset = 'CUSTOM'; gfxSave();
}
export function gfxPreset(name) { const p = GPRESETS[name]; if (!p) return; Object.assign(GFX, p); GFX.preset = name; gfxSave(); }
export function gfxStep(R, dir) {
  if (R.type === 'button') { if (R.k === 'reset') { Object.assign(GFX, GFX_DEF); gfxSave(); } return; }
  if (R.type === 'choice') { const cur = String(gfxValue(R)); let j = R.opts.indexOf(cur); j = ((j < 0 ? 0 : j) + dir + R.opts.length) % R.opts.length; const v = R.opts[j]; if (R.k === 'preset') gfxPreset(v); else gfxSet(R.k, R.map ? R.map[v] : v); return; }
  gfxSet(R.k, GFX[R.k] + dir * R.step);
}
