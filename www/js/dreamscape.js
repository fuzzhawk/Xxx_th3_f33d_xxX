// Other worlds, flown through: the world each other.worlds card describes, built in 3D and flown
// over at dusk. The words pick the pieces:
//   star    a big dim red dwarf, twin suns (gold and blue), a tiny white dwarf, a calm orange sun,
//           a pulsar sweeping its beams round like a lighthouse, a young blue star in its dust
//   sky     violet by day, green at the horizon and black overhead, the ring of a broken moon,
//           drifting islands, a sun stuck on the horizon, three moons
//   land    mushroom spires, a canyon of singing crystal the camera flies down, a shallow sea,
//           red mesas with long shadows, coral cities with lit windows, dunes of glass that glint
//   people  beings who talk in rings of colour, sky whales singing, a mind in the moss (light running
//           through it), sleepers in glowing pods, librarians' towers with books flying round them,
//           robots tending gardens in ruins, a lantern caravan, little glowing children on the peaks
//   custom  trees, dream bubbles, lanterns rising, ribbons of song, an eclipse, gates to fly
//           through, or nothing at all (silence)
// The camera swoops along a loop over the land, banking on the turns and turning now and then to
// look at something. One small WebGL renderer serves every card (as Outland does); each card's
// scene is built when it scrolls in and dropped when it leaves.
import { mulberry32 } from './util.js';

let T = null, loading = null;
const loadThree = () => (loading ||= import('./vendor/three.module.min.js').then((m) => { T = m; return m; }));
const RW = 280, RH = 224;
let R = null;
function renderer() {
  if (R && !R.lost) return R;
  const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'low-power' });
  r.setPixelRatio(1); r.setSize(RW, RH, false);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r.lost = true; });
  R = r; return r;
}
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the words on the card, in order (mindful.js picks one of each)
export const WORLD_KEYS = {
  star: ['red', 'twin', 'white', 'orange', 'pulsar', 'blue'],
  sky: ['violet', 'green', 'ring', 'islands', 'twilight', 'moons'],
  land: ['spires', 'crystal', 'sea', 'mesas', 'domes', 'dunes'],
  people: ['colours', 'drifters', 'moss', 'sleepers', 'librarians', 'robots', 'travellers', 'children'],
  custom: ['trees', 'dream', 'night', 'songs', 'eclipse', 'names', 'silence']
};
const STARS = {
  red: { suns: [{ col: '#ff5a3a', size: 150 }], light: 0.9, el: 0.22 },
  twin: { suns: [{ col: '#ffd070', size: 70 }, { col: '#7fb0ff', size: 48, da: 0.5, de: 0.12 }], light: 1.1, el: 0.32 },
  white: { suns: [{ col: '#f0f6ff', size: 26 }], light: 1.3, el: 0.42 },
  orange: { suns: [{ col: '#ffa050', size: 90 }], light: 1.15, el: 0.3 },
  pulsar: { suns: [{ col: '#c8e4ff', size: 24 }], light: 0.8, el: 0.38, beams: true },
  blue: { suns: [{ col: '#7aa8ff', size: 70 }], light: 1.15, el: 0.34, dust: true }
};
const SKYS = {
  violet: { zen: '#3a1868', hor: '#c49ae8', stars: 0.12, day: 1.35 },
  green: { zen: '#020308', hor: '#46c88a', stars: 1, day: 0.9 },
  ring: { zen: '#0e1430', hor: '#c88a70', stars: 0.8, day: 1 },
  islands: { zen: '#1c2c5a', hor: '#e8a888', stars: 0.45, day: 1.1 },
  twilight: { zen: '#1a1240', hor: '#f0907a', stars: 0.6, day: 0.9, el: 0.035 },
  moons: { zen: '#0a1428', hor: '#7088b8', stars: 1, day: 0.95 }
};
const LANDS = {
  spires: { low: '#22301f', high: '#4e6a44', fog: 0.0032, clear: 16 },
  crystal: { low: '#2e2638', high: '#7a6a88', fog: 0.0028, clear: 13 },
  sea: { low: '#b8a070', high: '#d8c49a', fog: 0.0022, clear: 7, water: '#2f7a96' },
  mesas: { low: '#8a3a22', high: '#c8704a', fog: 0.0019, clear: 20 },
  domes: { low: '#2a2836', high: '#5a4a5e', fog: 0.003, clear: 15 },
  dunes: { low: '#7ab4b8', high: '#e4fbf4', fog: 0.0024, clear: 9 }
};

// shared little textures: a soft glow, and a cloud of dust
let GLOW = null, CLOUD = null, BOOKS = null;
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,.75)'); g.addColorStop(0.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (GLOW = new T.CanvasTexture(c));
}
function cloudTex() {
  if (CLOUD) return CLOUD;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), Rn = mulberry32(77);
  for (let i = 0; i < 60; i++) { const px = 64 + (Rn() - 0.5) * 80, py = 64 + (Rn() - 0.5) * 80, r = 10 + Rn() * 26, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  return (CLOUD = new T.CanvasTexture(c));
}
function booksTex() {
  if (BOOKS) return BOOKS;
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const x = c.getContext('2d'), Rn = mulberry32(5);
  x.fillStyle = '#2a1a14'; x.fillRect(0, 0, 32, 128);
  for (let row = 0; row < 16; row++) for (let px = 1; px < 31;) { const w = 1 + Math.floor(Rn() * 3); x.fillStyle = `hsl(${Math.floor(Rn() * 360)},${30 + Rn() * 30}%,${25 + Rn() * 30}%)`; x.fillRect(px, row * 8 + 1, w, 6); px += w + (Rn() < 0.2 ? 1 : 0); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.NearestFilter;
  return (BOOKS = t);
}

// value noise, seeded
function noise2(seed) {
  const h = (x, z) => { let q = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf), a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, z) => 0.5 * vn(x, z) + 0.3 * vn(x * 2.1, z * 2.1) + 0.2 * vn(x * 4.3, z * 4.3);
}

class Scape {
  constructor(seed, wd) {
    const Rn = (this.R = mulberry32(seed ^ 0x51ca)), rr = (this.rr = (a, b) => a + Rn() * (b - a));
    const K = WORLD_KEYS, w = (this.w = {
      star: wd?.star ?? K.star[Math.floor(Rn() * 6)], sky: wd?.sky ?? K.sky[Math.floor(Rn() * 6)], land: wd?.land ?? K.land[Math.floor(Rn() * 6)],
      people: wd?.people ?? K.people[Math.floor(Rn() * 8)], custom: wd?.custom ?? K.custom[Math.floor(Rn() * 7)]
    });
    const st = STARS[w.star], sk = SKYS[w.sky], ld = LANDS[w.land], C = (c) => new T.Color(c);
    this.st = st; this.sk = sk; this.ld = ld; this.anims = []; this.pois = []; this.disposables = [];
    const S = (this.scene = new T.Scene());
    this.fbm = noise2(seed);
    // colours: the sky's own, the star's light in its horizon and in the fog
    const sunCol = C(st.suns[0].col), hor = C(sk.hor).lerp(sunCol, 0.28), zen = C(sk.zen);
    this.hor = hor; this.sunCol = sunCol;
    S.fog = new T.FogExp2(hor.clone().multiplyScalar(0.62), ld.fog);
    this.cam = new T.PerspectiveCamera(64, RW / RH, 0.5, 1400);
    const sky = new T.SphereGeometry(900, 28, 14), col = [], pos = sky.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 900, k = Math.max(0, Math.min(1, y * 1.7 + 0.12)); const c = hor.clone().lerp(zen, k); col.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    S.add(new T.Mesh(sky, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })));
    if (sk.stars > 0.2) {
      const sp = []; for (let i = 0; i < 320; i++) { const a = Rn() * TAU, b = Rn() * 0.75 + 0.2, r = 820; sp.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
      S.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 * sk.stars })));
    }
    // the light: a hemisphere of sky and ground, and the sun(s)
    const el = sk.el ?? st.el, az = Rn() * TAU;
    this.sunDir = new T.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    this.hemi = new T.HemisphereLight(hor.clone().lerp(new T.Color('#ffffff'), 0.2), C(ld.low), 1.25 * sk.day); S.add(this.hemi);
    this.lights = [];
    st.suns.forEach((s, k) => {
      const d = k ? new T.Vector3(Math.cos(el + (s.de || 0)) * Math.cos(az + (s.da || 0)), Math.sin(el + (s.de || 0)), Math.cos(el + (s.de || 0)) * Math.sin(az + (s.da || 0))) : this.sunDir.clone();
      const L = new T.DirectionalLight(C(s.col), (k ? 0.7 : 1.5) * st.light); L.position.copy(d); S.add(L); this.lights.push(L);
      const p = d.clone().multiplyScalar(820);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: C(s.col), blending: T.AdditiveBlending, fog: false, depthWrite: false, transparent: true }));
      glow.position.copy(p); glow.scale.setScalar(s.size * 3.2); S.add(glow);
      const disc = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: C(s.col).lerp(new T.Color('#ffffff'), 0.6), fog: false, depthWrite: false, transparent: true }));
      disc.position.copy(p); disc.scale.setScalar(s.size); S.add(disc);
      if (!k) { this.sunPos = p; this.sunGlow = glow; this.sunDisc = disc; }
      this.pois.push(p.clone().multiplyScalar(0.5));
    });
    this.path();
    this.ground();
    this.starBits();
    this.skyBits();
    this.landBits();
    this.peopleBits();
    this.customBits();
    this.u = Rn(); this.t = 0; this.look = null; this.lookT = rr(6, 12); this.roll = 0;
  }
  // ------------------------------------------------ the flight: a loop over the land
  path() {
    const rr = this.rr, pts = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; pts.push(new T.Vector3(Math.cos(a) * rr(150, 230), 0, Math.sin(a) * rr(150, 230))); }
    this.curve = new T.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.len = this.curve.getLength();
    this.samples = Array.from({ length: 160 }, (_, k) => this.curve.getPointAt(k / 160));
  }
  dPath(x, z) { let d = 1e9; for (const p of this.samples) { const q = (p.x - x) ** 2 + (p.z - z) ** 2; if (q < d) d = q; } return Math.sqrt(d); }
  h(x, z) {
    const f = this.fbm(x * 0.012, z * 0.012), land = this.w.land;
    if (land === 'crystal') { const base = 58 + 16 * this.fbm(x * 0.02 + 5, z * 0.02), k = sstep(13, 46, this.dPath(x, z)); return -2 + 4 * f + (base - (-2 + 4 * f)) * k; }
    if (land === 'sea') return -5 + 7 * this.fbm(x * 0.008, z * 0.008) ** 2 * 1.8;
    if (land === 'mesas') return 3 * f;
    if (land === 'dunes') { const r = Math.abs(Math.sin(x * 0.022 + z * 0.006 + 3 * this.fbm(x * 0.004, z * 0.004))); return 13 * r ** 1.6 + 4 * f; }
    if (land === 'domes') return 5 * f;
    return 8 * f - 2;
  }
  ground() {
    const ld = this.ld, g = new T.PlaneGeometry(1500, 1500, 90, 90); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = [], lo = new T.Color(this.w.people === 'moss' ? '#1f3a1c' : ld.low), hi = new T.Color(this.w.people === 'moss' ? '#4a8a3c' : ld.high), c = new T.Color();
    let mn = 1e9, mx = -1e9;
    const ys = [];
    for (let i = 0; i < pos.count; i++) { const y = this.h(pos.getX(i), pos.getZ(i)); ys.push(y); mn = Math.min(mn, y); mx = Math.max(mx, y); }
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, ys[i]);
      let k = (ys[i] - mn) / (mx - mn || 1);
      if (this.w.land === 'crystal' || this.w.land === 'mesas') k = Math.floor(k * 7) / 7 + (this.R() - 0.5) * 0.05;   // strata
      c.copy(lo).lerp(hi, clamp(k + (this.R() - 0.5) * 0.12, 0, 1)); col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mat = this.w.land === 'dunes' ? new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 90, specular: new T.Color('#a0fff0') }) : new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.scene.add(new T.Mesh(g, mat));
    // the camera's height along the loop: clear of the ground under it and around it, smoothed
    const N = this.samples.length, H = this.samples.map((p) => { let m = -1e9; for (let a = 0; a < 6; a++) m = Math.max(m, this.h(p.x + Math.cos(a) * 7, p.z + Math.sin(a) * 7)); return Math.max(m, this.w.land === 'sea' ? 0 : -99) + ld.clear; });
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < N; i++) H[i] = Math.max(H[i], (H[(i + N - 1) % N] + H[i] * 2 + H[(i + 1) % N]) / 4);
    this.camH = H;
  }
  heightAt(u) { const N = this.camH.length, f = (((u % 1) + 1) % 1) * N, i = Math.floor(f), k = f - i; return this.camH[i % N] * (1 - k) + this.camH[(i + 1) % N] * k; }
  // somewhere beside the path, on the ground
  spot(dmin, dmax) {
    for (let t = 0; t < 60; t++) {
      const u = this.R(), p = this.curve.getPointAt(u), a = this.R() * TAU, d = this.rr(dmin, dmax), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (this.dPath(x, z) < dmin * 0.9) continue;
      return new T.Vector3(x, this.h(x, z), z);
    }
    return new T.Vector3(this.rr(-300, 300), 0, this.rr(-300, 300));
  }
  inst(geo, mat, list) {
    const m = new T.InstancedMesh(geo, mat, list.length), o = new T.Object3D(), c = new T.Color();
    list.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); o.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (it.col) m.setColorAt(i, c.set(it.col)); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.scene.add(m); return m;
  }
  sprite(col, size, pos, add = true) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: new T.Color(col), blending: add ? T.AdditiveBlending : T.NormalBlending, depthWrite: false, transparent: true }));
    s.position.copy(pos); s.scale.setScalar(size); this.scene.add(s); return s;
  }
  // ------------------------------------------------ the star
  starBits() {
    const st = this.st, S = this.scene;
    if (st.beams) {
      // the pulsar: two beams sweeping round, and a flash each time one passes over you
      const g = new T.Group(); g.position.copy(this.sunPos);
      const mat = new T.MeshBasicMaterial({ color: new T.Color('#c8e4ff'), transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide });
      for (const s of [-1, 1]) { const cone = new T.Mesh(new T.ConeGeometry(30, 900, 12, 1, true), mat); cone.position.y = s * 450; if (s > 0) cone.rotation.x = Math.PI; g.add(cone); }
      g.rotation.z = 0.5; S.add(g);
      const L = this.lights[0], base = L.intensity;
      this.anims.push((t) => { g.rotation.y = t * 1.6; const flash = Math.max(0, Math.cos(t * 1.6 * 2)) ** 24; L.intensity = base * (0.55 + 1.6 * flash); this.sunGlow.scale.setScalar(st.suns[0].size * (3 + 4 * flash)); });
    }
    if (st.dust) {
      // the young blue star in its dust: slow clouds lit from within
      for (let k = 0; k < 9; k++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex(), color: new T.Color(k % 2 ? '#6a7aff' : '#b070e0'), blending: T.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.55 }));
        const off = new T.Vector3(this.rr(-1, 1), this.rr(-0.6, 0.6), this.rr(-1, 1)).multiplyScalar(150);
        s.position.copy(this.sunPos).add(off); s.scale.setScalar(this.rr(260, 420)); S.add(s);
        const ph = this.R() * TAU; this.anims.push((t) => { s.material.rotation = t * 0.02 + ph; });
      }
    }
  }
  // ------------------------------------------------ the sky
  skyBits() {
    const w = this.w.sky, S = this.scene, rr = this.rr;
    if (w === 'ring') {
      // the ring of a broken moon, arcing across the sky, with the moon's pieces in it
      const ring = new T.Mesh(new T.RingGeometry(560, 650, 120, 1), new T.MeshBasicMaterial({ color: new T.Color('#e8d8c8'), transparent: true, opacity: 0.42, side: T.DoubleSide, fog: false, depthWrite: false }));
      ring.position.set(0, -140, 0); ring.rotation.x = -Math.PI / 2 + 0.62; ring.rotation.z = rr(0, TAU); S.add(ring);
      const bits = [], rock = new T.MeshLambertMaterial({ color: new T.Color('#9a9088'), flatShading: true, fog: false });
      for (let k = 0; k < 70; k++) { const a = this.R() * TAU, r = rr(570, 640), s = rr(2, 9); bits.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, sx: s, sy: s, sz: s, rx: rr(0, 3), ry: rr(0, 3) }); }
      const g = new T.Group(); g.position.copy(ring.position); g.rotation.copy(ring.rotation); g.rotation.x += Math.PI / 2; S.add(g);
      const m = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), rock, bits.length), o = new T.Object3D();
      bits.forEach((b, i) => { o.position.set(b.x, b.y, b.z); o.scale.setScalar(b.sx); o.rotation.set(b.rx, b.ry, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      g.add(m);
      const moon = new T.Mesh(new T.IcosahedronGeometry(40, 1), rock); moon.position.set(rr(-300, 300), 380, rr(-500, -300)); S.add(moon);
      this.pois.push(moon.position.clone().multiplyScalar(0.6));
      this.anims.push((t) => { g.rotation.z = ring.rotation.z + t * 0.004; moon.rotation.y = t * 0.03; });
    } else if (w === 'moons') {
      [['#e8e4f0', 34], ['#f0c8a0', 20], ['#a8d0f0', 12]].forEach(([c, r], k) => {
        const m = new T.Mesh(new T.SphereGeometry(r, 20, 14), new T.MeshLambertMaterial({ color: new T.Color(c), emissive: new T.Color(c).multiplyScalar(0.25), fog: false }));
        const a0 = rr(0, TAU), el = rr(0.25, 0.7), d = 700 - k * 40; S.add(m);
        this.anims.push((t) => { const a = a0 + t * 0.006 * (k + 1); m.position.set(Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(a) * Math.cos(el) * d); });
        this.pois.push(new T.Vector3(Math.cos(a0) * 300, Math.sin(el) * 300, Math.sin(a0) * 300));
      });
    } else if (w === 'islands') {
      const rock = new T.MeshLambertMaterial({ color: new T.Color('#4a3a48'), flatShading: true }), grass = new T.MeshLambertMaterial({ color: new T.Color('#5a7a5a'), flatShading: true });
      const g = new T.Group(); S.add(g);
      for (let k = 0; k < 22; k++) { const p = this.spot(30, 260); p.y = this.heightAt(0) + rr(45, 140); g.add(this.island(p, rr(6, 22), rock, grass)); if (k < 3) this.pois.push(p); }
      this.anims.push((t) => { g.rotation.y = t * 0.01; g.children.forEach((o) => { o.position.y = o.userData.y0 + Math.sin(t * 0.4 + o.userData.bob) * 2; }); });
    } else if (w === 'twilight') {
      this.sprite(this.hor.clone().lerp(this.sunCol, 0.6).getHex(), 900, this.sunPos.clone().multiplyScalar(0.95).setY(40));
    } else if (w === 'green') {
      // an aurora of green over the horizon
      const g = new T.PlaneGeometry(1600, 160, 60, 1), mat = new T.MeshBasicMaterial({ color: new T.Color('#6aff9a'), transparent: true, opacity: 0.16, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false });
      const m = new T.Mesh(g, mat); m.position.set(0, 220, -700); S.add(m);
      const p = g.attributes.position, x0 = Array.from({ length: p.count }, (_, i) => p.getZ(i));
      this.anims.push((t) => { for (let i = 0; i < p.count; i++) p.setZ(i, x0[i] + Math.sin(p.getX(i) * 0.006 + t * 0.3) * 80); p.needsUpdate = true; mat.opacity = 0.12 + 0.06 * Math.sin(t * 0.5); });
    }
  }
  island(at, size, rock, grass) {
    const g = new T.Group(), rr = this.rr;
    const under = new T.ConeGeometry(size, size * rr(1.6, 2.6), 9, 3), pos = under.attributes.position;
    for (let i = 0; i < pos.count; i++) { if (pos.getY(i) > size * 0.7) continue; pos.setX(i, pos.getX(i) * rr(0.8, 1.15)); pos.setZ(i, pos.getZ(i) * rr(0.8, 1.15)); }
    under.computeVertexNormals();
    const u = new T.Mesh(under, rock); u.rotation.x = Math.PI; g.add(u);
    const top = new T.Mesh(new T.CylinderGeometry(size * 1.02, size * 0.96, size * 0.25, 9), grass); top.position.y = size * 1.07; g.add(top);
    if (this.R() < 0.6) for (let k = 0; k < 2; k++) { const tr = new T.Mesh(new T.ConeGeometry(rr(1.5, 2.6), rr(5, 9), 6), grass); tr.position.set(rr(-size, size) * 0.5, size * 1.2 + 3.5, rr(-size, size) * 0.5); g.add(tr); }
    g.position.copy(at); g.rotation.y = this.R() * TAU;
    g.userData = { bob: this.R() * TAU, y0: at.y };
    return g;
  }
  // ------------------------------------------------ the land
  landBits() {
    const w = this.w.land, S = this.scene, rr = this.rr, R = this.R;
    if (w === 'spires') {
      // a forest of mushroom spires, caps glowing underneath, spores drifting up
      const stalks = [], caps = [[], [], []], hues = ['#ff70c0', '#70e0ff', '#ffd060'];
      for (let k = 0; k < 110; k++) { const p = this.spot(14, 200), h = rr(14, 58), r = rr(4, 13); stalks.push({ x: p.x, y: p.y + h / 2, z: p.z, sx: r * 0.14, sy: h, sz: r * 0.14, rz: rr(-0.08, 0.08) }); caps[k % 3].push({ x: p.x, y: p.y + h, z: p.z, sx: r, sy: r * rr(0.35, 0.6), sz: r, col: hues[k % 3] }); }
      this.inst(new T.CylinderGeometry(0.7, 1, 1, 6), new T.MeshLambertMaterial({ color: new T.Color('#d8d0c0'), flatShading: true }), stalks);
      caps.forEach((list, k) => { const m = this.inst(new T.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: new T.Color('#ffffff'), emissive: new T.Color(hues[k]).multiplyScalar(0.35), flatShading: true }), list); const ph = k * 2; this.anims.push((t) => { m.material.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 0.8 + ph); }); });
      this.motes('#ffe0f0', 260, 1.2, 0.8);
    } else if (w === 'crystal') {
      // the canyon of singing crystal: clusters on its walls and floor, ringing with light in turn
      const groups = [[], [], []], cols = ['#a0f0ff', '#e0a0ff', '#a0ffd0'];
      for (let k = 0; k < 90; k++) {
        const p = this.spot(9, k < 60 ? 46 : 160), n = 3 + Math.floor(R() * 4);
        for (let j = 0; j < n; j++) { const s = rr(2, 6), hh = rr(7, 24); groups[k % 3].push({ x: p.x + rr(-3, 3), y: p.y + hh * 0.3, z: p.z + rr(-3, 3), sx: s, sy: hh, sz: s, rx: rr(-0.5, 0.5), rz: rr(-0.5, 0.5), ry: rr(0, 3) }); }
        if (k % 20 === 0) this.pois.push(p);
      }
      groups.forEach((list, k) => {
        const mat = new T.MeshPhongMaterial({ color: new T.Color(cols[k]), emissive: new T.Color(cols[k]).multiplyScalar(0.3), shininess: 90, specular: new T.Color('#ffffff'), flatShading: true, transparent: true, opacity: 0.88 });
        this.inst(new T.OctahedronGeometry(0.5, 0), mat, list);
        this.anims.push((t) => { mat.emissiveIntensity = 0.6 + 1.4 * Math.max(0, Math.sin(t * 0.9 - k * 2.1)) ** 3; });
      });
      this.ripples(cols[0], 5);
    } else if (w === 'sea') {
      // one endless shallow ocean: waves, glitter on the water toward the sun, a few sandbars
      const g = new T.PlaneGeometry(1500, 1500, 64, 64); g.rotateX(-Math.PI / 2);
      const mat = new T.MeshPhongMaterial({ color: new T.Color(this.ld.water).lerp(this.hor, 0.2), specular: new T.Color(this.sunCol).lerp(new T.Color('#ffffff'), 0.4), shininess: 70, flatShading: true, transparent: true, opacity: 0.86 });
      const m = new T.Mesh(g, mat); S.add(m);
      const p = g.attributes.position;
      this.anims.push((t) => { for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 0.03 + t * 0.9) * 0.7 + Math.sin(z * 0.045 - t * 1.2) * 0.5 + Math.sin((x + z) * 0.02 + t * 0.5) * 0.6); } p.needsUpdate = true; });
      const gl = []; for (let k = 0; k < 220; k++) { const d = rr(40, 700), s = rr(-1, 1) * d * 0.25; gl.push(this.sunDir.x * d - this.sunDir.z * s, 0.8, this.sunDir.z * d + this.sunDir.x * s); }
      const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gl, 3));
      const pm = new T.PointsMaterial({ color: new T.Color(this.sunCol).lerp(new T.Color('#ffffff'), 0.6), size: 2, sizeAttenuation: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      S.add(new T.Points(gg, pm)); this.anims.push((t) => { pm.opacity = 0.5 + 0.4 * Math.sin(t * 7); });
    } else if (w === 'mesas') {
      // red mesas, terraced in strata, each with a long shadow away from the low sun
      const sh = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
      const flat = new T.Vector2(-this.sunDir.x, -this.sunDir.z).normalize(), tanE = Math.max(0.08, Math.tan(Math.asin(this.sunDir.y)));
      for (let k = 0; k < 16; k++) {
        const r = rr(14, 34), p = this.spot(r + 24, 320), h = rr(22, 62), g = new T.Group(), tiers = 3 + Math.floor(R() * 2);
        for (let j = 0; j < tiers; j++) { const hh = h / tiers, rt = r * (1 - j * 0.12), m = new T.Mesh(new T.CylinderGeometry(rt * 0.94, rt, hh, 8), new T.MeshLambertMaterial({ color: new T.Color(j % 2 ? '#b85a36' : '#d07848'), flatShading: true })); m.position.y = hh * (j + 0.5); g.add(m); }
        g.position.copy(p); g.rotation.y = R() * TAU; S.add(g);
        const L = Math.min(260, h / tanE), q = new T.Mesh(new T.PlaneGeometry(r * 1.8, L), sh); q.rotation.x = -Math.PI / 2; q.rotation.z = Math.atan2(flat.x, flat.y);
        q.position.set(p.x + flat.x * L / 2, p.y + 0.4, p.z + flat.y * L / 2); S.add(q);
        if (k < 3) this.pois.push(p.clone().setY(p.y + h));
      }
      this.motes('#ffb080', 120, 1.5, 0.3);
    } else if (w === 'domes') {
      // cities grown like coral: domes with lit windows and branching coral towers
      const corals = ['#ff8a70', '#ffb0d0', '#70d0c0', '#ffd080'], win = [];
      for (let k = 0; k < 9; k++) {
        const c = this.spot(42, 170);
        for (let j = 0; j < 3; j++) {
          const r = rr(6, 18), p = c.clone().add(new T.Vector3(rr(-25, 25), 0, rr(-25, 25))); p.y = this.h(p.x, p.z) - 1;
          const d = new T.Mesh(new T.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: new T.Color(corals[(k + j) % 4]).lerp(new T.Color('#ffffff'), 0.2), flatShading: true }));
          d.position.copy(p); S.add(d);
          for (let q = 0; q < 14; q++) { const a = R() * TAU, b = rr(0.1, 1.3); win.push(p.x + Math.cos(a) * Math.cos(b) * r * 1.01, p.y + Math.sin(b) * r * 1.01, p.z + Math.sin(a) * Math.cos(b) * r * 1.01); }
        }
        this.coral(c.clone().add(new T.Vector3(rr(-15, 15), 0, rr(-15, 15))), corals[k % 4], 3, rr(10, 18));
        if (k < 3) this.pois.push(c);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(win, 3));
      const pm = new T.PointsMaterial({ color: new T.Color('#ffe8a0'), size: 2, sizeAttenuation: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      S.add(new T.Points(g, pm)); this.anims.push((t) => { pm.opacity = 0.75 + 0.2 * Math.sin(t * 3); });
    } else if (w === 'dunes') {
      // dunes of glass: glints on the slopes, and sparkles carried on the wind
      const gl = [];
      for (let k = 0; k < 500; k++) { const x = rr(-500, 500), z = rr(-500, 500); gl.push(x, this.h(x, z) + 0.3, z); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(gl, 3));
      const mats = [0, 1].map(() => new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      const half = gl.length / 6 | 0;
      const g1 = new T.BufferGeometry(); g1.setAttribute('position', new T.Float32BufferAttribute(gl.slice(0, half * 3), 3));
      const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.Float32BufferAttribute(gl.slice(half * 3), 3));
      S.add(new T.Points(g1, mats[0]), new T.Points(g2, mats[1])); void g;
      this.anims.push((t) => { mats[0].opacity = Math.max(0, Math.sin(t * 2.3)) * 0.9; mats[1].opacity = Math.max(0, Math.sin(t * 2.3 + 2)) * 0.9; });
      this.motes('#d0fff8', 200, 1.4, 0.2, 9);
    }
  }
  coral(at, col, depth, len) {
    const mat = new T.MeshLambertMaterial({ color: new T.Color(col), flatShading: true });
    const grow = (p, dir, l, d, r) => {
      const end = p.clone().addScaledVector(dir, l), m = new T.Mesh(new T.CylinderGeometry(r * 0.7, r, l, 5), mat);
      m.position.copy(p).addScaledVector(dir, l / 2); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); this.scene.add(m);
      if (d > 0) for (let k = 0; k < 2 + (this.R() < 0.4 ? 1 : 0); k++) { const nd = dir.clone().add(new T.Vector3(this.rr(-0.8, 0.8), this.rr(0, 0.4), this.rr(-0.8, 0.8))).normalize(); grow(end, nd, l * this.rr(0.55, 0.8), d - 1, r * 0.65); }
      else { const s = this.sprite(col, 5, end); this.anims.push((t) => { s.material.opacity = 0.5 + 0.4 * Math.sin(t * 2 + end.x); }); }
    };
    at.y = this.h(at.x, at.z);
    grow(at, new T.Vector3(0, 1, 0), len, depth, 1.6);
  }
  // drifting motes of dust, spores or sparkle
  motes(col, n, size, rise, wind = 0) {
    const arr = new Float32Array(n * 3), base = [];
    for (let i = 0; i < n; i++) { const x = this.rr(-300, 300), z = this.rr(-300, 300), y = this.h(x, z) + this.rr(1, 40); base.push([x, y, z, this.R() * TAU]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(arr, 3));
    const pm = new T.PointsMaterial({ color: new T.Color(col), size, sizeAttenuation: false, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
    this.scene.add(new T.Points(g, pm));
    this.anims.push((t) => { base.forEach(([x, y, z, ph], i) => { const yy = (y + t * rise * 3 + ph * 6) % 50; arr[i * 3] = x + Math.sin(t * 0.3 + ph) * 3 + ((t * wind + ph * 40) % 600) * (wind ? 1 : 0); arr[i * 3 + 1] = this.h(x, z) + yy; arr[i * 3 + 2] = z + Math.cos(t * 0.27 + ph) * 3; }); g.attributes.position.needsUpdate = true; });
  }
  // rings of light expanding from things (song, speech): k at a time, from where `from` says
  ripples(col, k, from) {
    const rings = Array.from({ length: k }, () => {
      const m = new T.Mesh(new T.RingGeometry(0.85, 1, 40), new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
      this.scene.add(m); return { m, t: this.R() * 4, at: new T.Vector3() };
    });
    this.anims.push((t, dt) => {
      for (const r of rings) {
        r.t += dt;
        if (r.t > 4) { r.t = 0; r.at.copy(from ? from() : this.spot(10, 80).add(new T.Vector3(0, 8, 0))); if (r.col) r.m.material.color.set(r.col); }
        const k2 = r.t / 4; r.m.position.copy(r.at); r.m.scale.setScalar(2 + k2 * (from ? 40 : 30)); r.m.material.opacity = 0.6 * (1 - k2); r.m.lookAt(this.cam.position);
      }
    });
    return rings;
  }
  // ------------------------------------------------ the people
  figure(col, h, emissive = 0.6) {
    const g = new T.Group(), mat = new T.MeshLambertMaterial({ color: new T.Color(col), emissive: new T.Color(col).multiplyScalar(emissive) });
    const body = new T.Mesh(new T.CapsuleGeometry(h * 0.12, h * 0.55, 3, 8), mat); body.position.y = h * 0.42; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(h * 0.13, 10, 8), mat); head.position.y = h * 0.86; g.add(head);
    g.userData.mat = mat; this.scene.add(g); return g;
  }
  peopleBits() {
    const w = this.w.people, S = this.scene, rr = this.rr, R = this.R;
    const onGround = (p) => { p.y = Math.max(this.h(p.x, p.z), this.w.land === 'sea' ? 0.6 : -99); return p; };
    if (w === 'colours') {
      // gentle beings who speak in colours: their bodies shift hue, and their words are rings
      const beings = [];
      for (let gi = 0; gi < 3; gi++) { const c = onGround(this.spot(16, 40)); for (let k = 0; k < 4; k++) { const f = this.figure('#ffffff', rr(6, 9), 0.8), p = onGround(c.clone().add(new T.Vector3(rr(-8, 8), 0, rr(-8, 8)))); f.position.copy(p); beings.push({ f, h: R(), p }); } this.pois.push(c.clone().setY(c.y + 6)); }
      this.anims.push((t) => { for (const b of beings) { const col = new T.Color().setHSL((b.h + t * 0.05) % 1, 0.8, 0.6); b.f.userData.mat.color.copy(col); b.f.userData.mat.emissive.copy(col).multiplyScalar(0.7); b.f.position.y = b.p.y + Math.sin(t * 1.5 + b.h * 9) * 0.4; } });
      const rings = this.ripples('#ffffff', 6, () => { const b = beings[Math.floor(R() * beings.length)]; this._spk = b; return b.f.position.clone().add(new T.Vector3(0, 7, 0)); });
      this.anims.push(() => { for (const r of rings) if (r.t < 0.05 && this._spk) r.m.material.color.copy(this._spk.f.userData.mat.color); });
    } else if (w === 'drifters') {
      // whale-sized drifters, swimming through the sky, singing to the tides in great rings
      this.whales = [];
      for (let k = 0; k < 3; k++) {
        const g = new T.Group(), segs = [], n = 10 + Math.floor(R() * 4), col = new T.Color(['#4a5a8a', '#6a4a7a', '#3a6a7a'][k]), mat = new T.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(0.25), flatShading: true });
        for (let s = 0; s < n; s++) { const m = new T.Mesh(new T.SphereGeometry(1, 10, 8), mat); const r = 9 * Math.sin((s + 1) / (n + 1) * Math.PI) + 3; m.scale.set(r * 1.3, r, r); g.add(m); segs.push(m); }
        for (const sd of [-1, 1]) { const fn = new T.Mesh(new T.SphereGeometry(1, 8, 6), mat); fn.scale.set(1.6, 0.12, 0.5); fn.position.set(sd * 1.5, 0.1, 0); segs[2].add(fn); }
        const tail = new T.Mesh(new T.SphereGeometry(1, 8, 6), mat); tail.scale.set(2.4, 0.15, 0.8); segs[n - 1].add(tail);
        g.userData = { a: R() * TAU, d: rr(170, 280), y: this.heightAt(0) + rr(35, 80), sp: rr(0.03, 0.05) * (R() < 0.5 ? 1 : -1), ph: R() * TAU, segs };
        g.scale.setScalar(rr(1.1, 1.6)); S.add(g); this.whales.push(g);
      }
      this.anims.push((t) => { for (const b of this.whales) { const d = b.userData; d.a += d.sp * 0.016; b.position.set(Math.cos(d.a) * d.d, d.y + Math.sin(t * 0.2 + d.ph) * 10, Math.sin(d.a) * d.d); b.lookAt(Math.cos(d.a + d.sp * 10) * d.d, d.y, Math.sin(d.a + d.sp * 10) * d.d); d.segs.forEach((s, k) => s.position.set(Math.sin(t * 0.6 + k * 0.6 + d.ph) * 3, Math.sin(t * 0.4 + k * 0.5) * 1.5, -k * 9)); } });
      this.ripples('#a0e0ff', 4, () => this.whales[Math.floor(R() * 3)].position.clone());
      this.whaleLook = true;
    } else if (w === 'moss') {
      // a single mind spread through the moss: light running through the ground in waves
      const n = 900, arr = new Float32Array(n * 3), col = new Float32Array(n * 3), pts = [];
      for (let i = 0; i < n; i++) { const x = rr(-420, 420), z = rr(-420, 420); pts.push([x, z]); arr[i * 3] = x; arr[i * 3 + 1] = Math.max(this.h(x, z), this.w.land === 'sea' ? 0 : -99) + 0.5; arr[i * 3 + 2] = z; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(arr, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      S.add(new T.Points(g, new T.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));
      const waves = Array.from({ length: 3 }, (_, k) => ({ x: 0, z: 0, t: k * 3 }));
      this.anims.push((t, dt) => {
        for (const wv of waves) { wv.t += dt; if (wv.t > 9) { wv.t = 0; const p = this.curve.getPointAt((this.u + rr(0.01, 0.06)) % 1); wv.x = p.x + rr(-60, 60); wv.z = p.z + rr(-60, 60); } }
        for (let i = 0; i < n; i++) { let b = 0.12; for (const wv of waves) { const d = Math.hypot(pts[i][0] - wv.x, pts[i][1] - wv.z), f = wv.t * 30; b += Math.exp(-((d - f) ** 2) / 60) * (1 - wv.t / 9); } col[i * 3] = 0.3 * b; col[i * 3 + 1] = b; col[i * 3 + 2] = 0.6 * b; }
        g.attributes.color.needsUpdate = true;
      });
    } else if (w === 'sleepers') {
      // people who sleep for a year: pods breathing with a slow light; now and then one wakes
      const pods = [];
      for (let k = 0; k < 5; k++) { const c = onGround(this.spot(14, 60)); this.pois.push(c); for (let j = 0; j < 6; j++) { const p = onGround(c.clone().add(new T.Vector3(rr(-9, 9), 0, rr(-9, 9)))); const mat = new T.MeshLambertMaterial({ color: new T.Color('#e0d0ff'), emissive: new T.Color('#b080ff'), emissiveIntensity: 0.3, transparent: true, opacity: 0.85 }); const m = new T.Mesh(new T.SphereGeometry(1, 12, 10), mat); m.scale.set(1.6, 3, 1.6); m.position.copy(p).setY(p.y + 2.4); S.add(m); pods.push({ m, ph: R() * TAU, wake: 0 }); } }
      this.anims.push((t, dt) => { for (const p of pods) { if (p.wake <= 0 && R() < dt * 0.01) p.wake = 1; p.wake = Math.max(0, p.wake - dt * 0.15); p.m.material.emissiveIntensity = 0.25 + 0.15 * Math.sin(t * 0.5 + p.ph) + p.wake * 1.4; p.m.scale.y = 3 * (1 + 0.04 * Math.sin(t * 0.5 + p.ph)); } });
    } else if (w === 'librarians') {
      // librarians of a vanished species: archive towers, and books circling them like birds
      const tex = booksTex(), books = [];
      for (let k = 0; k < 6; k++) {
        const r = rr(5, 9), p = onGround(this.spot(r + 22, 150)), h = rr(40, 90), tx = tex.clone(); tx.repeat.set(3, h / 24); tx.needsUpdate = true; this.disposables.push(tx);
        const m = new T.Mesh(new T.CylinderGeometry(r, r * 1.15, h, 8, 1), new T.MeshLambertMaterial({ map: tx, emissive: new T.Color('#3a2010') }));
        m.position.copy(p).setY(p.y + h / 2); S.add(m);
        const cap = new T.Mesh(new T.ConeGeometry(r * 1.4, r * 1.6, 8), new T.MeshLambertMaterial({ color: new T.Color('#6a4a3a'), flatShading: true })); cap.position.copy(p).setY(p.y + h + r * 0.8); S.add(cap);
        for (let j = 0; j < 9; j++) books.push({ c: p.clone().setY(p.y + rr(h * 0.4, h * 1.1)), r: rr(r + 6, r + 22), a: R() * TAU, sp: rr(0.3, 0.7) * (R() < 0.5 ? 1 : -1), col: `hsl(${Math.floor(R() * 360)},45%,55%)` });
        if (k < 3) this.pois.push(p.clone().setY(p.y + h * 0.7));
      }
      const geo = new T.BoxGeometry(2.2, 0.5, 1.6), m = this.inst(geo, new T.MeshLambertMaterial({ color: 0xffffff, emissive: new T.Color('#403020') }), books.map((b) => ({ x: b.c.x, y: b.c.y, z: b.c.z, col: b.col }))), o = new T.Object3D();
      this.anims.push((t) => { books.forEach((b, i) => { const a = b.a + t * b.sp; o.position.set(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(t * 1.3 + i) * 2, b.c.z + Math.sin(a) * b.r); o.rotation.set(Math.sin(t * 8 + i) * 0.6, -a, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.instanceMatrix.needsUpdate = true; });
      this.motes('#ffe0a0', 120, 1.3, 0.4);
    } else if (w === 'robots') {
      // robots who garden the ruins of their makers: broken colonnades, flower beds, small busy robots
      const stone = new T.MeshLambertMaterial({ color: new T.Color('#b8b0a4'), flatShading: true }), bots = [], flowers = [], fc = [];
      for (let k = 0; k < 6; k++) {
        const c = onGround(this.spot(16, 70)), n = 5 + Math.floor(R() * 4);
        for (let j = 0; j < n; j++) { const a = j / n * TAU, h = R() < 0.4 ? rr(2, 5) : rr(8, 14), col = new T.Mesh(new T.CylinderGeometry(0.9, 1.1, h, 7), stone), p = c.clone().add(new T.Vector3(Math.cos(a) * 11, 0, Math.sin(a) * 11)); col.position.set(p.x, this.h(p.x, p.z) + h / 2, p.z); S.add(col); }
        if (R() < 0.6) { const l = new T.Mesh(new T.BoxGeometry(22, 1.4, 2), stone); l.position.copy(c).setY(c.y + 14); l.rotation.y = R() * TAU; S.add(l); }
        for (let j = 0; j < 40; j++) { const p = c.clone().add(new T.Vector3(rr(-9, 9), 0, rr(-9, 9))); flowers.push(p.x, this.h(p.x, p.z) + 0.6, p.z); const cc = new T.Color().setHSL(R(), 0.8, 0.65); fc.push(cc.r, cc.g, cc.b); }
        for (let j = 0; j < 2; j++) {
          const g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(2, 1.8, 1.6), new T.MeshLambertMaterial({ color: new T.Color('#c8ccd0'), flatShading: true })); body.position.y = 1.6; g.add(body);
          const head = new T.Mesh(new T.SphereGeometry(0.8, 8, 6), body.material); head.position.y = 3; g.add(head);
          const eye = new T.Mesh(new T.SphereGeometry(0.28, 6, 4), new T.MeshBasicMaterial({ color: new T.Color('#7affc0') })); eye.position.set(0, 3.1, 0.7); g.add(eye);
          S.add(g); bots.push({ g, c, a: R() * TAU, r: rr(3, 8), sp: rr(0.2, 0.5) });
        }
        this.pois.push(c.clone().setY(c.y + 4));
      }
      const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(flowers, 3)); fg.setAttribute('color', new T.Float32BufferAttribute(fc, 3));
      S.add(new T.Points(fg, new T.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true })));
      this.anims.push((t) => { for (const b of bots) { const a = b.a + t * b.sp, x = b.c.x + Math.cos(a) * b.r, z = b.c.z + Math.sin(a) * b.r; b.g.position.set(x, this.h(x, z) + Math.abs(Math.sin(t * 6 + b.a)) * 0.3, z); b.g.rotation.y = -a + (b.sp > 0 ? 0 : Math.PI); } });
    } else if (w === 'travellers') {
      // travellers who never stay longer than one night: a caravan of lanterns, and tonight's tents
      const route = new T.CatmullRomCurve3(Array.from({ length: 7 }, () => { const p = this.spot(30, 120); return onGround(p); }), true);
      const lan = [], walkers = [];
      for (let k = 0; k < 12; k++) {
        const s = this.sprite('#ffc070', 5, new T.Vector3()); lan.push(s);
        const f = this.figure('#1a1418', 5, 0); walkers.push(f);
      }
      this.anims.push((t) => { lan.forEach((s, k) => { const u = (t * 0.004 + k * 0.006) % 1, p = route.getPointAt(u); const y = Math.max(this.h(p.x, p.z), this.w.land === 'sea' ? 0.4 : -99); walkers[k].position.set(p.x, y, p.z); s.position.set(p.x, y + 5.5 + Math.sin(t * 3 + k) * 0.2, p.z); s.material.opacity = 0.75 + 0.2 * Math.sin(t * 9 + k * 3); }); });
      for (let k = 0; k < 7; k++) { const p = onGround(route.getPointAt(0.5).clone().add(new T.Vector3(rr(-16, 16), 0, rr(-16, 16)))); const tent = new T.Mesh(new T.ConeGeometry(3.4, 5, 5), new T.MeshLambertMaterial({ color: new T.Color('#7a5a4a'), flatShading: true })); tent.position.copy(p).setY(p.y + 2.5); S.add(tent); this.sprite('#ffb060', 4, p.clone().setY(p.y + 1.2)); }
      this.pois.push(route.getPointAt(0.5));
      this.anims.push((t) => { this.pois[this.pois.length - 1] = route.getPointAt((t * 0.004 + 0.03) % 1); });
    } else if (w === 'children') {
      // children who are older than the mountains: little glowing figures sitting on the peaks
      const peaks = [];
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + rr(-0.2, 0.2), d = rr(360, 520), x = Math.cos(a) * d, z = Math.sin(a) * d, h = rr(110, 220), r = rr(70, 120); const m = new T.Mesh(new T.ConeGeometry(r, h, 7, 2), new T.MeshLambertMaterial({ color: new T.Color(this.ld.low).lerp(new T.Color('#8a8aa0'), 0.5), flatShading: true })); m.position.set(x, h / 2 - 4, z); S.add(m); const cap = new T.Mesh(new T.ConeGeometry(r * 0.25, h * 0.25, 7), new T.MeshLambertMaterial({ color: new T.Color('#f0f4ff'), flatShading: true })); cap.position.set(x, h * 0.88 - 4, z); S.add(cap); peaks.push(new T.Vector3(x, h - 4, z)); }
      const kids = [];
      for (const p of peaks.slice(0, 5)) { const f = this.figure('#fff4d8', 6, 1); f.position.copy(p); kids.push(f); this.sprite('#fff0c0', 14, p.clone().setY(p.y + 3)); this.pois.push(p); }
      for (let k = 0; k < 6; k++) { const p = onGround(this.spot(16, 50)); const f = this.figure('#fff4d8', 2.6, 1); f.position.copy(p); kids.push(f); this.sprite('#fff0c0', 6, p.clone().setY(p.y + 1.4)); }
      this.anims.push((t) => { kids.forEach((f, k) => { f.userData.mat.emissiveIntensity = 0.8 + 0.3 * Math.sin(t * 0.7 + k); }); });
    }
  }
  // ------------------------------------------------ the custom
  customBits() {
    const w = this.w.custom, S = this.scene, rr = this.rr, R = this.R;
    if (w === 'trees') {
      // every child plants a tree that will outlive them: groves, from saplings to giants
      if (this.w.land === 'sea') return;
      const crowns = [], trunks = [];
      for (let k = 0; k < 90; k++) { const p = this.spot(12, 180), h = R() < 0.15 ? rr(26, 44) : rr(3, 14); trunks.push({ x: p.x, y: p.y + h * 0.25, z: p.z, sx: h * 0.04, sy: h * 0.5, sz: h * 0.04 }); crowns.push({ x: p.x, y: p.y + h * 0.65, z: p.z, sx: h * 0.3, sy: h * 0.7, sz: h * 0.3, col: `hsl(${100 + Math.floor(R() * 60)},${30 + R() * 25}%,${28 + R() * 14}%)` }); }
      this.inst(new T.CylinderGeometry(0.7, 1, 1, 5), new T.MeshLambertMaterial({ color: new T.Color('#4a3428'), flatShading: true }), trunks);
      this.inst(new T.ConeGeometry(1, 1, 7), new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), crowns);
    } else if (w === 'dream') {
      // “see you in the dream”: soap-bubble dreams floating up
      const mat = new T.MeshPhongMaterial({ color: new T.Color('#d0e8ff'), specular: new T.Color('#ffffff'), shininess: 120, transparent: true, opacity: 0.3, depthWrite: false });
      const bub = Array.from({ length: 26 }, () => { const m = new T.Mesh(new T.SphereGeometry(1, 14, 10), mat); m.scale.setScalar(rr(1.5, 4)); S.add(m); return { m, p: this.spot(6, 90), ph: R() * 60 }; });
      this.anims.push((t) => { for (const b of bub) { const y = (t * 2 + b.ph) % 60; b.m.position.set(b.p.x + Math.sin(t * 0.5 + b.ph) * 3, b.p.y + y, b.p.z + Math.cos(t * 0.4 + b.ph) * 3); } });
    } else if (w === 'night') {
      // the longest night is a holiday: lanterns rising from everywhere
      const lan = Array.from({ length: 60 }, () => ({ s: this.sprite('#ffb050', rr(3, 6), new T.Vector3()), p: this.spot(5, 160), ph: R() * 120, sp: rr(2, 4) }));
      this.anims.push((t) => { for (const l of lan) { const y = (t * l.sp + l.ph) % 120; l.s.position.set(l.p.x + Math.sin(t * 0.3 + l.ph) * 4, l.p.y + 2 + y, l.p.z); l.s.material.opacity = Math.min(1, y / 10) * (1 - y / 130) * (0.8 + 0.2 * Math.sin(t * 6 + l.ph)); } });
    } else if (w === 'songs') {
      // songs are used instead of maps: ribbons of light along the routes, rippling
      for (let k = 0; k < 3; k++) {
        const pts = Array.from({ length: 8 }, (_, i) => { const p = this.curve.getPointAt((i / 8 + k * 0.11) % 1).clone(); p.x += rr(-40, 40); p.z += rr(-40, 40); p.y = this.heightAt(i / 8) + rr(-6, 16); return p; });
        const cv = new T.CatmullRomCurve3(pts, true), g = new T.TubeGeometry(cv, 160, 0.5, 4, true);
        const mat = new T.MeshBasicMaterial({ color: new T.Color(['#ffd0f0', '#c0f0ff', '#fff0b0'][k]), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
        const m = new T.Mesh(g, mat); S.add(m);
        this.anims.push((t) => { m.position.y = Math.sin(t * 0.6 + k * 2) * 3; mat.opacity = 0.35 + 0.3 * Math.sin(t * 1.3 + k); });
      }
    } else if (w === 'eclipse') {
      // time is counted in eclipses: a moon crosses the sun, the light dims, the corona shows
      const moon = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0x000000, fog: false, depthWrite: false, transparent: true, opacity: 1, blending: T.NormalBlending }));
      const size = this.st.suns[0].size * 1.3; moon.scale.setScalar(size); S.add(moon);
      const corona = this.sprite('#ffffff', size * 4, this.sunPos.clone()); corona.material.fog = false;
      const side = new T.Vector3().crossVectors(this.sunDir, new T.Vector3(0, 1, 0)).normalize(), base = this.lights.map((l) => l.intensity), hb = this.hemi.intensity;
      this.anims.push((t) => {
        const ph = ((t + 20) % 42) / 42, off = (ph - 0.5) * size * 6, cover = Math.max(0, 1 - Math.abs(off) / (size * 0.9));
        moon.position.copy(this.sunPos).addScaledVector(side, off).multiplyScalar(0.98);
        this.lights.forEach((l, i) => { l.intensity = base[i] * (1 - 0.8 * cover); }); this.hemi.intensity = hb * (1 - 0.5 * cover);
        corona.material.opacity = cover * 0.8;
      });
      this.pois.push(this.sunPos.clone().multiplyScalar(0.5));
    } else if (w === 'names') {
      // guests are given a new name at the door: great gates on the way, with glowing runes
      for (const u of [0.18, 0.52, 0.84]) {
        const p = this.curve.getPointAt(u), tan = this.curve.getTangentAt(u), y = this.heightAt(u), gy = Math.min(this.h(p.x, p.z), y - 4);
        const g = new T.Group(), stone = new T.MeshLambertMaterial({ color: new T.Color('#a8a0b0'), flatShading: true }), h = y - gy + 14;
        for (const s of [-1, 1]) { const pl = new T.Mesh(new T.BoxGeometry(3.4, h, 3.4), stone); pl.position.set(s * 12, gy + h / 2, 0); g.add(pl); }
        const lin = new T.Mesh(new T.BoxGeometry(30, 3, 4), stone); lin.position.set(0, gy + h + 1.5, 0); g.add(lin);
        const rune = new T.Mesh(new T.BoxGeometry(22, 0.8, 4.2), new T.MeshBasicMaterial({ color: new T.Color('#9affff') })); rune.position.set(0, gy + h + 1.2, 0); g.add(rune);
        g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(tan.x, tan.z); S.add(g);
        this.anims.push((t) => { rune.material.color.setHSL(0.5 + 0.1 * Math.sin(t + u * 9), 1, 0.6 + 0.2 * Math.sin(t * 3)); });
      }
    } else if (w === 'silence') {
      this.motes('#ffffff', 90, 1, 0.1);
      this.calm = true;
    }
  }
  // ------------------------------------------------ flying
  step(dt) {
    this.t += dt;
    const t = this.t, sp = this.calm ? 5.5 : 8.5;
    this.u = (this.u + dt * sp / this.len) % 1;
    const u = this.u, p = this.curve.getPointAt(u), y = this.heightAt(u) + Math.sin(u * TAU * 3 + 1) * this.ld.clear * 0.35 + Math.sin(t * 0.4) * 1.2;
    this.cam.position.set(p.x, y, p.z);
    const ahead = this.curve.getPointAt((u + 0.04) % 1), look = new T.Vector3(ahead.x, y - this.ld.clear * 0.3 - 2, ahead.z);
    // now and then, turn to look at something (a moon, a whale, a tower), then back to the way ahead
    this.lookT -= dt;
    if (this.lookT <= 0) {
      this.lookT = this.calm ? 18 : this.R() * 8 + 10;
      const cands = [...this.pois, ...(this.whales || []).map((w) => w.position)].filter((q) => q.distanceTo(this.cam.position) < 700);
      this.look = cands.length ? { at: cands[Math.floor(this.R() * cands.length)], until: t + 5 } : null;
    }
    if (this.look && t < this.look.until) { const k = Math.min(1, (this.look.until - t) / 1.2, (t - this.look.until + 5) / 1.2) * 0.45; look.lerp(this.look.at, k); }
    this.cam.lookAt(look);
    // bank into the turns
    const a = this.curve.getTangentAt(u), b = this.curve.getTangentAt((u + 0.01) % 1), turn = a.x * b.z - a.z * b.x;
    this.roll += (clamp(-turn * 8, -0.12, 0.12) - this.roll) * Math.min(1, dt * 1.2);
    this.cam.rotateZ(this.roll + Math.sin(t * 0.23) * 0.015);
    for (const f of this.anims) f(t, dt);
  }
  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.()); });
    for (const d of this.disposables) d.dispose?.();
  }
}

// a dreamscape playing in a 2D canvas (the card's), started and stopped with the card
export function dreamscape(cv, seed, world) {
  let scape = null, raf = 0, last = 0, dead = false;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const r = renderer();
    if (r.lost || !scape) return;
    scape.step(dt);
    r.render(scape.scene, scape.cam);
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, h = Math.round(w * 0.8);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(r.domElement, 0, 0, cv.width, cv.height);
  };
  return {
    async start() {
      dead = false;
      try { await loadThree(); } catch { return false; }
      if (dead) return true;
      if (!scape) scape = new Scape(seed, world);
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
      return true;
    },
    stop() { dead = true; cancelAnimationFrame(raf); raf = 0; if (scape) { scape.dispose(); scape = null; } }
  };
}
