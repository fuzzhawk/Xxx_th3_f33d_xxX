// Package builder: power. Built from the helpers and state that build-package.mjs passes in.
export function powerBuilder(K) {
  const { OFFLINE, ROOT, cleanExtract, clip, extracts, fetchJSON, hashStr, id, path, pick, rand, readJSON, report, sleep, want, warn, wq } = K;

  // ------------------------------------------------------------------ absurd power scale
  async function buildPower() {
    const P = readJSON(path.join(ROOT, 'tools/data/power.json'));
    const all = Object.entries(P.entities).flatMap(([kind, ts]) => ts.map((t) => ({ t, kind })));
    const ents = new Map();
    if (OFFLINE) for (const e of all) ents.set(e.t, { t: e.t, k: e.kind, b: `${e.t} is a placeholder entry for offline testing.`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(e.t.replace(/ /g, '_'))}`, views: 500 + (hashStr(e.t) % 90000), len: 3000 + (hashStr(e.t) % 60000) });
    else {
      for (let i = 0; i < all.length; i += 20) {
        const batch = all.slice(i, i + 20);
        try {
          const j = await fetchJSON(wq({ action: 'query', prop: 'extracts|pageimages|info|pageviews', exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20', piprop: 'thumbnail', pithumbsize: '320', pilimit: '20', pvipdays: '30', inprop: 'url', redirects: '1', titles: batch.map((e) => e.t).join('|') }));
          const back = {};
          for (const n of j.query?.normalized || []) back[n.to] = n.from;
          for (const r of j.query?.redirects || []) back[r.to] = back[r.from] || r.from;
          for (const pg of j.query?.pages || []) {
            if (pg.missing || !pg.extract) continue;
            const orig = back[pg.title] || pg.title, e = batch.find((x) => x.t === orig) || batch.find((x) => x.t === pg.title);
            if (!e || ents.has(pg.title)) continue;
            const views = Object.values(pg.pageviews || {}).reduce((a, v) => a + (v || 0), 0);
            ents.set(pg.title, { t: pg.title, k: e.kind, b: clip(cleanExtract(pg.extract), 170), img: pg.thumbnail?.source, url: pg.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pg.title.replace(/ /g, '_'))}`, views, len: pg.length || 0 });
          }
        } catch (e) { warn(`power batch ${i}: ${e.message}`); }
        await sleep(80);
      }
    }
    const list = [...ents.values()];
    if (list.length < 8) { warn('power scale: too few entities'); return []; }
    // stats: two from real numbers (pageviews, article length), the rest are fate
    const statOf = (e) => {
      const h = hashStr(e.t), s = {};
      P.stats.forEach((name, k) => { s[name] = name === 'Lore' ? Math.min(10, Math.max(1, Math.round(Math.log10(e.len + 10) * 2.2 - 5))) : name === 'Cult following' ? Math.min(10, Math.max(1, Math.round(Math.log10(e.views + 10) * 1.9 - 2))) : 1 + ((h >>> (k * 3)) % 10); });
      return s;
    };
    for (const e of list) { e.s = statOf(e); e.pw = Math.round(Math.sqrt(e.views + 50) * Math.sqrt(e.len + 500) / 40 * (1 + (hashStr(e.t) % 13) / 4)); delete e.views; delete e.len; }
    const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
    const n = want.power || 0, posts = [];
    const TIER_TITLES = ['Official power ranking', 'Who would win in a pub', 'Strongest when wet', 'Most dangerous at a dinner party', 'Best to have in a lifeboat', 'Tier list of the unknowable', 'Ranked by how hard they are to explain to a customs officer', 'Most likely to survive the heat death of the universe', 'Who you’d want on a pub quiz team', 'Ranked by sheer audacity'];
    for (let i = 0; i < n; i++) {
      const seed = Math.floor(rand() * 2 ** 31), unit = pick(P.units);
      if (i % 10 < 7) {
        let a = pick(list), b = pick(list), g = 0;
        while ((b === a || (b.k === a.k && rand() < 0.7)) && g++ < 20) b = pick(list);
        const w = a.pw === b.pw ? (rand() < 0.5 ? 0 : 1) : a.pw > b.pw ? 0 : 1, win = [a, b][w], lose = [a, b][1 - w];
        const stat = Object.entries(win.s).sort((x, y) => (y[1] - lose.s[y[0]]) - (x[1] - lose.s[x[0]]))[0][0];
        posts.push({ id: `pw${seed.toString(36)}`, cat: 'power', sub: 'versus', seed, unit, a, b, winner: w, how: `${win.t} wins ${fill(pick(P.wins), { stat: stat.toLowerCase(), loser: lose.t })}.`, verdict: pick(P.verdicts) });
      } else {
        const picks = new Set(); while (picks.size < 6) picks.add(pick(list));
        const ranked = [...picks].sort((x, y) => y.pw - x.pw);
        posts.push({ id: `pt${seed.toString(36)}`, cat: 'power', sub: 'tier', seed, unit, title: pick(TIER_TITLES), ents: ranked, tiers: ['S', 'A', 'B', 'C', 'D', 'F'] });
      }
    }
    report.sources.power = list.length;
    return posts;
  }

  return { buildPower };
}
