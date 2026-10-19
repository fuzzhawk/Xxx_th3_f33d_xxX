// Post renderers, laid out like a social feed: header (avatar, handle, context),
// full-width media, an action row, then the caption. Heavy content (iframes,
// canvases) is created in card._activate() and torn down in card._deactivate().
import { el, toast, fmtDur, copyText } from './util.js';
import { settings, setMark, marks, CAT_LABEL } from './state.js';
import * as favs from './favs.js';
import { setImg } from './images.js';
import { productSVG } from './productart.js';
import { GAMES, GAME_HINT } from './games/all.js';
import { MUTATORS } from './games/engine.js';
import { Psych } from './psych.js';
import { icon } from './icons.js';
import { actionSheet } from './sheet.js';
import { saveFromPost } from './save.js';
import { renderMeme } from './memes.js';
import * as stats from './stats.js';
import { oracleMedia, oracleLabel } from './oracle.js';
import { powerBody } from './power.js';

const TOPIC_COLOR = {
  music: '#e8742a', literature: '#c9952b', science: '#8a9a52', history: '#c4623a', transgressive: '#d06a8c', mysteries: '#6d9bb0', occult: '#a283c4',
  animals: '#d8a25a', retrogaming: '#5b9aa9', vintagescifi: '#a77bd0'
};
const TOPIC_GLYPH = { music: '♫', literature: '¶', science: '∿', history: '⌛', transgressive: '✶', mysteries: '?', occult: '☉' };
const CAT_FACE = { news: ['◉', '#8a2b2b'], game: ['◐', '#5e6b3a'], wiki: ['W', '#3a3530'], video: ['▶', '#9b3d1f'], meme: ['☺', '#8c5a3c'], product: ['✦', '#c9952b'], psych: ['✺', '#6d4a8c'], selfcare: ['☘', '#4f7a6f'], web: ['⌘', '#3a5a6a'], oracle: ['☯', '#5a3a6a'], power: ['⚔', '#8a4a1a'] };
let soundOn = false;

export function labelOf(post) {
  return post.title || post.name || post.text || post.quote || post.top || post.vid || post.id;
}
const handleFor = (post, ctx) => {
  switch (post.cat) {
    case 'wiki': return [`wiki.${post.sub}`, `${ctx.topics?.wiki?.[post.sub] || post.sub} · Wikipedia`];
    case 'video': return [post.channel ? post.channel.toLowerCase().replace(/[^\w.]+/g, '').slice(0, 24) || 'tube' : `tube.${post.sub}`, `${ctx.topics?.video?.[post.sub] || 'Video'}${post.dur ? ` · ${post.dur}` : ''}`];
    case 'game': return ['arcade', `${ctx.topics?.game?.[post.sub] || post.sub} · tap to play`];
    case 'meme': return [post.sub === 'kym' ? 'knowyourmeme' : 'meme.lord', post.sub === 'kym' ? 'Know Your Meme' : 'remix'];
    case 'product': return ['infomercial.tv', 'Sponsored · not available in stores'];
    case 'psych': return ['the.trip', `${post.sub} · generative`];
    case 'selfcare': return ['self.care', post.title];
    case 'web': return [post.source?.toLowerCase().replace(/[^\w.]+/g, '').slice(0, 24) || 'web', `${post.sub === 'comic' ? 'Comic' : post.sub === 'hn' ? 'Hacker News' : post.source || 'Web'}${post.date ? ` · ${post.date}` : ''}`];
    case 'news': return [post.source?.toLowerCase().replace(/[^\w.]+/g, '').slice(0, 24) || 'news', `${ctx.topics?.news?.[post.sub] || 'News'}${post.date ? ` · ${post.date}` : ''}`];
    case 'oracle': return ['the.oracle', `${oracleLabel(post.sub)} · ask, then cast`];
    case 'power': return ['power.scale', post.sub === 'tier' ? 'Tier list · binding in no jurisdiction' : 'Who would win?'];
    default: return [post.cat, ''];
  }
};

// ------------------------------------------------ shared chrome
function header(post, ctx) {
  const [handle, sub] = handleFor(post, ctx);
  const [g, bg] = post.cat === 'wiki' ? [TOPIC_GLYPH[post.sub] || 'W', TOPIC_COLOR[post.sub] || '#3a3530'] : CAT_FACE[post.cat] || ['•', '#333'];
  const more = el('button.more-btn', { 'aria-label': 'More', html: icon('more') });
  more.onclick = (e) => { e.stopPropagation(); postMenu(post, ctx, more.closest('.post')); };
  return el('div.post-head',
    el('div.avatar', el('span', { style: { background: bg } }, g)),
    el('div.who', el('b', handle, post.cat === 'wiki' || post.cat === 'product' ? el('span.tick', '✓') : null), el('small', sub)),
    more);
}
export function postMenu(post, ctx, card) {
  const link = post.wiki || post.url || post.link || (post.vid ? `https://www.youtube.com/watch?v=${post.vid}` : null);
  const hasMedia = card?.querySelector('.media img, .media canvas, .media svg.art');
  actionSheet(labelOf(post).toString().slice(0, 70), [
    hasMedia && { icon: 'download', label: 'Save image to gallery', run: () => saveFromPost(card) },
    link && { icon: 'send', label: post.wiki ? 'Open the Wikipedia article' : 'Open original', run: () => window.open(link, '_blank') },
    post.cat === 'meme' && post.link && post.link !== link && { icon: 'link', label: 'Image source', run: () => window.open(post.link, '_blank') },
    link && { icon: 'link', label: 'Copy link', run: async () => toast((await copyText(link)) ? 'Link copied' : 'Copy failed') },
    { icon: 'up', label: marks[post.id]?.v === 1 ? 'Clear "more like this"' : 'More like this', run: () => { toast(setMark(post, 1, labelOf(post)) ? 'You will see more like this' : 'Mark cleared'); card?._sync?.(); } },
    { icon: 'down', label: marks[post.id]?.v === -1 ? 'Clear "less like this"' : 'Less like this', run: () => { toast(setMark(post, -1, labelOf(post)) ? 'You will see less like this' : 'Mark cleared'); card?._sync?.(); } }
  ]);
}
function actions(post, ctx, ext) {
  const btn = (cls, ic, label) => el(`button.${cls}`, { 'aria-label': label, html: icon(ic) });
  const fav = btn('fav', 'heart', 'Favorite'), up = btn('up', 'up', 'More like this'), down = btn('down', 'down', 'Less like this'), save = btn('save', 'bookmark', 'Save');
  const share = ext ? btn('share', 'send', 'Open') : null;
  const sync = () => {
    fav.classList.toggle('on', favs.has('fav', post.id));
    save.classList.toggle('on', favs.has('save', post.id));
    up.classList.toggle('on', marks[post.id]?.v === 1);
    down.classList.toggle('on', marks[post.id]?.v === -1);
  };
  fav.onclick = (e) => { e.stopPropagation(); favs.toggle('fav', post, ctx.pkgId); sync(); };
  save.onclick = (e) => { e.stopPropagation(); toast(favs.toggle('save', post, ctx.pkgId) ? 'Saved' : 'Removed from saved'); sync(); };
  up.onclick = (e) => { e.stopPropagation(); toast(setMark(post, 1, labelOf(post)) ? 'More like this' : 'Mark cleared'); sync(); };
  down.onclick = (e) => { e.stopPropagation(); toast(setMark(post, -1, labelOf(post)) ? 'Less like this' : 'Mark cleared'); sync(); };
  if (share) share.onclick = (e) => { e.stopPropagation(); window.open(ext, '_blank'); };
  sync();
  const bar = el('div.actions', fav, up, down, share, el('span.spacer'), save);
  bar._sync = sync;
  return bar;
}
function post(cls, p, ctx, { media, body, ext, caption, metaLine, mediaInteractive = false } = {}) {
  const bar = actions(p, ctx, ext);
  const card = el(`article.post.${cls}`, header(p, ctx), media || null, body || null, bar, caption || null, metaLine ? el('div.meta-line', metaLine) : null);
  card._sync = bar._sync;
  if (media) wireMedia(card, media, p, ctx, mediaInteractive);
  return card;
}
// double-tap to like, long-press for the save menu
function wireMedia(card, media, p, ctx, interactive) {
  const heart = el('div.bigheart', { html: icon('heart', 'fill') });
  media.append(heart);
  let lastTap = 0, timer = null, sx = 0, sy = 0, longFired = false;
  media.addEventListener('contextmenu', (e) => e.preventDefault());
  media.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY; longFired = false;
    clearTimeout(timer);
    if (interactive && card.querySelector('.stage.playing')) return;
    timer = setTimeout(() => { longFired = true; navigator.vibrate?.(12); postMenu(p, ctx, card); }, 520);
  });
  media.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(timer); });
  media.addEventListener('pointerup', () => clearTimeout(timer));
  media.addEventListener('pointercancel', () => clearTimeout(timer));
  media.addEventListener('click', (e) => {
    if (longFired) { e.stopPropagation(); e.preventDefault(); return; }
    if (interactive) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!favs.has('fav', p.id)) favs.toggle('fav', p, ctx.pkgId);
      card._sync?.();
      heart.classList.remove('pop'); void heart.offsetWidth; heart.classList.add('pop');
    }
    lastTap = now;
  }, true);
}
const capt = (handle, text, extra) => el('div.caption', el('b', handle), text, extra || null);

// ------------------------------------------------ wiki (text post)
function wiki(p, ctx) {
  const topic = ctx.topics?.wiki?.[p.sub] || p.sub;
  const hookBase = p.hook.replace(/…$/, '');
  const rest = p.summary.startsWith(hookBase) ? p.summary.slice(hookBase.length).trim() : p.summary;
  const tp = el('div.textpost', { style: { '--tc': TOPIC_COLOR[p.sub] || '#c9952b' } },
    el('div.kicker', topic), el('h3', p.title), el('div.hook', p.hook),
    rest ? el('div.rest', el('p', rest)) : null,
    rest ? el('span.tapmore', 'Tap to read more') : null);
  tp.style.setProperty('--tc', TOPIC_COLOR[p.sub] || '#c9952b');
  const body = el('div', tp);
  if (p.thumb && settings.showWikiImages) {
    const img = el('img.thumb', { alt: '', loading: 'lazy' });
    setImg(img, p.thumb, () => img.remove());
    body.prepend(img);
  }
  const card = post('wiki', p, ctx, { body, ext: p.url, metaLine: 'From Wikipedia, the free encyclopedia' });
  tp.onclick = () => card.classList.toggle('open');
  return card;
}

// ------------------------------------------------ video
function video(p, ctx) {
  const frame = el('div.frame');
  const poster = el('img', { alt: '', loading: 'lazy' });
  poster.src = `https://i.ytimg.com/vi/${p.vid}/${p.short ? 'oar2' : 'hqdefault'}.jpg`;
  poster.onerror = () => { if (!poster.dataset.f) { poster.dataset.f = 1; poster.src = `https://i.ytimg.com/vi/${p.vid}/hqdefault.jpg`; } else poster.remove(); };
  const unmute = el('button.pillbtn.unmute', { html: icon('mute') });
  let iframe = null;
  const send = (func, args = []) => iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  const setLabel = () => { unmute.innerHTML = icon(card._muted ? 'mute' : 'sound'); };
  const onMsg = (e) => {
    if (!iframe || e.source !== iframe.contentWindow) return;
    let d; try { d = JSON.parse(e.data); } catch { return; }
    if (d.event === 'onError' || (d.event === 'infoDelivery' && d.info?.playerState === undefined && d.info?.errorCode)) unavailable(d.info);
  };
  const unavailable = (code) => {
    removeEventListener('message', onMsg);
    frame.replaceChildren(el('div.offline', `This video can't play here (YouTube error ${code ?? ''}). Skipping it.`));
    card._skip = true;
    setTimeout(() => { card.style.transition = 'opacity .4s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 420); }, 1400);
  };
  const mount = () => {
    if (iframe) return;
    if (!navigator.onLine) { frame.replaceChildren(el('div.offline', 'You are offline. This video will play when you are back online.')); return; }
    const muted = settings.startMuted && !(settings.rememberSound && soundOn);
    const q = new URLSearchParams({ autoplay: 1, mute: muted ? 1 : 0, playsinline: 1, loop: 1, playlist: p.vid, controls: 1, rel: 0, modestbranding: 1, enablejsapi: 1, origin: location.origin });
    iframe = el('iframe', { src: `https://www.youtube.com/embed/${p.vid}?${q}`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', title: p.title });
    iframe.addEventListener('load', () => iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: p.vid, channel: 'widget' }), '*'));
    addEventListener('message', onMsg);
    frame.append(iframe);
    card._muted = muted; setLabel();
  };
  unmute.onclick = (e) => {
    e.stopPropagation();
    if (!iframe) mount();
    card._muted = !card._muted;
    send(card._muted ? 'mute' : 'unMute'); if (!card._muted) send('setVolume', [100]);
    soundOn = !card._muted; setLabel();
  };
  frame.append(poster, unmute);
  const media = el('div.media', frame);
  const card = post(`video${p.short ? '.short' : ''}`, p, ctx, { media, ext: `https://www.youtube.com/watch?v=${p.vid}`, caption: capt(handleFor(p, ctx)[0], p.title), mediaInteractive: true });
  if (!settings.autoplay) {
    const play = el('button.pillbtn.play', { html: `${icon('play', 'fill')}<span>Play</span>` });
    play.onclick = (e) => { e.stopPropagation(); play.remove(); mount(); };
    frame.append(play);
  }
  card._activate = () => { if (settings.autoplay) mount(); };
  card._deactivate = () => { if (iframe) { removeEventListener('message', onMsg); iframe.remove(); iframe = null; } };
  card._heavy = true;
  return card;
}

// ------------------------------------------------ games
function game(p, ctx) {
  const canvas = el('canvas');
  const mode = el('span.pill.auto', 'AUTO');
  const score = el('span.pill', '0');
  const hud = el('div.hud', mode, score);
  const autobtn = el('button.pillbtn.autobtn', { html: `${icon('replay')}<span>Autopilot</span>` });
  const tapplay = el('div.pillbtn.tapplay', { html: `${icon('play', 'fill')}<span>Tap to play</span>` });
  const stage = el('div.stage', canvas, hud, autobtn, tapplay);
  const media = el('div.media', stage);
  const hint = el('span.muted', GAME_HINT[p.sub] || '');
  const card = post('game', p, ctx, { media, caption: capt('arcade', `${p.title} · `, hint), mediaInteractive: true });
  let g = null, idle;
  const Cls = GAMES[p.sub] || GAMES.plinko;
  const ensure = () => {
    if (g) return g;
    g = new Cls(canvas, p);
    card._game = g;
    g.onHud = (s) => { if (score.textContent !== s) score.textContent = s; };
    for (const m of g.modLabels()) hud.append(el('span.pill.mod', m));
    return g;
  };
  const setPlaying = (on) => {
    ensure().setAuto(!on);
    stage.classList.toggle('playing', on);
    mode.textContent = on ? 'YOU' : 'AUTO';
    mode.className = `pill ${on ? 'live' : 'auto'}`;
    hint.textContent = on ? `${GAME_HINT[p.sub] || ''} · scroll from outside the game` : GAME_HINT[p.sub] || '';
    if (on && !g.running) g.start();
    bump();
  };
  const bump = () => { clearTimeout(idle); idle = setTimeout(() => { if (!g?.auto) setPlaying(false); }, 25000); };
  stage.addEventListener('click', (e) => { if (!g || g.auto) { setPlaying(true); const q = g.local(e); g.tap(q.x, q.y); } });
  canvas.addEventListener('pointerdown', (e) => { if (!g || g.auto) return; canvas.setPointerCapture(e.pointerId); const q = g.local(e); g.pointer.down = true; g.down(q.x, q.y, e.pointerId); bump(); });
  canvas.addEventListener('pointermove', (e) => { if (!g || g.auto) return; const q = g.local(e); g.move(q.x, q.y, e.pointerId); });
  canvas.addEventListener('pointerup', (e) => { if (!g || g.auto) return; const q = g.local(e); g.pointer.down = false; g.up(q.x, q.y, e.pointerId); });
  canvas.addEventListener('pointercancel', (e) => { if (!g || g.auto) return; const q = g.local(e); g.pointer.down = false; g.up(q.x, q.y, e.pointerId); });
  autobtn.onclick = (e) => { e.stopPropagation(); setPlaying(false); };
  card._activate = () => { ensure(); if (settings.autopilot || !g.auto) g.start(); else { g.resize(); g.frame(performance.now()); } };
  card._deactivate = () => { g?.stop(); };
  card._heavy = true;
  return card;
}

// ------------------------------------------------ psychedelic
function psych(p, ctx) {
  const canvas = el('canvas');
  const stage = el('div.stage', canvas, el('div.quote', `“${p.quote.replace(/^["“]|["”]$/g, '')}”`, p.author ? el('small', `— ${p.author}`) : null));
  const media = el('div.media', stage);
  const card = post('psych', p, ctx, { media, caption: capt('the.trip', el('span.muted', 'tap twice to keep it · tap and hold to save')) });
  let fx = null;
  card._activate = () => { fx ||= new Psych(canvas, p, settings); fx.start(); };
  card._deactivate = () => fx?.stop();
  card._heavy = true;
  return card;
}

// ------------------------------------------------ memes (drawn on a canvas, so saving gets exactly this)
function meme(p, ctx) {
  const cv = el('canvas', { style: { width: '100%', display: 'block', background: '#0b0908' } });
  cv.width = 720; cv.height = 560;
  const media = el('div.media', cv);
  let drawn = false;
  const card = post('meme', p, ctx, { media, ext: p.wiki || p.link, caption: p.style === 'kym' ? capt('knowyourmeme', p.title) : p.ref ? capt(handleFor(p, ctx)[0], el('span.muted', `re: ${p.ref}`)) : null, metaLine: p.credit });
  // render when the post comes into view
  card._activate = () => { if (drawn) return; drawn = true; renderMeme(p, cv).catch(() => {}); };
  card._heavy = true;
  return card;
}

// ------------------------------------------------ products
const CART = ['Your cart is now in a superposition.', 'Added to a cart that does not exist.', 'Order received. It will arrive yesterday.', 'Thank you. Your call is important to the void.', 'Out of stock in this timeline.', 'Shipping to your astral address.', 'Payment accepted: one (1) daydream.'];
function product(p, ctx) {
  const art = el('div', { html: productSVG(p) }).firstElementChild;
  const media = el('div.media', art);
  const body = el('div.pbody',
    el('div.shop', el('div', el('b', p.name), el('small', p.price)), el('button.buy', { onclick: (e) => { e.stopPropagation(); toast(CART[Math.floor(Math.random() * CART.length)]); } }, 'Shop now')));
  const caption = el('div.pbody', el('div.tag', p.tagline), el('p', p.desc), el('ul', p.features.map((f) => el('li', f))), el('div', { style: { fontSize: '11px', color: 'var(--faint)' } }, p.disclaimer));
  return post('product', p, ctx, { media, body, caption });
}

// ------------------------------------------------ self care
const BREATH = { box: [['in', 4], ['hold', 4], ['out', 4], ['hold', 4]], 478: [['in', 4], ['hold', 7], ['out', 8]], coherent: [['in', 5], ['out', 5]], sigh: [['in', 2], ['in more', 1], ['out', 6]] };
let audioCtx;
function chime() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 783.99, 1046.5].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.type = 'sine';
      const t = audioCtx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 1.3);
    });
  } catch { /* no audio */ }
}
function selfcare(p, ctx) {
  const row = el('div.row');
  const sc = el('div.sc', el('div.sc-title', p.title), el('div.sc-text', p.text), row);
  sc.style.setProperty('--h', p.hue ?? 30);
  const done = el('button.btn', { onclick: (e) => { e.stopPropagation(); stats.selfcareDone(); done.textContent = 'Nice ✓'; done.disabled = true; toast('Logged. Proud of you.'); } }, 'Did it ✓');
  const card = post('selfcare', p, ctx, { body: sc });
  if (p.kind === 'timer') {
    const cd = el('span.countdown', fmtDur(p.dur));
    let iv;
    const start = el('button.btn.primary', {
      onclick: (e) => {
        e.stopPropagation();
        if (iv) { clearInterval(iv); iv = null; start.textContent = 'Resume'; return; }
        const end = Date.now() + (cd._left ?? p.dur) * 1000;
        start.textContent = 'Pause';
        iv = setInterval(() => {
          const left = Math.max(0, Math.round((end - Date.now()) / 1000));
          cd._left = left; cd.textContent = fmtDur(left);
          if (!left) { clearInterval(iv); iv = null; chime(); stats.selfcareDone(); start.textContent = 'Done ✓'; start.disabled = true; toast('Time! Welcome back.'); }
        }, 250);
      }
    }, `Start ${fmtDur(p.dur, true)}`);
    row.append(cd, start);
  } else if (p.kind === 'breathe') {
    const ball = el('div.ball'), lbl = el('div.lbl', 'tap start');
    sc.insertBefore(el('div.breath', ball, lbl), row);
    let running = false;
    const startB = el('button.btn.primary', {
      onclick: async (e) => {
        e.stopPropagation();
        if (running) return;
        running = true; startB.disabled = true;
        const seq = BREATH[p.pattern] || BREATH.box;
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
  return card;
}

// ------------------------------------------------ web: link previews and comics
function web(p, ctx) {
  if (p.sub === 'comic') return comic(p, ctx);
  const lc = el('a.linkcard', { href: p.url, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() });
  if (p.thumb) { const img = el('img', { alt: '', loading: 'lazy' }); setImg(img, p.thumb, () => img.remove()); lc.append(img); }
  lc.append(el('div.lc-body', el('div.lc-src', p.source || p.sub), el('h3', p.title), p.excerpt ? el('div.ex', p.excerpt) : null));
  const metaBits = [p.meta, p.discuss && p.discuss !== p.url ? 'tap ⋯ for comments' : null].filter(Boolean).join(' · ');
  const card = post('web', p, ctx, { body: lc, ext: p.url, metaLine: metaBits || null });
  if (p.discuss && p.discuss !== p.url) card.querySelector('.meta-line')?.addEventListener('click', () => window.open(p.discuss, '_blank'));
  return card;
}
function comic(p, ctx) {
  const img = el('img', { alt: p.title, loading: 'lazy' });
  const media = el('div.media', img);
  setImg(img, p.img, () => { img.remove(); media.prepend(el('div.noimg', '✎')); });
  if (p.nsfw && settings.blurNsfw) {
    const veil = el('div.nsfw-veil', 'Adult comic · tap to show');
    veil.onclick = (e) => { e.stopPropagation(); veil.remove(); };
    media.append(veil);
  }
  return post('comic', p, ctx, { media, ext: p.url, caption: capt(handleFor(p, ctx)[0], p.title, p.excerpt ? el('div.muted', { style: { marginTop: '4px' } }, p.excerpt) : null), metaLine: p.date || null });
}

// ------------------------------------------------ oracle and power scale
function oracle(p, ctx) {
  const o = oracleMedia(p);
  const card = post('oracle', p, ctx, { media: o.media, body: o.body, mediaInteractive: true });
  card._activate = o.activate; card._deactivate = o.deactivate; card._heavy = true;
  return card;
}
function power(p, ctx) {
  const card = post('power', p, ctx, { body: powerBody(p), ext: p.sub === 'versus' ? p.a.url : p.ents?.[0]?.url });
  card._activate = () => card.classList.add('shown');
  return card;
}

// ------------------------------------------------ special
export function notice(title, text, buttons = []) {
  return el('article.notice', el('h3', title), el('p', text), el('div.btnrow', { style: { justifyContent: 'center' } }, buttons));
}

const RENDER = { wiki, video, game, psych, meme, product, selfcare, web, news: web, oracle, power };
export function renderCard(p, ctx) {
  const fn = RENDER[p.cat];
  if (!fn) return null;
  const card = fn(p, ctx);
  card.dataset.id = p.id;
  card.dataset.cat = p.cat;
  card._post = p;
  return card;
}
export { CAT_LABEL, MUTATORS };
