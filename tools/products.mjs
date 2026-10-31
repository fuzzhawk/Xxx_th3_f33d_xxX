// Package builder: products. Built from the helpers and state that build-package.mjs passes in.
export function productsBuilder(K) {
  const { hashStr, id, pick, productClassics, productParts, rand, seen, shuffle, want } = K;

  function buildProducts() {
    const P = productParts;
    const posts = [];
    const names = new Set();
    const STYLES = ['sunset', 'memphis', 'chrome', 'vhs', 'infomercial', 'blueprint'];
    const art = () => ({ style: pick(STYLES), seed: Math.floor(rand() * 2 ** 31) });
    for (const c of shuffle([...productClassics])) {
      if (posts.length >= want.product) break;
      if (seen.product.has(c.name)) continue;
      names.add(c.name);
      posts.push({ id: `pr${hashStr(c.name).toString(36)}`, cat: 'product', sub: 'classic', name: c.name, tagline: c.tagline, desc: c.desc, glyph: c.glyph,
        features: shuffle([...P.feature]).slice(0, 3), price: pick(P.price), disclaimer: pick(P.disclaimer), art: art() });
    }
    let guard = 0;
    while (posts.length < want.product && guard++ < 20000) {
      const [obj, glyph] = pick(P.object);
      const name = `The ${pick(P.prefix)}-${obj} ${pick(P.suffix)}`;
      if (names.has(name) || seen.product.has(name)) continue;
      names.add(name);
      const purpose = pick(P.purpose);
      posts.push({ id: `pr${hashStr(name).toString(36)}`, cat: 'product', sub: 'generated', name, tagline: pick(P.tagline), glyph,
        desc: `The ${obj.toLowerCase()} ${purpose}.`, features: shuffle([...P.feature]).slice(0, 3), price: pick(P.price), disclaimer: pick(P.disclaimer), art: art() });
    }
    return posts;
  }

  return { buildProducts };
}
