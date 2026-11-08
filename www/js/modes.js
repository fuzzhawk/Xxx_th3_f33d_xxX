// Morning, day and evening modes. The clock picks one when the app opens (evening 23:00–05:00,
// morning 05:00–11:00, day otherwise) and again after a long break; the top-bar switch changes
// it any time. Evening mode adds an adjustable blue-light filter.
import { settings, saveSettings } from './state.js';
import { el } from './util.js';

export const MODES = ['morning', 'day', 'evening'];
export const MODE_LABEL = { morning: 'Morning', day: 'Day', evening: 'Evening' };
export const MODE_ICON = { morning: '☀︎', day: '◐', evening: '☾' };
export const MODE_NOTE = {
  morning: 'Body, breath, gratitude, living things',
  day: 'The regular feed',
  evening: 'Dreams, poems, night thoughts · warm light'
};

export function clockMode(d = new Date()) {
  const h = d.getHours();
  return h >= 23 || h < 5 ? 'evening' : h < 11 ? 'morning' : 'day';
}

let mode = 'day';
const listeners = new Set();
export const getMode = () => mode;
export const onMode = (f) => listeners.add(f);

export function setMode(m, { manual = false } = {}) {
  if (!MODES.includes(m)) m = 'day';
  const changed = m !== mode;
  mode = m;
  document.body.dataset.mode = m;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', m === 'morning' ? '#f7efe8' : m === 'evening' ? '#1b130e' : '#14110f');
  if (manual) { settings.lastMode = m; saveSettings(); }
  applyFilter();
  renderSwitch();
  if (changed) listeners.forEach((f) => { try { f(m); } catch (e) { console.error(e); } });
}

// ------------------------------------------------ blue-light filter (multiplies the screen by a warm amber)
let veil = null;
export function applyFilter() {
  veil ||= document.body.appendChild(el('div', { id: 'bluelight', 'aria-hidden': 'true' }));
  const on = mode === 'evening' && settings.blueLightOn !== false;
  veil.style.opacity = on ? String(Math.max(0, Math.min(0.75, settings.blueLight ?? 0.35))) : '0';
}

// ------------------------------------------------ top-bar switch (+ the filter slider in evening mode)
let box = null;
function renderSwitch() {
  if (!box) return;
  const btn = el('button.modebtn', { 'aria-label': `${MODE_LABEL[mode]} mode`, onclick: openPicker }, el('span.mi', MODE_ICON[mode]), el('span.ml', MODE_LABEL[mode]));
  const kids = [btn];
  if (mode === 'evening') {
    const slider = el('input.bl-range', { type: 'range', min: '0', max: '75', step: '1', value: String(Math.round((settings.blueLight ?? 0.35) * 100)), 'aria-label': 'Blue-light filter' });
    slider.oninput = () => { settings.blueLight = +slider.value / 100; settings.blueLightOn = true; applyFilter(); };
    slider.onchange = () => saveSettings();
    kids.push(el('label.bl', { title: 'Blue-light filter' }, el('span', '◒'), slider));
  }
  box.replaceChildren(...kids);
}
function openPicker() {
  const close = () => { bd.remove(); removeEventListener('popstate', close); };
  const opt = (m) => el(`button.modeopt${m === mode ? '.on' : ''}`, { onclick: () => { history.back(); setTimeout(() => setMode(m, { manual: true }), 60); } },
    el('span.mi', MODE_ICON[m]), el('span', el('b', MODE_LABEL[m]), el('small', MODE_NOTE[m])));
  const auto = el('input', { type: 'checkbox', checked: settings.autoMode !== false });
  auto.onchange = () => { settings.autoMode = auto.checked; saveSettings(); };
  const bd = el('div.backdrop', { onclick: (e) => { if (e.target === bd) history.back(); } },
    el('div.actionsheet.modesheet', el('div.grab'), el('div.sh-title', 'Mode'), ...MODES.map(opt),
      el('label.modeauto', auto, el('span', 'Pick by the clock when the app opens', el('small', 'Evening 11 pm – 5 am · Morning 5 – 11 am · Day otherwise')))));
  history.pushState({ sheet: 'mode' }, '');
  addEventListener('popstate', close, { once: true });
  document.body.append(bd);
}

// ------------------------------------------------ start-up and long breaks
let hiddenAt = 0;
export function initModes(container) {
  box = container;
  setMode(settings.autoMode === false ? (settings.lastMode || 'day') : clockMode());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    // back after 45+ minutes away counts as opening the app again
    if (hiddenAt && Date.now() - hiddenAt > 45 * 60000 && settings.autoMode !== false) setMode(clockMode());
  });
}
