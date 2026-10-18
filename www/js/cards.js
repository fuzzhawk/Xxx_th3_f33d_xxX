// Card renderers. Each card is a plain element; heavy content (iframes, canvases)
// is created in card._activate() and torn down in card._deactivate(), which the
// feed calls as cards scroll in and out of view.
import { el, toast, fmtDur } from './util.js';
import { settings, setMark, marks, CAT_LABEL } from './state.js';
import * as favs from './favs.js';
import { setImg } from './images.js';
import { productSVG } from './productart.js';
import { GAMES, GAME_HINT } from './games/all.js';
import { Psych } from './psych.js';
import * as stats from './stats.js';

const TOPIC_COLOR = {
  music: '#e8742a', literature: '#c9952b', science: '#7d8a4a', history: '#b5532f', transgressive: '#d06a8c', mysteries: '#6d8fa0', occult: '#9a7bb0',
  animals: '#d8a25a', retrogaming: '#5b9aa9', vintagescifi: '#a77bd0'
};
const TOPIC_GLYPH = { music: '♫', literature: '¶', science: '∿', history: '⌛', transgressive: '✶', mysteries: '?', occult: '☉' };
let soundOn = false;
const ICON_HEART = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2.1 0 3.6 1.2 4.6 2.7C12 6.2 13.5 5 15.6 5 19 5 20.7 8.4 19.2 11.4 17 15.6 12 20 12 20z"/></svg>';
const ICON_SAVE = '<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>';

export function labelOf(post) {
  return post.title || post.name || post.text || post.quote || post.top || post.vid || post.id;
}

function actions(post, ctx, ext) {
  const fav = el('button.fav', { 'aria-label': 'Favorite', title: 'Favorite', html: ICON_HEART });
  const save = el('button.save', { 'aria-label': 'Save', title: 'Save for later', html: ICON_SAVE });
  const up = el('button.up', { 'aria-label': 'More like this', title: 'More like this' }, '▲');
  const down = el('button.down', { 'aria-label': 'Less like this', title: 'Less like this' }, '▼');
  const sync = () => {
    fav.classList.toggle('on', favs.has('fav', post.id));
    save.classList.toggle('on', favs.has('save', post.id));
    up.classList.toggle('on', marks[post.id]?.v === 1);
    down.classList.toggle('on', marks[post.id]?.v === -1);
  };
  fav.onclick = (e) => { e.stopPropagation(); const on = favs.toggle('fav', post, ctx.pkgId); toast(on ? 'Added to favorites' : 'Removed from favorites'); sync(); };
  save.onclick = (e) => { e.stopPropagation(); const on = favs.toggle('save', post, ctx.pkgId); toast(on ? 'Saved' : 'Unsaved'); sync(); };
  up.onclick = (e) => { e.stopPropagation(); const v = setMark(post, 1, labelOf(post)); toast(v ? 'More like this' : 'Mark cleared'); sync(); };
  down.onclick = (e) => { e.stopPropagation(); const v = setMark(post, -1, labelOf(post)); toast(v ? 'Less like this' : 'Mark cleared'); sync(); };
  sync();
  const bar = el('div.actions', fav, save, up, down, el('span.spacer'), ext || null);
  bar._sync = sync;
  return bar;
}
const extLink = (url, label = 'Open ↗') => (url ? el('a.ext', { href: url, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() }, label) : null);
function head(post, label, color, extra) {
  return el('div.card-head', el('span.badge', { style: color ? { background: color } : null }, label), extra ? el('span', extra) : null);
}

// ------------------------------------------------ wiki
function wiki(post, ctx) {
  const topic = ctx.topics?.wiki?.[post.sub] || post.sub;
  const rest = post.summary.startsWith(post.hook.replace(/…$/, '')) ? post.summary.slice(post.hook.replace(/…$/, '').length).trim() : post.summary;
  const card = el('article.card.wiki',
    el('span.glyph', TOPIC_GLYPH[post.sub] || '❦'),
    head(post, topic, TOPIC_COLOR[post.sub], 'Wikipedia'),
    el('div.card-body',
      el('h3', post.title),
      el('div.hook', post.hook.endsWith('…') ? post.hook : post.hook),
      el('div.more', rest ? el('p', rest) : null),
      el('span.tapmore', 'tap to read more')),
    actions(post, ctx, extLink(post.url, 'Full article ↗')));
  if (post.thumb && settings.showWikiImages) {
    const img = el('img.thumb', { alt: '', loading: 'lazy' });
    setImg(img, post.thumb, () => img.remove());
    card.insertBefore(img, card.children[1]);
  }
  card.onclick = () => card.classList.toggle('open');
  return card;
}

// ------------------------------------------------ video
function video(post, ctx) {
  const frame = el('div.frame');
  const poster = el('img', { alt: '', loading: 'lazy' });
  poster.src = `https://i.ytimg.com/vi/${post.vid}/${post.short ? 'oar2' : 'hqdefault'}.jpg`;
  poster.onerror = () => { if (!poster.dataset.f) { poster.dataset.f = 1; poster.src = `https://i.ytimg.com/vi/${post.vid}/hqdefault.jpg`; } else poster.remove(); };
  const unmute = el('button.unmute', soundOn ? '🔇 Mute' : '🔊 Unmute');
  let iframe = null;
  const send = (func, args = []) => iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  const mount = () => {
    if (iframe) return;
    if (!navigator.onLine) { frame.replaceChildren(el('div.offline', 'You are offline. This video will play when you are back online.')); return; }
    const muted = settings.startMuted && !(settings.rememberSound && soundOn);
    const q = new URLSearchParams({ autoplay: 1, mute: muted ? 1 : 0, playsinline: 1, loop: 1, playlist: post.vid, controls: 1, rel: 0, modestbranding: 1, enablejsapi: 1, origin: location.origin });
    iframe = el('iframe', { src: `https://www.youtube.com/embed/${post.vid}?${q}`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', title: post.title });
    frame.append(iframe);
    unmute.textContent = muted ? '🔊 Unmute' : '🔇 Mute';
    card._muted = muted;
  };
  unmute.onclick = (e) => {
    e.stopPropagation();
    if (!iframe) { mount(); }
    card._muted = !card._muted;
    send(card._muted ? 'mute' : 'unMute'); if (!card._muted) send('setVolume', [100]);
    soundOn = !card._muted;
    unmute.textContent = card._muted ? '🔊 Unmute' : '🔇 Mute';
  };
  frame.append(poster, unmute);
  const card = el(`article.card.video${post.short ? '.short' : ''}`,
    head(post, ctx.topics?.video?.[post.sub] || 'Video', TOPIC_COLOR[post.sub], post.dur || ''),
    el('div', { style: { height: '10px' } }),
    frame,
    el('div.title', post.title),
    post.channel ? el('div.channel', post.channel) : null,
    actions(post, ctx, extLink(`https://www.youtube.com/watch?v=${post.vid}`, 'YouTube ↗')));
  if (!settings.autoplay) {
    const play = el('button.unmute', { style: { left: '50%', right: 'auto', bottom: '50%', transform: 'translate(-50%,50%)', fontSize: '18px' } }, '▶ Play');
    play.onclick = (e) => { e.stopPropagation(); play.remove(); mount(); };
    frame.append(play);
  }
  card._activate = () => { if (settings.autoplay) mount(); };
  card._deactivate = () => { if (iframe) { iframe.remove(); iframe = null; } };
  card._heavy = true;
  return card;
}

// ------------------------------------------------ games
function game(post, ctx) {
  const canvas = el('canvas');
  const mode = el('span.pill.auto', 'AUTO');
  const score = el('span.pill', '0');
  const hint = el('div.hint', `tap the game to play · ${GAME_HINT[post.sub] || ''}`);
  const autobtn = el('button.autobtn', '⟲ autopilot');
  const stage = el('div.stage', canvas, el('div.hud', mode, score), autobtn);
  const name = ctx.topics?.game?.[post.sub] || post.sub;
  const card = el('article.card.game', head(post, 'Game', '#7d8a4a', name), el('div.gtitle', post.title), hint, el('div', { style: { height: '8px' } }), stage, actions(post, ctx));
  let g = null, idle;
  const Cls = GAMES[post.sub] || GAMES.plinko;
  const ensure = () => {
    if (g) return g;
    g = new Cls(canvas, post);
    g.onHud = (s) => { if (score.textContent !== s) score.textContent = s; };
    return g;
  };
  const setPlaying = (p) => {
    ensure().setAuto(!p);
    stage.classList.toggle('playing', p);
    mode.textContent = p ? 'YOU' : 'AUTO';
    mode.className = `pill ${p ? 'live' : 'auto'}`;
    card.classList.toggle('playing', p);
    hint.textContent = p ? `playing · ${GAME_HINT[post.sub] || ''} · drag outside the game to scroll` : `tap the game to play · ${GAME_HINT[post.sub] || ''}`;
    if (p && !g.running) g.start();
    bump();
  };
  const bump = () => { clearTimeout(idle); idle = setTimeout(() => { if (!g?.auto) setPlaying(false); }, 25000); };
  stage.addEventListener('click', (e) => {
    if (!g || g.auto) { setPlaying(true); const p = g.local(e); g.tap(p.x, p.y); }
  });
  canvas.addEventListener('pointerdown', (e) => { if (!g || g.auto) return; canvas.setPointerCapture(e.pointerId); const p = g.local(e); g.pointer.down = true; g.down(p.x, p.y); bump(); });
  canvas.addEventListener('pointermove', (e) => { if (!g || g.auto) return; const p = g.local(e); g.move(p.x, p.y); });
  canvas.addEventListener('pointerup', (e) => { if (!g || g.auto) return; const p = g.local(e); g.pointer.down = false; g.up(p.x, p.y); });
  autobtn.onclick = (e) => { e.stopPropagation(); setPlaying(false); };
  card._activate = () => { ensure(); if (settings.autopilot || !g.auto) g.start(); else { g.resize(); g.frame(performance.now()); } };
  card._deactivate = () => { g?.stop(); };
  card._heavy = true;
  return card;
}

// ------------------------------------------------ psychedelic
function psych(post, ctx) {
  const canvas = el('canvas');
  const stage = el('div.stage', canvas, el('div.quote', `“${post.quote.replace(/^["“]|["”]$/g, '')}”`, post.author ? el('small', `— ${post.author}`) : null));
  const card = el('article.card.psych', stage, actions(post, ctx));
  let p = null;
  stage.onclick = () => { if (p) { p.stop(); p = new Psych(canvas, { ...post, seed: (Math.random() * 2 ** 31) | 0 }, settings); p.start(); } };
  card._activate = () => { p ||= new Psych(canvas, post, settings); p.start(); };
  card._deactivate = () => p?.stop();
  card._heavy = true;
  return card;
}

// ------------------------------------------------ memes
function meme(post, ctx) {
  const box = el('div.img');
  const img = el('img', { alt: post.text || post.title || 'meme', loading: 'lazy' });
  const fallback = () => {
    img.remove();
    box.prepend(el('div.noimg', ['🦉', '🐐', '🐸', '🦝', '🐈', '🦆', '🛸', '🗿'][post.id.length % 8]));
  };
  setImg(img, post.img, fallback);
  if (post.ratio) img.style.aspectRatio = `${1 / post.ratio}`;
  box.append(img);
  if (post.style === 'impact') {
    if (post.top) box.append(el('div.impact.top', post.top));
    if (post.bottom) box.append(el('div.impact.bottom', post.bottom));
  }
  const card = el('article.card.meme',
    head(post, 'Meme', '#d8c3a5', post.sub === 'kym' ? 'Know Your Meme' : ''),
    el('div', { style: { height: '10px' } }),
    post.style === 'caption' ? el('div.caption', post.text) : null,
    post.style === 'kym' ? el('div.kymtitle', post.title) : null,
    box,
    post.credit ? el('div.credit', post.credit) : null,
    actions(post, ctx, extLink(post.link, post.sub === 'kym' ? 'KYM ↗' : 'Source ↗')));
  return card;
}

// ------------------------------------------------ products
const CART = ['Your cart is now in a superposition.', 'Added to a cart that does not exist.', 'Order received. It will arrive yesterday.', 'Thank you. Your call is important to the void.', 'Out of stock in this timeline.', 'Shipping to your astral address.', 'Payment accepted: one (1) daydream.'];
function product(post, ctx) {
  const art = el('div', { html: productSVG(post) });
  const card = el('article.card.product',
    head(post, 'Product', '#ff7a1a', 'not available in stores'),
    el('div', { style: { height: '10px' } }),
    art.firstElementChild,
    el('div.card-body',
      el('h3', post.name),
      el('div.tag', post.tagline),
      el('p', post.desc),
      el('ul', post.features.map((f) => el('li', f))),
      el('div.price', el('b', post.price), el('button.buy', { onclick: (e) => { e.stopPropagation(); toast(CART[Math.floor(Math.random() * CART.length)]); } }, 'Add to cart')),
      el('div.fine', post.disclaimer)),
    actions(post, ctx));
  return card;
}

// ------------------------------------------------ self care
const BREATH = {
  box: [['in', 4], ['hold', 4], ['out', 4], ['hold', 4]],
  478: [['in', 4], ['hold', 7], ['out', 8]],
  coherent: [['in', 5], ['out', 5]],
  sigh: [['in', 2], ['in more', 1], ['out', 6]]
};
let audioCtx;
function chime() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 783.99, 1046.5].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * 0.18 + 1.2);
      o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + i * 0.18); o.stop(audioCtx.currentTime + i * 0.18 + 1.3);
    });
  } catch { /* no audio */ }
}
function selfcare(post, ctx) {
  const row = el('div.row');
  const body = el('div.sc-body', el('div.sc-title', post.title), el('div.sc-text', post.text), row);
  const done = el('button.btn', { onclick: (e) => { e.stopPropagation(); stats.selfcareDone(); done.textContent = 'Nice ✓'; done.disabled = true; toast('Logged. Proud of you.'); } }, 'Did it ✓');
  if (post.kind === 'timer') {
    const cd = el('span.countdown', fmtDur(post.dur));
    let iv;
    const start = el('button.btn.primary', {
      onclick: (e) => {
        e.stopPropagation();
        if (iv) { clearInterval(iv); iv = null; start.textContent = 'Resume'; return; }
        const end = Date.now() + (cd._left ?? post.dur) * 1000;
        start.textContent = 'Pause';
        iv = setInterval(() => {
          const left = Math.max(0, Math.round((end - Date.now()) / 1000));
          cd._left = left; cd.textContent = fmtDur(left);
          if (!left) { clearInterval(iv); iv = null; chime(); stats.selfcareDone(); start.textContent = 'Done ✓'; start.disabled = true; toast('Time! Welcome back.'); }
        }, 250);
      }
    }, `Start ${fmtDur(post.dur, true)}`);
    row.append(cd, start);
  } else if (post.kind === 'breathe') {
    const ball = el('div.ball'), lbl = el('div.lbl', 'tap start');
    body.insertBefore(el('div.breath', ball, lbl), row);
    let running = false;
    const startB = el('button.btn.primary', {
      onclick: async (e) => {
        e.stopPropagation();
        if (running) return;
        running = true; startB.disabled = true;
        const seq = BREATH[post.pattern] || BREATH.box;
        for (let cycle = 0; cycle < 4 && card.isConnected; cycle++) {
          for (const [ph, s] of seq) {
            lbl.textContent = `${ph} · ${s}`;
            ball.style.transitionDuration = `${s}s`;
            if (ph.startsWith('in')) ball.style.transform = `scale(${ph === 'in' ? 2.3 : 2.6})`;
            else if (ph === 'out') ball.style.transform = 'scale(1)';
            await new Promise((r) => setTimeout(r, s * 1000));
          }
        }
        lbl.textContent = 'well done'; stats.selfcareDone(); running = false; startB.disabled = false; startB.textContent = 'Again';
      }
    }, 'Start');
    row.append(startB);
  } else row.append(done);
  const card = el('article.card.selfcare', { style: { '--h': post.hue ?? 30 } }, body, actions(post, ctx));
  card.style.setProperty('--h', post.hue ?? 30);
  return card;
}

// ------------------------------------------------ web
function web(post, ctx) {
  const badge = { hn: 'hn', substack: 'substack', reddit: 'reddit' }[post.sub] || '';
  const card = el('article.card.web',
    el('div.card-head', el(`span.badge.${badge}`, post.source || post.sub), post.date ? el('span', post.date) : null),
    el('div.card-body',
      el('h3', post.title),
      post.excerpt ? el('div.ex', post.excerpt) : null,
      post.meta ? el('div.meta', post.meta) : null),
    actions(post, ctx, el('span', { style: { display: 'flex', gap: '6px' } }, post.discuss && post.discuss !== post.url ? extLink(post.discuss, 'Comments') : null, extLink(post.url))));
  return card;
}

// ------------------------------------------------ special
export function notice(title, text, buttons = []) {
  return el('article.card.notice', el('h3', title), el('p', text), el('div.btnrow', { style: { justifyContent: 'center' } }, buttons));
}

const RENDER = { wiki, video, game, psych, meme, product, selfcare, web };
export function renderCard(post, ctx) {
  const fn = RENDER[post.cat];
  if (!fn) return null;
  const card = fn(post, ctx);
  card.dataset.id = post.id;
  card.dataset.cat = post.cat;
  card._post = post;
  return card;
}
export { CAT_LABEL };
