// Rigid boxes with rotation, friction and stacking: a compact port of the ideas
// in Box2D-Lite (SAT box–box collision with clipping, sequential impulses).

export class Body {
  constructor(x, y, w, h, density = 1, opts = {}) {
    Object.assign(this, { x, y, w, h, a: opts.a || 0, vx: 0, vy: 0, av: 0, friction: opts.friction ?? 0.55 });
    const mass = density ? density * w * h : 0;
    this.invM = mass ? 1 / mass : 0;
    this.invI = mass ? 1 / ((mass * (w * w + h * h)) / 12) : 0;
    Object.assign(this, opts.data || {});
  }
}

const dot = (ax, ay, bx, by) => ax * bx + ay * by;

function incidentEdge(h, b, nx, ny) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  // normal in b's frame, negated
  const lx = -(c * nx + s * ny), ly = -(-s * nx + c * ny);
  let v0, v1;
  if (Math.abs(lx) > Math.abs(ly)) v0 = lx > 0 ? [h[0], -h[1]] : [-h[0], h[1]], v1 = lx > 0 ? [h[0], h[1]] : [-h[0], -h[1]];
  else v0 = ly > 0 ? [h[0], h[1]] : [-h[0], -h[1]], v1 = ly > 0 ? [-h[0], h[1]] : [h[0], -h[1]];
  const w = (v) => [b.x + c * v[0] - s * v[1], b.y + s * v[0] + c * v[1]];
  return [w(v0), w(v1)];
}
function clip(vIn, nx, ny, off) {
  const out = [];
  const d0 = dot(nx, ny, vIn[0][0], vIn[0][1]) - off, d1 = dot(nx, ny, vIn[1][0], vIn[1][1]) - off;
  if (d0 <= 0) out.push(vIn[0]);
  if (d1 <= 0) out.push(vIn[1]);
  if (d0 * d1 < 0) { const t = d0 / (d0 - d1); out.push([vIn[0][0] + t * (vIn[1][0] - vIn[0][0]), vIn[0][1] + t * (vIn[1][1] - vIn[0][1])]); }
  return out;
}
// Returns contacts [{x, y, nx, ny, sep}] with the normal pointing from a to b.
export function collide(a, b) {
  const hA = [a.w / 2, a.h / 2], hB = [b.w / 2, b.h / 2];
  const ca = Math.cos(a.a), sa = Math.sin(a.a), cb = Math.cos(b.a), sb = Math.sin(b.a);
  // rotation matrices as columns: A = [[ca, sa], [-sa, ca]] (col1 = (ca, sa), col2 = (-sa, ca))
  const dpx = b.x - a.x, dpy = b.y - a.y;
  const dA = [ca * dpx + sa * dpy, -sa * dpx + ca * dpy];
  const dB = [cb * dpx + sb * dpy, -sb * dpx + cb * dpy];
  // C = A^T B
  const C = [[ca * cb + sa * sb, ca * -sb + sa * cb], [-sa * cb + ca * sb, -sa * -sb + ca * cb]];
  const aC = C.map((r) => r.map(Math.abs));
  const faceA = [Math.abs(dA[0]) - hA[0] - (aC[0][0] * hB[0] + aC[0][1] * hB[1]), Math.abs(dA[1]) - hA[1] - (aC[1][0] * hB[0] + aC[1][1] * hB[1])];
  if (faceA[0] > 0 || faceA[1] > 0) return [];
  const faceB = [Math.abs(dB[0]) - (aC[0][0] * hA[0] + aC[1][0] * hA[1]) - hB[0], Math.abs(dB[1]) - (aC[0][1] * hA[0] + aC[1][1] * hA[1]) - hB[1]];
  if (faceB[0] > 0 || faceB[1] > 0) return [];
  const colA = [[ca, sa], [-sa, ca]], colB = [[cb, sb], [-sb, cb]];
  let axis = 0, sep = faceA[0], n = dA[0] > 0 ? colA[0] : [-colA[0][0], -colA[0][1]];
  const rt = 0.95, at = 0.01;
  if (faceA[1] > rt * sep + at * hA[1]) { axis = 1; sep = faceA[1]; n = dA[1] > 0 ? colA[1] : [-colA[1][0], -colA[1][1]]; }
  if (faceB[0] > rt * sep + at * hB[0]) { axis = 2; sep = faceB[0]; n = dB[0] > 0 ? colB[0] : [-colB[0][0], -colB[0][1]]; }
  if (faceB[1] > rt * sep + at * hB[1]) { axis = 3; sep = faceB[1]; n = dB[1] > 0 ? colB[1] : [-colB[1][0], -colB[1][1]]; }
  let fn, front, sn, negSide, posSide, inc;
  if (axis === 0) { fn = n; front = dot(a.x, a.y, ...fn) + hA[0]; sn = colA[1]; const side = dot(a.x, a.y, ...sn); negSide = -side + hA[1]; posSide = side + hA[1]; inc = incidentEdge(hB, b, ...fn); }
  else if (axis === 1) { fn = n; front = dot(a.x, a.y, ...fn) + hA[1]; sn = colA[0]; const side = dot(a.x, a.y, ...sn); negSide = -side + hA[0]; posSide = side + hA[0]; inc = incidentEdge(hB, b, ...fn); }
  else if (axis === 2) { fn = [-n[0], -n[1]]; front = dot(b.x, b.y, ...fn) + hB[0]; sn = colB[1]; const side = dot(b.x, b.y, ...sn); negSide = -side + hB[1]; posSide = side + hB[1]; inc = incidentEdge(hA, a, ...fn); }
  else { fn = [-n[0], -n[1]]; front = dot(b.x, b.y, ...fn) + hB[1]; sn = colB[0]; const side = dot(b.x, b.y, ...sn); negSide = -side + hB[0]; posSide = side + hB[0]; inc = incidentEdge(hA, a, ...fn); }
  let cp = clip(inc, -sn[0], -sn[1], negSide);
  if (cp.length < 2) return [];
  cp = clip(cp, sn[0], sn[1], posSide);
  if (cp.length < 2) return [];
  const out = [];
  for (const p of cp) {
    const s = dot(fn[0], fn[1], p[0], p[1]) - front;
    if (s <= 0) out.push({ x: p[0] - s * fn[0], y: p[1] - s * fn[1], nx: n[0], ny: n[1], sep: s });
  }
  return out;
}

export class World {
  constructor(gravity = 600) { this.g = gravity; this.bodies = []; this.iterations = 12; this.onImpact = null; }
  add(b) { this.bodies.push(b); return b; }
  remove(b) { this.bodies = this.bodies.filter((x) => x !== b); }
  step(dt) {
    const bs = this.bodies;
    for (const b of bs) if (b.invM) { b.vy += this.g * dt; b.vx *= 0.999; b.vy *= 0.999; b.av *= 0.995; }
    const arbs = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (!a.invM && !b.invM) continue;
      const ra = Math.hypot(a.w, a.h) / 2, rb = Math.hypot(b.w, b.h) / 2;
      if (Math.abs(a.x - b.x) > ra + rb || Math.abs(a.y - b.y) > ra + rb) continue;
      const cs = collide(a, b);
      if (!cs.length) continue;
      const fr = Math.sqrt(a.friction * b.friction);
      for (const c of cs) {
        const r1x = c.x - a.x, r1y = c.y - a.y, r2x = c.x - b.x, r2y = c.y - b.y;
        const rn1 = r1x * c.nx + r1y * c.ny, rn2 = r2x * c.nx + r2y * c.ny;
        const kn = a.invM + b.invM + a.invI * (r1x * r1x + r1y * r1y - rn1 * rn1) + b.invI * (r2x * r2x + r2y * r2y - rn2 * rn2);
        const tx = c.ny, ty = -c.nx;
        const rt1 = r1x * tx + r1y * ty, rt2 = r2x * tx + r2y * ty;
        const kt = a.invM + b.invM + a.invI * (r1x * r1x + r1y * r1y - rt1 * rt1) + b.invI * (r2x * r2x + r2y * r2y - rt2 * rt2);
        arbs.push({ a, b, c, r1x, r1y, r2x, r2y, mn: 1 / kn, mt: 1 / kt, tx, ty, fr, bias: (-0.2 / dt) * Math.min(0, c.sep + 0.6), Pn: 0, Pt: 0 });
      }
    }
    for (let it = 0; it < this.iterations; it++) for (const k of arbs) {
      const { a, b, c } = k;
      let dvx = b.vx - b.av * k.r2y - a.vx + a.av * k.r1y, dvy = b.vy + b.av * k.r2x - a.vy - a.av * k.r1x;
      const vn = dvx * c.nx + dvy * c.ny;
      let dPn = k.mn * (-vn + k.bias);
      const P0 = k.Pn; k.Pn = Math.max(P0 + dPn, 0); dPn = k.Pn - P0;
      let px = dPn * c.nx, py = dPn * c.ny;
      a.vx -= a.invM * px; a.vy -= a.invM * py; a.av -= a.invI * (k.r1x * py - k.r1y * px);
      b.vx += b.invM * px; b.vy += b.invM * py; b.av += b.invI * (k.r2x * py - k.r2y * px);
      dvx = b.vx - b.av * k.r2y - a.vx + a.av * k.r1y; dvy = b.vy + b.av * k.r2x - a.vy - a.av * k.r1x;
      const vt = dvx * k.tx + dvy * k.ty;
      let dPt = k.mt * -vt;
      const maxPt = k.fr * k.Pn, T0 = k.Pt; k.Pt = Math.max(-maxPt, Math.min(maxPt, T0 + dPt)); dPt = k.Pt - T0;
      px = dPt * k.tx; py = dPt * k.ty;
      a.vx -= a.invM * px; a.vy -= a.invM * py; a.av -= a.invI * (k.r1x * py - k.r1y * px);
      b.vx += b.invM * px; b.vy += b.invM * py; b.av += b.invI * (k.r2x * py - k.r2y * px);
    }
    if (this.onImpact) for (const k of arbs) if (k.Pn > 0) this.onImpact(k.a, k.b, k.Pn);
    for (const b of bs) if (b.invM) { b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.av * dt; }
  }
}
