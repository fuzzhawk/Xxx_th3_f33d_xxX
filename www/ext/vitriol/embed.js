/* The Feed: Vitriol inside a card.
   Only does anything when the page is opened with ?embed. It skips the title and build screens,
   starts STORY mode with the autopilot flying it end to end, and replaces the letterboxed 16:9
   canvas with a portrait camera: the canvas is drawn at card height and slid so the operative stays
   in view, zooming in when things are calm and out when the fight crowds in. Story screens and
   cutscenes are shown whole. The card unloads the frame when it scrolls away. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (!q.has('embed')) return;
  document.documentElement.classList.add('embed');
  const css = document.createElement('style');
  css.textContent = `
    html.embed, html.embed body { overflow: hidden; background: #07060a; }
    html.embed #stage { display: block; }
    html.embed #game { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    html.embed .screen { font-size: 11px; }
    html.embed .screen button, html.embed .sound-btn { pointer-events: none; }
    html.embed #scr-story, html.embed #scr-title, html.embed #scr-setup, html.embed #scr-debrief { transform: scale(.62); transform-origin: 50% 0; }
  `;
  document.head.appendChild(css);

  const $ = (id) => document.getElementById(id);
  const click = (id) => { const b = $(id); if (b) b.click(); };
  let started = false;

  // straight into a story, autopilot on
  function start() {
    if (started) return;
    const A = window.__APP;
    if (!A || !$('btn-start')) return setTimeout(start, 120);
    started = true;
    try { window.AUDIO.enabled = false; } catch (e) { /* silent anyway */ }
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

  // the portrait camera
  const cam = { x: 280, y: 160, z: 1 };
  function frame() {
    requestAnimationFrame(frame);
    const A = window.__APP, cv = $('game');
    if (!A || !cv) return;
    const W = innerWidth, H = innerHeight, LW = cv.width || 560, LH = cv.height || 315, M = A.mission;
    const playing = (A.state === 'play' || A.state === 'paused') && M && M.player;
    let tx = LW / 2, ty = LH / 2, tz;
    if (playing) {
      const P = M.player;
      tx = P.x - (M.scroll || 0); ty = P.y - 20;
      // how busy it is around the operative: a crowd or a boss pulls the camera back
      let near = 0;
      for (const e of M.enemies || []) if (e && !e.dead && Math.abs(e.x - P.x) < 220 && Math.abs(e.y - P.y) < 160) near += e.boss ? 3 : 1;
      const calm = Math.max(0, 1 - near / 4);
      tz = 1 + calm * 0.55;
    } else tz = 0;   // story screens and cutscenes: the whole picture
    const fitH = H / LH, fitW = W / LW;
    const s = tz === 0 ? fitW : fitH * tz;
    cam.z += (s - cam.z) * 0.06;
    cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12;
    const w = LW * cam.z, h = LH * cam.z;
    let left = W / 2 - cam.x * cam.z, top = H * 0.55 - cam.y * cam.z;
    left = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, left));
    top = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, top));
    cv.style.width = LW + 'px'; cv.style.height = LH + 'px';
    cv.style.transform = `translate(${left}px,${top}px) scale(${cam.z})`;
  }
  requestAnimationFrame(frame);

})();
