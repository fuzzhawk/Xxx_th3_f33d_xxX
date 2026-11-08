// Other worlds, flown through: a dusk dreamscape in 3D behind each other.worlds card. The camera
// glides along a looping path between floating islands (rock undersides, grassy tops, ancient
// ruins, braziers with dancing flames), now and then through a tunnel of stone rings; far off in
// the haze gargantuan creatures swim slowly by, and curious swarms of lights come close, circle,
// and drift away. One small WebGL renderer serves every card (as Outland does); each card's scene
// is built when it scrolls in and dropped when it leaves.
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
// dusk skies: [zenith, horizon, fog, rock, grass, flame, swarm, creature]
const SKIES = [
  ['#1a1240', '#f0907a', '#7a5a8a', '#4a3a48', '#5a7a5a', '#ffb050', '#a0f0ff', '#2a2038'],
  ['#0c1a30', '#e8b070', '#5a6a7a', '#3e3a3a', '#4a6a50', '#ff8a40', '#c0a0ff', '#1a2230'],
  ['#20103a', '#c8609a', '#6a4a7a', '#423248', '#6a6a8a', '#ff7aa0', '#ffe090', '#24162e'],
  ['#061e24', '#70c0a0', '#3a6a68', '#2e3a3a', '#4a8a6a', '#a0ff80', '#ffb0f0', '#14262a']
];

class Scape {
  constructor(seed) {
    this.R = mulberry32(seed ^ 0x51ca);
    const pal = SKIES[seed % SKIES.length].map((c) => new T.Color(c));
    this.pal = pal;
    const S = (this.scene = new T.Scene()), rr = (a, b) => a + this.R() * (b - a);
    S.fog = new T.FogExp2(pal[2], 0.0026);
    this.cam = new T.PerspectiveCamera(62, RW / RH, 0.5, 900);
    // sky: a big sphere coloured from horizon to zenith, with stars
    const sky = new T.SphereGeometry(800, 24, 12), col = [], pos = sky.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 800, k = Math.max(0, Math.min(1, y * 1.6 + 0.25)); const c = pal[1].clone().lerp(pal[0], k); col.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    S.add(new T.Mesh(sky, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })));
    const sp = []; for (let i = 0; i < 260; i++) { const a = this.R() * TAU, b = this.R() * 0.6 + 0.15, r = 700; sp.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r); }
    const stars = new T.BufferGeometry(); stars.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    S.add(new T.Points(stars, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
    S.add(new T.HemisphereLight(pal[1], pal[3], 1.6));
    const moon = new T.DirectionalLight(pal[1].clone().lerp(new T.Color('#ffffff'), 0.5), 1.4); moon.position.set(-1, 0.6, -0.4); S.add(moon);
    // the path: a slow loop through the islands
    const pts = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; pts.push(new T.Vector3(Math.cos(a) * rr(150, 220), rr(-15, 25), Math.sin(a) * rr(150, 220))); }
    this.path = new T.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.len = this.path.getLength();
    const rock = new T.MeshLambertMaterial({ color: pal[3], flatShading: true }), grass = new T.MeshLambertMaterial({ color: pal[4], flatShading: true });
    const stone = new T.MeshLambertMaterial({ color: pal[3].clone().lerp(new T.Color('#d8d0c4'), 0.45), flatShading: true });
    this.flames = []; this.mats = [rock, grass, stone];
    // floating islands beside the path, some with ruins and braziers
    const samples = Array.from({ length: 120 }, (_, k) => this.path.getPointAt(k / 120));
    const clear = (q, r) => samples.every((sp) => sp.distanceTo(q) > r);
    for (let i = 0, tries = 0; i < 64 && tries < 400; tries++) {
      // near ones along the way, and a far scatter filling the sky
      const far = i >= 38, u = (far ? this.R() : i / 38 + rr(-0.01, 0.01)), uu = ((u % 1) + 1) % 1, p = this.path.getPointAt(uu), tan = this.path.getTangentAt(uu), side = new T.Vector3(-tan.z, 0, tan.x).normalize();
      const off = side.multiplyScalar((this.R() < 0.5 ? -1 : 1) * (far ? rr(120, 280) : rr(30, 90))), at = p.clone().add(off).add(new T.Vector3(0, far ? rr(-60, 70) : rr(-22, 16), 0)), size = far ? rr(10, 26) : rr(5, 12);
      if (!clear(at, size * 2.2 + 12)) continue;   // never on the way (the path loops back on itself)
      S.add(this.island(at, size, rock, grass, stone)); i++;
    }
    // tunnels: rings of stone around the path, glowing runes on some
    for (let k = 0; k < 3; k++) {
      const u0 = (k + 0.3) / 3;
      for (let j = 0; j < 7; j++) {
        const u = (u0 + j * 0.006) % 1, p = this.path.getPointAt(u), tan = this.path.getTangentAt(u);
        const ring = new T.Mesh(new T.TorusGeometry(9 + this.R() * 1.5, 1.8 + this.R(), 5, 10), j % 2 ? rock : stone);
        ring.position.copy(p); ring.lookAt(p.clone().add(tan)); ring.rotation.z += this.R();
        S.add(ring);
        if (j % 3 === 0) for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + this.R(), m = new T.Mesh(new T.BoxGeometry(0.8, 0.8, 0.8), new T.MeshBasicMaterial({ color: pal[6] })); m.position.set(Math.cos(a) * 9.5, Math.sin(a) * 9.5, 0); ring.add(m); }
      }
    }
    // gargantuan creatures, far off in the haze: long bodies of soft segments, swimming slowly
    this.beasts = [];
    for (let k = 0; k < 3; k++) {
      const g = new T.Group(), segs = [], n = 9 + Math.floor(this.R() * 5), mat = new T.MeshLambertMaterial({ color: pal[7], emissive: pal[7].clone().multiplyScalar(0.25) });
      for (let s = 0; s < n; s++) { const m = new T.Mesh(new T.SphereGeometry(1, 10, 8), mat); const r = 9 * Math.sin((s + 1) / (n + 1) * Math.PI) + 3; m.scale.set(r * 1.3, r, r); g.add(m); segs.push(m); }
      // a pair of long soft fins at the shoulders (children of the body, so sized in its units)
      for (const sd of [-1, 1]) { const fn = new T.Mesh(new T.SphereGeometry(1, 8, 6), mat); fn.scale.set(1.4, 0.12, 0.45); fn.position.set(sd * 1.5, 0.1, 0); segs[2].add(fn); }
      const a = this.R() * TAU, d = rr(400, 520); g.scale.setScalar(rr(1.6, 2.2));
      g.userData = { a, d, y: rr(-30, 60), sp: rr(0.01, 0.02) * (this.R() < 0.5 ? 1 : -1), ph: this.R() * TAU, segs };
      S.add(g); this.beasts.push(g);
    }
    // curious swarms of little lights
    this.swarm = []; const sw = new Float32Array(90 * 3), sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sw, 3));
    for (let i = 0; i < 90; i++) this.swarm.push({ p: new T.Vector3(rr(-40, 40), rr(-10, 20), rr(-40, 40)), v: new T.Vector3() });
    this.swarmPts = new T.Points(sg, new T.PointsMaterial({ color: pal[6], size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    S.add(this.swarmPts);
    this.swarmHome = new T.Vector3(); this.swarmMood = 0;
    this.u = this.R(); this.t = 0;
  }
  island(at, size, rock, grass, stone) {
    const g = new T.Group(), rr = (a, b) => a + this.R() * (b - a);
    const under = new T.ConeGeometry(size, size * rr(1.6, 2.6), 9, 3), pos = under.attributes.position;
    for (let i = 0; i < pos.count; i++) { if (pos.getY(i) > size * 0.7) continue; pos.setX(i, pos.getX(i) * rr(0.8, 1.15)); pos.setZ(i, pos.getZ(i) * rr(0.8, 1.15)); }
    under.computeVertexNormals();
    const u = new T.Mesh(under, rock); u.rotation.x = Math.PI; g.add(u);
    const top = new T.Mesh(new T.CylinderGeometry(size * 1.02, size * 0.96, size * 0.25, 9), grass); top.position.y = size * 0.95 + size * 0.12; g.add(top);
    const ground = size * 1.1 + size * 0.12;
    if (this.R() < 0.55) {
      // ruins: a ring of columns (some broken), a lintel, a brazier with a flame
      const n = 3 + Math.floor(this.R() * 4);
      for (let c = 0; c < n; c++) {
        const a = c / n * TAU, h = this.R() < 0.35 ? rr(1, 3) : rr(4, 7), col = new T.Mesh(new T.CylinderGeometry(0.55, 0.65, h, 6), stone);
        col.position.set(Math.cos(a) * size * 0.55, ground + h / 2, Math.sin(a) * size * 0.55); g.add(col);
      }
      if (this.R() < 0.6) { const l = new T.Mesh(new T.BoxGeometry(size * 0.9, 0.7, 1.1), stone); l.position.set(0, ground + 6.5, 0); l.rotation.y = this.R() * TAU; g.add(l); }
      const bz = new T.Mesh(new T.CylinderGeometry(0.9, 0.5, 1.4, 6), stone); bz.position.set(0, ground + 0.7, 0); g.add(bz);
      this.flame(g, new T.Vector3(0, ground + 1.6, 0));
    } else if (this.R() < 0.7) {
      // a tree or two
      for (let k = 0; k < 2; k++) { const tr = new T.Mesh(new T.ConeGeometry(rr(1.5, 2.6), rr(5, 9), 6), grass); tr.position.set(rr(-size, size) * 0.5, ground + 3.5, rr(-size, size) * 0.5); g.add(tr); }
    }
    g.position.copy(at); g.rotation.y = this.R() * TAU;
    g.userData = { bob: this.R() * TAU, y0: at.y };
    return g;
  }
  flame(parent, at) {
    // a flame: a cluster of additive sprites that flicker and dance
    const mat = new T.SpriteMaterial({ color: this.pal[5], transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const parts = [];
    for (let k = 0; k < 4; k++) { const s = new T.Sprite(mat.clone()); s.position.copy(at); s.scale.set(1.6, 2.4, 1); parent.add(s); parts.push(s); }
    this.flames.push({ parts, at, ph: this.R() * TAU });
  }
  step(dt) {
    this.t += dt;
    const t = this.t;
    this.u = (this.u + dt * 7 / this.len) % 1;
    const p = this.path.getPointAt(this.u), look = this.path.getPointAt((this.u + 0.012) % 1);
    this.cam.position.copy(p).add(new T.Vector3(0, Math.sin(t * 0.4) * 1.5, 0));
    this.cam.lookAt(look);
    this.cam.rotateZ(Math.sin(t * 0.23) * 0.06);
    for (const f of this.flames) f.parts.forEach((s, k) => { const ph = t * (7 + k) + f.ph + k * 1.7; s.position.set(f.at.x + Math.sin(ph) * 0.25, f.at.y + 0.6 + k * 0.45 + Math.sin(ph * 1.3) * 0.2, f.at.z + Math.cos(ph) * 0.25); const sc = 1.2 + 0.5 * Math.sin(ph * 1.1) - k * 0.2; s.scale.set(sc, sc * 1.6, 1); s.material.opacity = 0.75 - k * 0.12 + Math.sin(ph * 2) * 0.1; });
    for (const b of this.beasts) {
      const d = b.userData; d.a += d.sp * dt;
      b.position.set(Math.cos(d.a) * d.d, d.y + Math.sin(t * 0.2 + d.ph) * 8, Math.sin(d.a) * d.d);
      b.lookAt(Math.cos(d.a + d.sp * 10) * d.d, d.y, Math.sin(d.a + d.sp * 10) * d.d);
      d.segs.forEach((s, k) => { s.position.set(Math.sin(t * 0.6 + k * 0.6 + d.ph) * 3, Math.sin(t * 0.4 + k * 0.5) * 1.5, -k * 9); });
    }
    // the swarm: boids around a home that sometimes swings close to the camera to look
    this.swarmMood -= dt;
    if (this.swarmMood <= 0) { this.swarmMood = 6 + this.R() * 6; this.curious = this.R() < 0.55; }
    const ahead = this.path.getPointAt((this.u + (this.curious ? 0.006 : 0.03)) % 1).add(new T.Vector3(this.curious ? 2 : 14, this.curious ? 1 : 6, 0));
    this.swarmHome.lerp(ahead, dt * 0.8);
    const arr = this.swarmPts.geometry.attributes.position.array, cen = new T.Vector3();
    for (const b of this.swarm) cen.add(b.p);
    cen.multiplyScalar(1 / this.swarm.length);
    this.swarm.forEach((b, i) => {
      const toHome = this.swarmHome.clone().sub(b.p), toCen = cen.clone().sub(b.p);
      b.v.addScaledVector(toHome, dt * 0.9).addScaledVector(toCen, dt * 0.4);
      b.v.x += Math.sin(t * 2 + i) * dt * 6; b.v.y += Math.cos(t * 1.7 + i * 1.3) * dt * 6; b.v.z += Math.sin(t * 1.3 + i * 0.7) * dt * 6;
      b.v.multiplyScalar(0.97); if (b.v.length() > 14) b.v.setLength(14);
      b.p.addScaledVector(b.v, dt);
      arr[i * 3] = b.p.x; arr[i * 3 + 1] = b.p.y; arr[i * 3 + 2] = b.p.z;
    });
    this.swarmPts.geometry.attributes.position.needsUpdate = true;
    this.scene.traverse((o) => { if (o.userData && o.userData.bob !== undefined) o.position.y = o.userData.y0 + Math.sin(t * 0.5 + o.userData.bob) * 1.2; });
  }
  dispose() { this.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.()); }); }
}

// a dreamscape playing in a 2D canvas (the card's), started and stopped with the card
export function dreamscape(cv, seed) {
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
      if (!scape) scape = new Scape(seed);
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
      return true;
    },
    stop() { dead = true; cancelAnimationFrame(raf); raf = 0; if (scape) { scape.dispose(); scape = null; } }
  };
}
