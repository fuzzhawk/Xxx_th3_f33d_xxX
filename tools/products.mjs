// Package builder: products. Built from the helpers and state that build-package.mjs passes in.
export function productsBuilder(K) {
  const { hashStr, id, pick, productClassics, productParts, rand, seen, shuffle, want } = K;

  function buildProducts(sprites = []) {
    const P = productParts;
    const posts = [];
    const names = new Set();
    const STYLES = ['sunset', 'memphis', 'chrome', 'vhs', 'infomercial', 'blueprint'];
    // 2-4 PNGs that relate to the product's name and object; one weaker pick is allowed to be random
    const imgsFor = (text) => {
      if (!sprites?.length || !K.matchSprites) return undefined;
      const n = 2 + Math.floor(rand() * 3), ix = K.matchSprites(text, sprites, n + 2), out = [];
      for (const i of ix) if (sprites[i]?.src && !out.includes(sprites[i].src)) out.push(sprites[i].src);
      if (out.length > n) out.length = n;
      if (out.length > 2 && rand() < 0.3) { const r = sprites[Math.floor(rand() * sprites.length)]?.src; if (r && !out.includes(r)) out[out.length - 1] = r; }
      return out.length >= 2 ? out : undefined;
    };
    const art = () => ({ style: pick(STYLES), seed: Math.floor(rand() * 2 ** 31) });
    for (const c of shuffle([...productClassics])) {
      if (posts.length >= want.product) break;
      if (seen.product.has(c.name)) continue;
      names.add(c.name);
      posts.push({ id: `pr${hashStr(c.name).toString(36)}`, cat: 'product', sub: 'classic', name: c.name, tagline: c.tagline, desc: c.desc, glyph: c.glyph,
        features: shuffle([...P.feature]).slice(0, 3), price: pick(P.price), disclaimer: pick(P.disclaimer), art: art(), imgs: imgsFor(`${c.name} ${c.desc} ${c.glyph}`) });
    }
    let guard = 0;
    while (posts.length < want.product && guard++ < 20000) {
      const [obj, glyph] = pick(P.object);
      const name = `The ${pick(P.prefix)}-${obj} ${pick(P.suffix)}`;
      if (names.has(name) || seen.product.has(name)) continue;
      names.add(name);
      const purpose = pick(P.purpose);
      posts.push({ id: `pr${hashStr(name).toString(36)}`, cat: 'product', sub: 'generated', name, tagline: pick(P.tagline), glyph,
        desc: `The ${obj.toLowerCase()} ${purpose}.`, features: shuffle([...P.feature]).slice(0, 3), price: pick(P.price), disclaimer: pick(P.disclaimer), art: art(), imgs: imgsFor(`${obj} ${name} ${purpose}`) });
    }
    for (const p of posts) if (!p.imgs) delete p.imgs;
    return posts;
  }

  return { buildProducts };
}
