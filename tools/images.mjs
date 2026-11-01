// Package builder: images. Background groups (clouds, landscapes, paintings) from Wikimedia
// Commons and the open-access APIs of the Art Institute of Chicago, the Cleveland Museum of
// Art and The Met, plus keyword tags and coarse groups for the sprite pool. Group
// definitions, word lists and limits live in tools/data/images.json.
import zlib from 'node:zlib';

export function imagesBuilder(K) {
  const { OFFLINE, ROOT, UA, clip, commonsSearch, config, fetchJSON, hasTransparentEdges, hashStr, id, log, mulberry32, path, pool, productParts, rand, readJSON, report, shuffle, sleep, stripTags, warn } = K;
  const D = readJSON(path.join(ROOT, 'tools/data/images.json'), null);
  if (!D) warn('images: tools/data/images.json is missing or invalid');
  const B = D?.backgrounds || { groups: [] }, S = D?.sprites || { groups: {}, order: [], stop: '', plural: {} };
  const licence = new RegExp(B.licence || 'public domain|cc0', 'i'), junk = new RegExp(B.reject || '^$', 'i');
  const RE = new Map(B.groups.map((g) => [g.id, g.reject ? new RegExp(g.reject, 'i') : null]));
  const fits = (w, h) => w > 0 && h > 0 && w / h >= B.aspect[0] && w / h <= B.aspect[1];
  const rejected = (g, text, more = '') => junk.test(text) || !!RE.get(g.id)?.test(`${text} ${more}`);
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const plain = (s, n) => clip(stripTags(String(s || '')), n);
  const title = (t, date) => clip(`${t || 'Untitled'}${date ? ` (${date})` : ''}`, 90);

  // ---------------------------------------------------------------- sources: each returns vetted [{ src, w, h, title, credit, link, by }]
  // with .raw = results seen and .why = { reason: count } for the ones turned down
  const CATS = { fp: 'Featured_pictures_on_Wikimedia_Commons', qi: 'Quality_images' }, samples = [];
  const tally = (why, k) => { why[k] = (why[k] || 0) + 1; };
  async function commons(s, g) {
    const q = [s.commons, s.in && `incategory:${s.in.split('|').map((c) => CATS[c] || c.replace(/ /g, '_')).join('|')}`,
      ...(s.not || '').split(/\s+/).filter(Boolean).map((w) => `-${w}`), 'filetype:bitmap'].filter(Boolean).join(' ');
    // same request shape as the builder's other Commons searches
    const p = { action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: String(s.n || 40), gsrsort: s.sort || 'random', prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime', iiurlwidth: String(B.width), format: 'json', formatversion: '2' };
    const api = () => fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams(p)}`, { timeout: 40000 });
    let j = await api();
    if (j.error && p.gsrsort) { delete p.gsrsort; j = await api(); }
    if (j.error) throw new Error(j.error.info || j.error.code);
    const pages = j.query?.pages || [], out = [], why = {};
    for (const pg of pages) {
      const ii = pg.imageinfo?.[0] || {}, m = ii.extmetadata || {}, lic = stripTags(String(m.LicenseShortName?.value || m.License?.value || ''));
      const src = ii.thumburl || ii.url || '', w = +ii.thumbwidth || +ii.width, h = +ii.thumbheight || +ii.height;
      const file = String(pg.title || '').replace(/^File:/, '').replace(/\.\w+$/, ''), name = stripTags(String(m.ObjectName?.value || '')) || file;
      const no = !src || /\.(tiff?|svg|pdf|djvu|gif|webm|ogv|ogg)$/i.test(src.split('?')[0]) ? 'thumb' : !(+ii.width >= B.minWidth) ? 'small' : !fits(w, h) ? 'shape'
        : !licence.test(lic) ? 'licence' : rejected(g, `${name} ${file}`, stripTags(String(m.Categories?.value || ''))) ? 'reject' : '';
      if (no) {
        tally(why, no);
        if (samples.length < 6 && !samples.some((x) => x.g === g.id)) samples.push({ g: g.id, no, t: file.slice(0, 60), u: src.slice(-50), mime: ii.mime, w: ii.width, h: ii.height, lic: lic.slice(0, 30), keys: Object.keys(ii).join(',').slice(0, 120) });
        continue;
      }
      const by = plain(m.Artist?.value || 'Unknown', 40);
      out.push({ src, w, h, title: title(name), credit: `${by} · ${lic} · Wikimedia Commons`, link: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(pg.title).replace(/ /g, '_'))}`, by });
    }
    return Object.assign(out, { raw: pages.length, why });
  }

  // Elasticsearch query as bracketed query-string params (GET), e.g. query[function_score][boost_mode]=replace
  const flat = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const key = pre ? `${pre}[${k}]` : k; if (v && typeof v === 'object') flat(v, key, out); else out[key] = String(v); } return out; };
  async function aic(s, g) {
    // long artist lists go in chunks of five (a ten-name query was refused with 403); each chunk is retried once
    const names = s.aic || [], chunks = names.length ? Array.from({ length: Math.ceil(names.length / 5) }, (_, k) => names.slice(k * 5, k * 5 + 5)) : [[]];
    const fields = 'id,title,image_id,artist_title,date_display,thumbnail,artwork_type_title,is_public_domain', data = [], why = {}, out = [];
    let iiif = 'https://www.artic.edu/iiif/2', fails = 0;
    for (const [k, list] of chunks.entries()) {
      const filter = [{ term: { is_public_domain: true } }, { exists: { field: 'image_id' } }, ...(s.type ? [{ term: { artwork_type_id: s.type } }] : [])];
      const must = [...(list.length ? [{ bool: { should: list.map((a) => ({ match_phrase: { artist_title: a } })), minimum_should_match: 1 } }] : []),
        ...(s.words ? [{ multi_match: { query: s.words, fields: ['title', 'term_titles'] } }] : [])];
      // random order, seeded by the package, so each week draws a different set
      const query = { function_score: { query: { bool: { filter, must } }, random_score: { seed: hashStr(`${id}/${g.id}/${k}`) % 1e9, field: 'id' }, boost_mode: 'replace' } };
      const url = `https://api.artic.edu/api/v1/artworks/search?${new URLSearchParams({ boost: 'false', limit: String(Math.ceil((s.n || 60) / chunks.length)), fields, ...flat({ query }) })}`;
      for (let t = 0; ; t++) {
        try { const j = await fetchJSON(url, { headers: { 'AIC-User-Agent': UA }, timeout: 30000 }); iiif = j.config?.iiif_url || iiif; data.push(...(j.data || [])); break; }
        catch (e) { if (t) { if (++fails === chunks.length) throw e; break; } await sleep(2500); }
      }
    }
    for (const a of data) {
      const t = a.thumbnail;
      const no = !a.is_public_domain || !a.image_id || !t ? 'licence' : !(t.width >= 843) ? 'small' : !fits(t.width, t.height) ? 'shape'
        : s.types && !s.types.includes(a.artwork_type_title) ? 'type' : rejected(g, a.title || '') ? 'reject' : '';
      if (no) { tally(why, no); continue; }
      const by = a.artist_title || 'Unknown';
      out.push({ src: `${iiif}/${a.image_id}/full/843,/0/default.jpg`, w: 843, h: Math.round(843 * t.height / t.width), title: title(a.title, a.date_display), credit: `${by} · Public domain · Art Institute of Chicago`, link: `https://www.artic.edu/artworks/${a.id}`, by });
    }
    return Object.assign(out, { raw: data.length, why });
  }

  async function cma(s, g) {
    const p = new URLSearchParams({ q: s.cma, cc0: '1', has_image: '1', limit: String(s.n || 60) });
    if (s.type) p.set('type', s.type);
    if (s.dept) p.set('department', s.dept);
    const j = await fetchJSON(`https://openaccess-api.clevelandart.org/api/artworks/?${p}`, { timeout: 40000 });
    const data = j.data || [], out = [], why = {};
    for (const a of data) {
      const im = a.images?.web, w = +im?.width, h = +im?.height;
      const no = !im?.url ? 'image' : a.share_license_status !== 'CC0' ? 'licence' : !fits(w, h) ? 'shape' : rejected(g, a.title || '') ? 'reject' : '';
      if (no) { tally(why, no); continue; }
      const by = (a.creators?.[0]?.description || 'Unknown').replace(/\s*\(.*$/, '');
      out.push({ src: im.url, w, h, title: title(a.title, a.creation_date), credit: `${by} · CC0 · Cleveland Museum of Art`, link: a.url || `https://clevelandart.org/art/${a.accession_number}`, by });
    }
    return Object.assign(out, { raw: data.length, why });
  }

  async function met(s, g) {
    // v1/search now answers 410 Gone; v1.1/search takes the same filters (plus limit), objects stay on v1
    const base = 'https://collectionapi.metmuseum.org/public/collection', p = new URLSearchParams({ hasImages: 'true', isPublicDomain: 'true' });
    if (s.artist) p.set('artistOrCulture', 'true');
    if (s.dept) p.set('departmentId', String(s.dept));
    if (s.medium) p.set('medium', s.medium);
    p.set('q', s.met);
    let j;
    try { j = await fetchJSON(`${base}/v1.1/search?${p}&limit=300`, { timeout: 30000, retries: 1 }); }
    catch (e) { if (e.status !== 404 && e.status !== 410 && e.status !== 400) throw e; j = await fetchJSON(`${base}/v1/search?${p}`, { timeout: 30000, retries: 1 }); }
    const ids = shuffle((j.objectIDs || []).slice(0, 300)).slice(0, s.n || 12);
    const objs = await pool(ids, 3, (oid) => fetchJSON(`${base}/v1/objects/${oid}`, { retries: 1, timeout: 15000 }));
    const out = [], why = {};
    for (const o of objs) {
      // no pixel size in the record: take the shape from the work's size, "(73.7 x 92.1 cm)" is height × width
      const cm = /\(([\d.]+)\s*[x×]\s*([\d.]+)\s*cm\)/.exec(o?.dimensions || '');
      const no = !o ? 'fetch' : !o.isPublicDomain || !o.primaryImageSmall ? 'licence' : !cm || !fits(+cm[2], +cm[1]) ? 'shape' : rejected(g, o.title || '') ? 'reject' : '';
      if (no) { tally(why, no); continue; }
      const by = o.artistDisplayName || 'Unknown';
      out.push({ src: o.primaryImageSmall, w: 960, h: Math.round(960 * cm[1] / cm[2]), title: title(o.title, o.objectDate), credit: `${by} · Public domain · The Met`, link: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`, by });
    }
    return Object.assign(out, { raw: ids.length, why });
  }

  // ---------------------------------------------------------------- groups
  const SOURCES = { commons, aic, cma, met };
  async function buildGroup(g, taken) {
    const lists = [], notes = [];
    for (const [i, s] of g.src.entries()) {
      const kind = Object.keys(SOURCES).find((k) => k in s);
      if (!kind) continue;
      try {
        const got = await SOURCES[kind](s, g), why = Object.entries(got.why || {}).map(([k, v]) => `${k} ${v}`).join(' ');
        lists.push(shuffle([...got])); notes.push(`${kind} ${got.length}/${got.raw}${why ? ` [${why}]` : ''}`);
      }
      catch (e) { notes.push(`${kind} failed`); warn(`backgrounds ${g.id}: ${kind} source ${i + 1}: ${e.message}`); }
      await sleep(150);
    }
    // round-robin over the sources; no image twice in the package, at most `cap` per artist or photographer
    const imgs = [], per = new Map(), cap = g.cap || B.cap, max = g.max || B.max;
    for (let r = 0; imgs.length < max && lists.some((l) => r < l.length); r++) for (const l of lists) {
      const x = l[r];
      if (!x || imgs.length >= max) continue;
      const who = norm(x.by).replace(/[\d ]+$/, ''), key = `${norm(x.title)}|${who}`;
      if (taken.has(x.src) || taken.has(key) || (who && who !== 'unknown' && (per.get(who) || 0) >= cap)) continue;
      taken.add(x.src); taken.add(key); per.set(who, (per.get(who) || 0) + 1);
      imgs.push(x);
    }
    return { imgs, notes };
  }

  // [{ id, name, kind: 'cloud' | 'landscape' | 'painting', mood, hue, dark?, imgs: [{ src, w, h, title, credit, link }] }]
  async function buildBackgrounds() {
    if (OFFLINE) { report.sources.backgrounds = 'offline fixture'; return offlineBackgrounds(); }
    const taken = new Set(), out = [], per = {};
    const res = await pool(B.groups, 3, (g) => buildGroup(g, taken));
    B.groups.forEach((g, i) => {
      const { imgs = [], notes = ['failed'] } = res[i] || {};
      per[g.id] = `${imgs.length}: ${notes.join(', ')}`;
      if (imgs.length < B.keep) { warn(`backgrounds ${g.id}: only ${imgs.length} images, group dropped`); return; }
      out.push({ id: g.id, name: g.name, kind: g.kind, mood: g.mood, hue: g.hue, dark: g.dark || undefined, imgs: imgs.map(({ by, ...x }) => x) });
    });
    const n = out.reduce((a, g) => a + g.imgs.length, 0);
    report.sources.backgrounds = { groups: out.length, images: n, per, ...(samples.length ? { turnedDown: samples } : {}) };
    log(`backgrounds: ${out.length}/${B.groups.length} groups, ${n} images`);
    return out;
  }

  // ---------------------------------------------------------------- sprite tags and groups
  const STOP = new Set(S.stop.split(/\s+/)), ORDER = S.order, PLURAL = new Map(Object.entries(S.plural || {}));
  const one = (w) => PLURAL.get(w) || (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : /(ch|sh|ss|x|z)es$/.test(w) || /oes$/.test(w) ? w.slice(0, -2) : w.length > 3 && /[^siu]s$/.test(w) ? w.slice(0, -1) : w);
  const tokens = (s) => String(s || '').replace(/\.(png|svg|jpe?g|gif|tiff?|webp)$/i, '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').toLowerCase().split(/[^\p{L}]+/u).filter(Boolean).map(one);
  const LEX = new Map();
  for (const [grp, list] of Object.entries(S.groups)) for (const w of list.split(',')) { const t = tokens(w).join(' '); if (t) LEX.set(t, grp); }
  const PHRASES = [...LEX.keys()].filter((k) => k.includes(' '));
  // [[text, weight]] -> { tags, group }: phrases count double, ties go to the earlier group in S.order
  function classify(parts) {
    const score = new Map(), tags = [], add = (grp, n) => score.set(grp, (score.get(grp) || 0) + n);
    for (const [text, wt] of parts) {
      if (!text) continue;
      const tk = tokens(Array.isArray(text) ? text.join(' ') : text), seq = ` ${tk.join(' ')} `;
      for (const p of PHRASES) if (seq.includes(` ${p} `)) { tags.push(p); add(LEX.get(p), wt * 2); }
      for (const w of tk) if (w.length > 2 && !STOP.has(w)) { tags.push(w); if (LEX.has(w)) add(LEX.get(w), wt); }
    }
    const group = [...score.keys()].sort((a, b) => score.get(b) - score.get(a) || ORDER.indexOf(a) - ORDER.indexOf(b))[0] || 'object';
    return { tags: [...new Set(tags)], group };
  }
  // adds `tags` (lower-case keywords) and a coarse `group` (animal, plant, food, figure, vehicle, symbol, object…) to each sprite
  function tagSprites(sprites) {
    const qs = (config.spriteQueries || []).map((q) => [q, ` ${tokens(q).join(' ')} `]), count = {};
    for (const s of sprites || []) {
      // the search that found it, when the builder did not keep it
      const q = s.q || qs.find(([, t]) => ` ${tokens(s.name).join(' ')} `.includes(t))?.[0];
      const { tags, group } = classify([[q, 3], [s.name, 2], [s.cats, 1]]);
      s.tags = [...new Set([...(q ? [q.toLowerCase()] : []), ...tags, group])].slice(0, 16);
      s.group = group;
      count[group] = (count[group] || 0) + 1;
    }
    report.sources.spriteGroups = count;
    return sprites;
  }
  // indices of the sprites that best suit a text (a product name, say): shared tags, then the same group, then chance
  function matchSprites(text, sprites, n = 1, R = rand) {
    const want = new Set(tokens(text).filter((w) => !STOP.has(w))), { group } = classify([[text, 1]]);
    return (sprites || []).map((s, i) => [i, (s.tags || []).reduce((a, t) => a + (want.has(t) ? 4 : 0), 0) + (s.group === group ? 2 : 0) + R()])
      .sort((a, b) => b[1] - a[1]).slice(0, n).map(([i]) => i);
  }
  const spriteGroup = (text) => classify([[text, 1]]).group;

  // More cut-outs: one transparent PNG per made-up product object (and per extra query), small enough to embed
  async function moreSprites() {
    if (OFFLINE) return offlineSprites();
    const X = S.extra || {}, out = [];
    const qs = [...new Set([...(X.products ? (productParts?.object || []).map(([o]) => o.toLowerCase()) : []), ...(X.queries || [])])];
    await pool(qs, 3, async (q) => {
      try {
        let got = 0;
        // the plain word first, then e.g. "sock icon" (icons are more often clean cut-outs)
        for (const term of [q, ...(X.fallback ? [`${q} ${X.fallback}`] : [])]) for (const c of got >= (X.perQuery || 1) ? [] : (await commonsSearch(term, 'filemime:image/png', 10, X.width || 120)).slice(0, X.tries || 3)) {
          if (got >= (X.perQuery || 1)) break;
          const r = await fetch(c.ii.thumburl, { headers: { 'User-Agent': UA } });
          if (!r.ok) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 64 || buf.length > (X.maxBytes || 20000) || buf.readUInt32BE(0) !== 0x89504e47 || !hasTransparentEdges(buf)) continue;
          const m = c.ii.extmetadata || {};
          out.push({ src: `data:image/png;base64,${buf.toString('base64')}`, name: c.title.replace(/^File:/, ''), q, credit: `${plain(m.Artist?.value || 'Unknown', 40)} · ${m.LicenseShortName?.value} · Wikimedia Commons` });
          got++;
        }
      } catch (e) { warn(`more sprites ${q}: ${e.message}`); }
      await sleep(100);
    });
    report.sources.moreSprites = `${out.length}/${qs.length}`;
    return out;
  }

  // ---------------------------------------------------------------- offline fixtures: generated PNGs so the client can be tested without a network
  const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc32 = (b) => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  function pngURI(w, h, ch, px) {
    const row = w * ch, raw = Buffer.alloc((row + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (row + 1)] = 2; for (let i = 0; i < row; i++) raw[y * (row + 1) + 1 + i] = px[y * row + i] - (y ? px[(y - 1) * row + i] : 0); }
    const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
    const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = ch === 4 ? 6 : 2;
    return `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]).toString('base64')}`;
  }
  const hsl = (h, s, l) => { h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function fixtureImage(kind, k, hue) {
    const W = 240, H = 160, R = mulberry32(hashStr(`${kind}${k}`)), px = Buffer.alloc(W * H * 3);
    const blobs = Array.from({ length: 16 }, () => [R() * W, R() * H * 0.7, 12 + R() * 30]);
    const ridges = [0, 1, 2].map((i) => [H * (0.5 + i * 0.15), R() * 9, R() * 9, 0.008 + R() * 0.01, 0.03 + R() * 0.03]);
    const sun = [W * (0.2 + R() * 0.6), H * (0.2 + R() * 0.2), 9 + R() * 9];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = hsl(hue, 55, 22 + 50 * y / H);
      if (kind === 'cloud') {
        let d = 0;
        for (const [bx, by, r] of blobs) d += Math.max(0, 1 - Math.hypot(x - bx, (y - by) * 1.6) / r);
        const a = Math.min(1, d * 0.9), wc = hsl(hue + 15, 25, 92 - 22 * y / H);
        c = c.map((v, i) => v + (wc[i] - v) * a);
      } else {
        if (Math.hypot(x - sun[0], y - sun[1]) < sun[2]) c = hsl(45, 90, 78);
        ridges.forEach(([base, a1, a2, f1, f2], i) => { if (y > base + Math.sin(x * f1 + a1) * 18 + Math.sin(x * f2 + a2) * 6) c = hsl(hue + 40 + i * 20, 25 + i * 12, 50 - i * 14); });
      }
      if (kind === 'painting') c = c.map((v) => Math.min(255, Math.floor((v / 255) * 5 + BAYER[(y & 3) * 4 + (x & 3)] / 16) * 51));
      px.set(c.map((v) => Math.round(v)), (y * W + x) * 3);
    }
    return pngURI(W, H, 3, px);
  }
  function offlineBackgrounds() {
    return [['off-sky', 'Offline Skies', 'cloud', 'bright', 205], ['off-hills', 'Offline Hills', 'landscape', 'fresh', 150], ['off-oils', 'Offline Oils', 'painting', 'warm', 30]]
      .map(([gid, name, kind, mood, hue]) => ({ id: gid, name, kind, mood, hue, imgs: Array.from({ length: 4 }, (_, k) => ({ src: fixtureImage(kind, k, hue + k * 25), w: 240, h: 160, title: `${name} ${k + 1}`, credit: 'Generated offline fixture', link: '' })) }));
  }
  function offlineSprites() {
    const N = 64, star = (x, y) => Math.hypot(x, y) < 0.42 + 0.42 * Math.abs(Math.cos(2.5 * Math.atan2(y, x))) ** 3;
    const shapes = {
      banana: [[50, 90, 60], (x, y) => Math.hypot(x, y) < 0.8 && Math.hypot(x - 0.25, y + 0.25) > 0.7], moon: [[55, 25, 85], (x, y) => Math.hypot(x, y) < 0.8 && Math.hypot(x - 0.35, y) > 0.65],
      egg: [[40, 35, 90], (x, y) => (x / 0.6) ** 2 + (y / (y < 0 ? 0.85 : 0.72)) ** 2 < 1], ball: [[355, 80, 52], (x, y) => Math.hypot(x, y) < 0.75],
      leaf: [[110, 60, 38], (x, y) => ((x + y) / 1.2) ** 2 + ((x - y) / 0.6) ** 2 < 1], star: [[48, 95, 55], star]
    };
    return Object.entries(shapes).map(([name, [col, inside]]) => {
      const px = Buffer.alloc(N * N * 4), rgb = hsl(...col);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside((x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1)) px.set([...rgb, 255], (y * N + x) * 4);
      return { src: pngURI(N, N, 4, px), name: `${name} (offline).png`, q: name, credit: 'Generated offline fixture' };
    });
  }

  return { buildBackgrounds, tagSprites, matchSprites, spriteGroup, moreSprites };
}
