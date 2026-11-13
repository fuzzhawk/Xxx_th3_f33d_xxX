/* The Feed: Vitriol inside a card.
   Only does anything when the page is opened with ?embed. It skips the title and build screens and
   starts STORY mode with the autopilot flying it end to end, unhurried: the clock runs a little slow,
   the pilot reacts a beat later and aims a touch looser, and the screen shake is kept small.
   The camera is pulled well back: the 16:9 frame is drawn most of the card's width, following the
   operative sideways, zooming in only a little when it is calm. The bands above and below take the
   frame's own top and bottom colours, and the HUD is drawn on a canvas of its own the shape of the
   card (render.js layout), so the vitals, the weapon, the extraction bar, the objective, hostiles,
   score and the boss bar all sit whole in the card's corners and edges. Story screens and cutscenes
   are shown whole. The card unloads the frame when it scrolls away. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (!q.has('embed')) return;
  document.documentElement.classList.add('embed');
  window.__EMBED = true;
  window.__TIMESCALE = 0.74;
  const css = document.createElement('style');
  css.textContent = `
    html.embed, html.embed body { overflow: hidden; background: #07060a; }
    html.embed #stage { display: block; transition: background .6s; }
    html.embed #game { position: absolute; left: 0; top: 0; transform-origin: 0 0; box-shadow: none; }
    html.embed #feedhud { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; image-rendering: pixelated; }
    html.embed .screen { font-size: 11px; }
    html.embed .screen button, html.embed .sound-btn { pointer-events: none; }
    html.embed #scr-story, html.embed #scr-title, html.embed #scr-setup, html.embed #scr-debrief { transform: scale(.62); transform-origin: 50% 0; }
  `;
  document.head.appendChild(css);

  const $ = (id) => document.getElementById(id);
  const click = (id) => { const b = $(id); if (b) b.click(); };
  let started = false;

  // straight into a story, autopilot on, and a calmer pilot
  function start() {
    if (started) return;
    const A = window.__APP;
    if (!A || !$('btn-start')) return setTimeout(start, 120);
    started = true;
    try { window.AUDIO.enabled = false; } catch (e) { /* silent anyway */ }
    try { Object.assign(window.PILOT.CFG, { reactMin: 0.2, reactMax: 0.42, aimJitter: 0.085, stuckTime: 1.4 }); } catch (e) { /* the pilot as it is */ }
    click('btn-start');
    setTimeout(() => {
      click('m-story');
      const a = $('autoField');
      if (a) { a.checked = true; a.dispatchEvent(new Event('change')); }
      A.opts.autopilot = true;
      click('btn-deploy');
    }, 250);
  }
  addEventListener('load', () => setTimeout(start, 150));

  // the HUD's own canvas, the size of the card
  const hud = document.createElement('canvas');
  hud.id = 'feedhud';
  const hctx = hud.getContext('2d');
  addEventListener('load', () => document.body.appendChild(hud));
  const HUD_DW = 300;   // design width of the card HUD (render.js draws in these units)
  let hudOn = false, hw = 0, hh = 0;
  function hudSize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (w !== hw || h !== hh) { hw = hud.width = w; hh = hud.height = h; }
  }

  // the frame's top and bottom colours, for the bands above and below it
  const probe = document.createElement('canvas'); probe.width = 1; probe.height = 2;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  let bandT = 0, bandTop = '#07060a', bandBot = '#07060a';
  function bands(cv, LW, LH) {
    try {
      pctx.imageSmoothingEnabled = true;
      pctx.drawImage(cv, 0, 0, LW, 6, 0, 0, 1, 1);
      pctx.drawImage(cv, 0, LH - 6, LW, 6, 0, 1, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 2).data, c = (o) => `rgb(${d[o] * 0.7 | 0},${d[o + 1] * 0.7 | 0},${d[o + 2] * 0.7 | 0})`;
      bandTop = c(0); bandBot = c(4);
    } catch (e) { /* keep the last */ }
  }

  // the camera
  const cam = { x: 280, y: 160, z: 0 };
  function frame(now) {
    requestAnimationFrame(frame);
    const A = window.__APP, cv = $('game');
    if (!A || !cv) return;
    const W = innerWidth, H = innerHeight, LW = cv.width || 560, LH = cv.height || 315, M = A.mission;
    const playing = (A.state === 'play' || A.state === 'paused') && M && M.player;
    // the card HUD while playing; the frame's own HUD (and layout) for everything else
    if (playing !== hudOn) {
      hudOn = playing;
      if (playing) { hudSize(); window.__HUDCTX = hctx; } else { window.__HUDCTX = null; hctx.clearRect(0, 0, hud.width, hud.height); window.RENDER?.layout(); }
    }
    if (playing) {
      hudSize();
      window.RENDER?.layout(HUD_DW, HUD_DW * H / W, hud.width / HUD_DW);
      if (M.shake > 2) M.shake = 2;
    }
    const fitW = W / LW, u = W / HUD_DW;   // u: card px per HUD design unit
    let tx = LW / 2, tz;
    if (playing) {
      const P = M.player;
      tx = P.x - (M.scroll || 0);
      // how busy it is around the operative: a crowd or a boss pulls the camera back
      let near = 0;
      for (const e of M.enemies || []) if (e && !e.dead && Math.abs(e.x - P.x) < 220 && Math.abs(e.y - P.y) < 160) near += e.boss ? 3 : 1;
      const calm = Math.max(0, 1 - near / 4);
      tz = fitW * (1.2 + calm * 0.3);
    } else tz = fitW;   // story screens and cutscenes: the whole picture
    if (!cam.z) cam.z = tz;
    cam.z += (tz - cam.z) * 0.02;
    cam.x += (tx - cam.x) * 0.05;
    const w = LW * cam.z, h = LH * cam.z;
    // sideways it follows the operative; up and down it sits between the HUD's top and bottom bands
    let left = W / 2 - cam.x * cam.z;
    left = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, left));
    const topBand = playing ? 80 * u : 0, botBand = playing ? 30 * u : 0, room = H - topBand - botBand;
    const top = playing && h <= room ? topBand + (room - h) / 2 : (H - h) / 2;
    cv.style.width = LW + 'px'; cv.style.height = LH + 'px';
    cv.style.transform = `translate(${left}px,${top}px) scale(${cam.z})`;
    if (playing && now - bandT > 500) { bandT = now; bands(cv, LW, LH); }
    const st = $('stage');
    if (st) st.style.background = playing ? `linear-gradient(${bandTop} 0, ${bandTop} ${top + 2}px, ${bandBot} ${top + h - 2}px, ${bandBot} 100%)` : '#070809';
  }
  requestAnimationFrame(frame);
})();
