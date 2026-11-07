// Side-view rigid bodies: convex polygons and circles with rotation, friction and
// restitution. Box2D-style sequential impulses with warm starting (contacts matched
// by feature id frame to frame), sort-and-sweep broadphase and island sleeping, so a
// tall castle stands perfectly still until something hits it.
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
let ids = 1;

export const box = (w, h) => ({ v: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] });

export class Body {
  // shape: { r } for a circle or { v: [[x, y], ...] } for a convex polygon around (x, y)
  constructor(shape, x, y, density = 1, o = {}) {
    this.id = ids++;
    Object.assign(this, { x, y, a: o.a || 0, vx: 0, vy: 0, av: 0, friction: o.friction ?? 0.6, rest: o.rest ?? 0.1, awake: o.awake ?? true, sleepT: 0 });
    let m, I;
    if (shape.r) { this.r = shape.r; this.br = shape.r; m = density * Math.PI * shape.r ** 2; I = 0.5 * m * shape.r ** 2; }
    else {
      let v = shape.v, A = 0, cx = 0, cy = 0;
      for (let i = 0; i < v.length; i++) { const [x1, y1] = v[i], [x2, y2] = v[(i + 1) % v.length], D = cross(x1, y1, x2, y2); A += D / 2; cx += (D * (x1 + x2)) / 6; cy += (D * (y1 + y2)) / 6; }
      cx /= A; cy /= A;
      v = v.map(([px, py]) => [px - cx, py - cy]);
      if (A < 0) { v.reverse(); A = -A; }
      this.x += cx; this.y += cy;
      I = 0;
      for (let i = 0; i < v.length; i++) { const [x1, y1] = v[i], [x2, y2] = v[(i + 1) % v.length]; I += (cross(x1, y1, x2, y2) / 12) * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2); }
      m = density * A; I *= density;
      this.v = v;
      this.n = v.map(([x1, y1], i) => { const [x2, y2] = v[(i + 1) % v.length], ex = x2 - x1, ey = y2 - y1, L = Math.hypot(ex, ey); return [ey / L, -ex / L]; });
      this.br = Math.max(...v.map(([px, py]) => Math.hypot(px, py)));
      this.wv = v.map(() => [0, 0]); this.wn = v.map(() => [0, 0]);
    }
    this.mass = m;
    this.invM = m ? 1 / m : 0; this.invI = m ? 1 / I : 0;
    Object.assign(this, o.data || {});
    this.sync();
  }
  wake() { if (this.invM) { this.awake = true; this.sleepT = 0; } }
  sync() {
    if (this.r) { this.minX = this.x - this.r; this.maxX = this.x + this.r; this.minY = this.y - this.r; this.maxY = this.y + this.r; return; }
    const c = Math.cos(this.a), s = Math.sin(this.a);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < this.v.length; i++) {
      const [lx, ly] = this.v[i], wx = this.x + c * lx - s * ly, wy = this.y + s * lx + c * ly, [nx, ny] = this.n[i];
      this.wv[i][0] = wx; this.wv[i][1] = wy; this.wn[i][0] = c * nx - s * ny; this.wn[i][1] = s * nx + c * ny;
      if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
    }
    this.minX = x0; this.maxX = x1; this.minY = y0; this.maxY = y1;
  }
  // does a circle at (x, y) of radius r touch this body? (polygon corners are treated as edges: a little generous)
  touches(x, y, r) {
    if (x + r < this.minX || x - r > this.maxX || y + r < this.minY || y - r > this.maxY) return false;
    if (this.r) return (x - this.x) ** 2 + (y - this.y) ** 2 <= (r + this.r) ** 2;
    for (let i = 0; i < this.wv.length; i++) if (this.wn[i][0] * (x - this.wv[i][0]) + this.wn[i][1] * (y - this.wv[i][1]) > r) return false;
    return true;
  }
}

// ---------------------------------------------------------------- narrow phase (normals point from a to b)
function maxSep(A, B) {
  let best = -Infinity, bi = 0;
  for (let i = 0; i < A.wv.length; i++) {
    const nx = A.wn[i][0], ny = A.wn[i][1], px = A.wv[i][0], py = A.wv[i][1];
    let mn = Infinity;
    for (const q of B.wv) { const d = nx * (q[0] - px) + ny * (q[1] - py); if (d < mn) mn = d; }
    if (mn > best) { best = mn; bi = i; }
  }
  return [best, bi];
}
function clipSeg(p, nx, ny, off, id) {
  const d0 = nx * p[0][0] + ny * p[0][1] - off, d1 = nx * p[1][0] + ny * p[1][1] - off, o = [];
  if (d0 <= 0) o.push(p[0]);
  if (d1 <= 0) o.push(p[1]);
  if (d0 * d1 < 0) { const t = d0 / (d0 - d1); o.push([p[0][0] + t * (p[1][0] - p[0][0]), p[0][1] + t * (p[1][1] - p[0][1]), id]); }
  return o;
}
function polyPoly(A, B, out) {
  const [sa, ea] = maxSep(A, B); if (sa > 0) return;
  const [sb, eb] = maxSep(B, A); if (sb > 0) return;
  let R = A, I = B, e = ea, flip = 0;
  if (sb > sa * 0.98 + 0.05) { R = B; I = A; e = eb; flip = 1; }
  const nx = R.wn[e][0], ny = R.wn[e][1];
  let k = 0, md = Infinity;
  for (let i = 0; i < I.wn.length; i++) { const d = nx * I.wn[i][0] + ny * I.wn[i][1]; if (d < md) { md = d; k = i; } }
  const n = I.wv.length, v1 = R.wv[e], v2 = R.wv[(e + 1) % R.wv.length];
  let tx = v2[0] - v1[0], ty = v2[1] - v1[1];
  const L = Math.hypot(tx, ty); tx /= L; ty /= L;
  let pts = [[I.wv[k][0], I.wv[k][1], k], [I.wv[(k + 1) % n][0], I.wv[(k + 1) % n][1], (k + 1) % n]];
  pts = clipSeg(pts, -tx, -ty, -(tx * v1[0] + ty * v1[1]), 16); if (pts.length < 2) return;
  pts = clipSeg(pts, tx, ty, tx * v2[0] + ty * v2[1], 17); if (pts.length < 2) return;
  const front = nx * v1[0] + ny * v1[1], sgn = flip ? -1 : 1;
  for (const p of pts) {
    const s = nx * p[0] + ny * p[1] - front;
    if (s <= 0) out.push({ x: p[0] - (s / 2) * nx, y: p[1] - (s / 2) * ny, nx: nx * sgn, ny: ny * sgn, sep: s, id: flip * 4096 + e * 64 + p[2] });
  }
}
function polyCircle(P, C, out, flip) {
  let best = -Infinity, bi = 0;
  for (let i = 0; i < P.wv.length; i++) { const s = P.wn[i][0] * (C.x - P.wv[i][0]) + P.wn[i][1] * (C.y - P.wv[i][1]); if (s > C.r) return; if (s > best) { best = s; bi = i; } }
  const v1 = P.wv[bi], v2 = P.wv[(bi + 1) % P.wv.length];
  let nx = P.wn[bi][0], ny = P.wn[bi][1], sep = best - C.r, id = bi;
  if (best > 1e-6) {
    const u1 = (C.x - v1[0]) * (v2[0] - v1[0]) + (C.y - v1[1]) * (v2[1] - v1[1]);
    const u2 = (C.x - v2[0]) * (v1[0] - v2[0]) + (C.y - v2[1]) * (v1[1] - v2[1]);
    const cn = u1 <= 0 ? v1 : u2 <= 0 ? v2 : null;
    if (cn) { const dx = C.x - cn[0], dy = C.y - cn[1], d = Math.hypot(dx, dy); if (d > C.r || d < 1e-9) return; nx = dx / d; ny = dy / d; sep = d - C.r; id += 32; }
  }
  const px = C.x - nx * (C.r + sep / 2), py = C.y - ny * (C.r + sep / 2), s = flip ? -1 : 1;
  out.push({ x: px, y: py, nx: nx * s, ny: ny * s, sep, id });
}
function collide(a, b, out) {
  if (a.r && b.r) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), R = a.r + b.r;
    if (d > R) return;
    const nx = d > 1e-9 ? dx / d : 0, ny = d > 1e-9 ? dy / d : 1, sep = d - R;
    out.push({ x: a.x + nx * (a.r + sep / 2), y: a.y + ny * (a.r + sep / 2), nx, ny, sep, id: 0 });
  } else if (a.r) polyCircle(b, a, out, true);
  else if (b.r) polyCircle(a, b, out, false);
  else polyPoly(a, b, out);
}

// ---------------------------------------------------------------- world
export class World {
  constructor(g = 600) { this.g = g; this.bodies = []; this.arbs = new Map(); this.iter = 10; this.onImpact = null; }
  add(b) { b.sync(); this.bodies.push(b); return b; }
  remove(b) {
    const i = this.bodies.indexOf(b); if (i < 0) return;
    this.bodies.splice(i, 1); b.gone = true;
    this.wakeBox(b.minX - 3, b.minY - 3, b.maxX + 3, b.maxY + 3);
  }
  wakeBox(x0, y0, x1, y1) { for (const o of this.bodies) if (o.invM && !(o.maxX < x0 || o.minX > x1 || o.maxY < y0 || o.minY > y1)) o.wake(); }
  query(x, y, r, skip) { for (const b of this.bodies) if (b !== skip && !b.ghost && b.touches(x, y, r)) return b; return null; }
  asleep() { return this.bodies.every((b) => !b.invM || !b.awake); }
  step(dt) {
    const bs = this.bodies, g = this.g, next = new Map(), list = [];
    bs.sort((p, q) => p.minX - q.minX);
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (b.minX > a.maxX) break;
        if (b.minY > a.maxY || b.maxY < a.minY) continue;
        const aw = a.invM && a.awake, bw = b.invM && b.awake;
        if (!aw && !bw) continue;
        if (a.ghost || b.ghost || (a.group && a.group === b.group)) continue;
        const [p, q] = a.id < b.id ? [a, b] : [b, a], cs = [];
        collide(p, q, cs);
        if (!cs.length) continue;
        p.wake(); q.wake();
        const key = p.id * 65536 + q.id, old = this.arbs.get(key);
        for (const c of cs) { c.Pn = 0; c.Pt = 0; if (old) for (const o of old.cs) if (o.id === c.id) { c.Pn = o.Pn; c.Pt = o.Pt; break; } }
        const k = { a: p, b: q, cs, fr: Math.sqrt(p.friction * q.friction), e: Math.max(p.rest, q.rest) };
        next.set(key, k); list.push(k);
      }
    }
    this.arbs = next;
    for (const b of bs) if (b.invM && b.awake) { b.vy += g * (b.gs ?? 1) * dt; b.av *= 1 - dt * 0.4; b.touch = false; }
    // prestep: effective masses, impact speeds (before warm starting), bias, then warm start
    const inv = 1 / dt;
    for (const k of list) {
      const { a, b } = k;
      let J = 0;
      a.touch = b.touch = true;
      for (const c of k.cs) {
        c.r1x = c.x - a.x; c.r1y = c.y - a.y; c.r2x = c.x - b.x; c.r2y = c.y - b.y;
        const rn1 = c.r1x * c.nx + c.r1y * c.ny, rn2 = c.r2x * c.nx + c.r2y * c.ny;
        c.mn = 1 / (a.invM + b.invM + a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1) + b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2));
        const rt1 = c.r1x * c.ny - c.r1y * c.nx, rt2 = c.r2x * c.ny - c.r2y * c.nx;
        c.mt = 1 / (a.invM + b.invM + a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1) + b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2));
        const dvx = b.vx - b.av * c.r2y - a.vx + a.av * c.r1y, dvy = b.vy + b.av * c.r2x - a.vy - a.av * c.r1x, vn = dvx * c.nx + dvy * c.ny;
        c.bias = Math.max(-0.2 * inv * Math.min(0, c.sep + 0.4), vn < -50 ? -k.e * vn : 0);
        if (vn < -35) J = Math.max(J, c.mn * -vn);
      }
      if (J && this.onImpact) k.J = J;
    }
    for (const k of list) {
      const { a, b } = k;
      for (const c of k.cs) {
        const px = c.Pn * c.nx + c.Pt * c.ny, py = c.Pn * c.ny - c.Pt * c.nx;
        a.vx -= a.invM * px; a.vy -= a.invM * py; a.av -= a.invI * (c.r1x * py - c.r1y * px);
        b.vx += b.invM * px; b.vy += b.invM * py; b.av += b.invI * (c.r2x * py - c.r2y * px);
      }
    }
    for (let it = 0; it < this.iter; it++) for (const k of list) {
      const { a, b } = k;
      for (const c of k.cs) {
        let dvx = b.vx - b.av * c.r2y - a.vx + a.av * c.r1y, dvy = b.vy + b.av * c.r2x - a.vy - a.av * c.r1x;
        let dP = c.mn * (-(dvx * c.nx + dvy * c.ny) + c.bias);
        const P0 = c.Pn; c.Pn = Math.max(P0 + dP, 0); dP = c.Pn - P0;
        let px = dP * c.nx, py = dP * c.ny;
        a.vx -= a.invM * px; a.vy -= a.invM * py; a.av -= a.invI * (c.r1x * py - c.r1y * px);
        b.vx += b.invM * px; b.vy += b.invM * py; b.av += b.invI * (c.r2x * py - c.r2y * px);
        dvx = b.vx - b.av * c.r2y - a.vx + a.av * c.r1y; dvy = b.vy + b.av * c.r2x - a.vy - a.av * c.r1x;
        const tx = c.ny, ty = -c.nx, mx = k.fr * c.Pn, T0 = c.Pt;
        c.Pt = Math.max(-mx, Math.min(mx, T0 + c.mt * -(dvx * tx + dvy * ty)));
        const dT = c.Pt - T0; px = dT * tx; py = dT * ty;
        a.vx -= a.invM * px; a.vy -= a.invM * py; a.av -= a.invI * (c.r1x * py - c.r1y * px);
        b.vx += b.invM * px; b.vy += b.invM * py; b.av += b.invI * (c.r2x * py - c.r2y * px);
      }
    }
    if (this.onImpact) for (const k of list) if (k.J) this.onImpact(k.a, k.b, k.J);
    for (const b of bs) if (b.invM && b.awake) {
      if (b.r && b.touch) b.av *= 1 - dt * 3; // rolling resistance
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.av * dt; b.sync();
      b.sleepT = b.vx * b.vx + b.vy * b.vy < 50 && b.av * b.av < 0.02 ? b.sleepT + dt : 0;
    }
    // islands of touching dynamic bodies sleep together once every one of them is still
    for (const b of bs) if (b.invM && b.awake) b.up = b;
    const root = (b) => { while (b.up !== b) { b.up = b.up.up; b = b.up; } return b; };
    for (const k of list) if (k.a.invM && k.b.invM && k.a.awake && k.b.awake) { const ra = root(k.a), rb = root(k.b); if (ra !== rb) ra.up = rb; }
    const still = new Map();
    for (const b of bs) if (b.invM && b.awake) { const r = root(b); still.set(r, Math.min(still.get(r) ?? Infinity, b.sleepT)); }
    for (const b of bs) if (b.invM && b.awake && still.get(root(b)) > 0.5) { b.awake = false; b.vx = b.vy = b.av = 0; }
  }
}
