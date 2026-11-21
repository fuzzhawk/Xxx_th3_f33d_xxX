// The metropolis come to life (installed onto Garden, like garden-live.js):
//   the trains   two steam trains run the loop, half a lap apart, to a timetable kept by the clock
//                (so they are where they would be even after you have been away). They ease out of
//                each station, run at speed, ease in, and wait a few seconds at the platform
//   riding       tap a train standing at a platform near you to get on; you ride (the camera with
//                you, the map filling in as you pass) until you tap again: you get off at the next stop
//   the city     each district has its own air: the neon quarter's dusk and drizzle, the centre a
//                little of it, the ironworks' haze; chimneys, factories and cooling towers smoke and
//                the vents under the city puff steam
//   a new world  growing the garden again from a new seed (garden-map.js asks, once all twelve
//                treasures are found)
import * as Wd from './garden-world.js';
import * as MA from './garden-metro-art.js';
import { glowSprite } from './garden-kit.js';

const { T } = Wd;
const SPD = 8, DWELL = 9, GAP = 1.9, PARTS = ['loco', 'tender', 'coach', 'coach', 'coach'];
const ease = (u) => u - Math.sin(u * 6.2832) / 6.2832;

// the line's timetable: a dwell at each stop, then a run to the next
function railOf(Rm) {
  const r = Rm.rail;
  if (!r || !r.line?.length) return null;
  if (Rm._rl?.src === r) return Rm._rl;
  const n = r.line.length / 2, stops = [...r.stops].sort((a, b) => a.at - b.at), seg = [];
  let P = 0;
  stops.forEach((s, j) => {
    const nx = stops[(j + 1) % stops.length], d = ((nx.at - s.at + n) % n) || n;
    seg.push({ dwell: 1, s0: s.at, t0: P, dur: DWELL, stop: s }); P += DWELL;
    seg.push({ s0: s.at, d, t0: P, dur: d / SPD }); P += d / SPD;
  });
  return (Rm._rl = { src: r, L: r.line, n, stops, seg, P });
}
// where train k is now: its head's distance along the line, and the stop it stands at (if any)
function trainAt(rl, k, now = Date.now() / 1000) {
  const t = (((now + k * rl.P * 0.5) % rl.P) + rl.P) % rl.P;
  for (const g of rl.seg) if (t < g.t0 + g.dur) {
    if (g.dwell) return { s: g.s0, stop: g.stop, moving: 0 };
    const u = (t - g.t0) / g.dur;
    return { s: (g.s0 + g.d * ease(u)) % rl.n, stop: null, moving: 1 };
  }
  return { s: rl.seg[0].s0, stop: rl.seg[0].stop, moving: 0 };
}
// a point along the line: its world position and which way the track runs there
function along(rl, s) {
  const n = rl.n, L = rl.L, sm = ((s % n) + n) % n, i0 = Math.floor(sm), f = sm - i0, i1 = (i0 + 1) % n;
  const x0 = L[i0 * 2], y0 = L[i0 * 2 + 1], x1 = L[i1 * 2], y1 = L[i1 * 2 + 1];
  return { x: (x0 + (x1 - x0) * f) * T + 8, y: (y0 + (y1 - y0) * f) * T + 8, dx: x1 - x0, dy: y1 - y0 };
}

export function install(Garden) {
  const P = Garden.prototype, base = {};
  for (const k of ['dreamInit', 'dreamItems', 'drawDream', 'dreamLights', 'stepDream', 'tapDream', 'step', 'autopilot', 'drawWalker', 'enter', 'tap']) base[k] = P[k];
  Object.assign(P, {
    dreamInit() { base.dreamInit.call(this); this.ride = null; this.metK = 0; this.trains = []; },
    enter(realm, at) { this.ride = null; return base.enter.call(this, realm, at); },
    // while you ride, a tap on the world (not the menu) means: off at the next stop
    tap(x, y) {
      if (this.ride && this.ready && !this.fade) { if (this.uiTap(x, y)) return; if (!this.ride.off) { this.ride.off = true; this.icon(this.hero.x, this.hero.y - 30, 'star'); } return; }
      return base.tap.call(this, x, y);
    },
    // the trains' cars, each as its own thing in the back-to-front list
    trainCars() {
      const rl = railOf(this.Rm);
      if (!rl) return [];
      const out = [], now = Date.now() / 1000;
      for (let k = 0; k < 2; k++) {
        const st = trainAt(rl, k, now);
        PARTS.forEach((part, c) => {
          const p = along(rl, st.s - c * GAP), dir = p.dx ? 'h' : p.dy > 0 ? 's' : 'n';
          out.push({ k, c, part, x: p.x, y: p.y, dir, flip: p.dx < 0, st });
        });
      }
      return (this.trains = out);
    },
    dreamItems(items, vis) {
      base.dreamItems.call(this, items, vis);
      for (const car of this.trainCars()) if (vis(car.x, car.y, 60)) items.push([car.y + 4, 'train', car]);
    },
    drawDream(b, kind, o, cx, cy) {
      if (kind !== 'train') return base.drawDream.call(this, b, kind, o, cx, cy);
      const lit = this.dark ? 1 : 0, s = MA.trainSprite(o.part, o.dir, o.k, Math.floor(this.t * 8) % 8, lit), X = Math.round(o.x - cx), Y = Math.round(o.y - cy);
      b.fillStyle = 'rgba(0,0,0,.18)'; b.fillRect(X - (o.dir === 'h' ? 14 : 7), Y + 3, o.dir === 'h' ? 28 : 14, 3);
      b.save(); b.translate(X, Y + (o.dir === 'h' ? 6 : 10)); if (o.flip) b.scale(-1, 1); b.drawImage(s.cv, -Math.floor(s.w / 2), -s.h); b.restore();
      // you, at a window
      if (this.ride && this.ride.k === o.k && o.c === 2) { const hx = X + (o.dir === 'h' ? 0 : 0), hy = Y + (o.dir === 'h' ? -12 : -14); b.fillStyle = '#f0d0b0'; b.fillRect(hx - 1, hy, 3, 3); b.fillStyle = '#3a2a24'; b.fillRect(hx - 1, hy - 1, 3, 1); }
    },
    dreamLights(b, cx, cy) {
      base.dreamLights.call(this, b, cx, cy);
      if (!this.trains?.length) return;
      b.globalCompositeOperation = 'lighter';
      for (const o of this.trains) {
        const X = Math.round(o.x - cx), Y = Math.round(o.y - cy);
        if (X < -60 || Y < -60 || X > 300 || Y > 340) continue;
        if (o.part === 'loco') { const hx = X + (o.dir === 'h' ? (o.flip ? -16 : 16) : 0), hy = Y + (o.dir === 'h' ? -6 : o.dir === 's' ? 2 : -20), r = 26; b.globalAlpha = this.dark ? 0.6 : 0.25; b.drawImage(glowSprite('#ffe8a0', r), hx - Math.round(r / 4) * 4, hy - Math.round(r / 4) * 4); }
        else if (o.part === 'coach' && this.dark) { const r = 22; b.globalAlpha = 0.35; b.drawImage(glowSprite('#ffd98a', r), X - Math.round(r / 4) * 4, Y - 12 - Math.round(r / 4) * 4); }
      }
      b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
    },
    // ------------------------------------------------ every step
    stepDream(dt) {
      base.stepDream.call(this, dt);
      const Rm = this.Rm, h = this.hero, R = Math.random, cx0 = this.cam.x - 130, cy0 = this.cam.y - 150;
      // each district's own air
      if (Rm.metro) {
        const d = Wd.districtAt(Rm, Math.floor(h.x / T), Math.floor(h.y / T)), D = Wd.D_NEON;
        const tgt = d === D ? 1 : d === Wd.D_CORE ? 0.42 : d === Wd.D_WORKS ? 0.36 : d === Wd.D_OLD ? 0.22 : 0;
        this.metK = (this.metK || 0) + (tgt - (this.metK || 0)) * Math.min(1, dt * 2);
        this.cityK = this.metK;
      }
      // smoke from the locomotives
      for (const o of this.trains || []) {
        if (o.part !== 'loco' || o.x < cx0 - 40 || o.x > cx0 + 300 || o.y < cy0 - 40 || o.y > cy0 + 340) continue;
        if (R() < dt * (o.st.moving ? 9 : 2)) { const sx = o.x + (o.dir === 'h' ? (o.flip ? -9 : 9) : 0), sy = o.y + (o.dir === 'h' ? -18 : o.dir === 's' ? -24 : -30); this.fx.push({ kind: 'smoke', x: sx, y: sy, vx: (R() - 0.5) * 8 + (o.dir === 'h' ? (o.flip ? 10 : -10) : 0), vy: -16 - R() * 10, t: 0, life: 1.8 }); }
      }
      // chimneys, factories and cooling towers smoke; the vents under the city puff steam
      if (R() < dt * 4 && this.fx.length < 160) {
        const list = Wd.decorIn(Rm, Math.floor(cx0 / T) - 2, Math.floor(cy0 / T) - 2, Math.ceil((cx0 + 260) / T) + 2, Math.ceil((cy0 + 320) / T) + 12).filter((d) => (d.t === 'bldg' && (d.k === 'chimney' || d.k === 'factory' || d.k === 'cooling')) || (d.t === 'works' && (d.k === 'vent' || d.k === 'furnace' || d.k === 'boiler')));
        if (list.length) {
          const d = list[(R() * list.length) | 0], foot = (d.y + 1) * T;
          if (d.t === 'bldg') {
            const s = MA.bldgSprite(d.k, d.v, d.w, d.d, d.h), left = d.x * T + (d.w * T) / 2 - s.w / 2;
            const sx = d.k === 'factory' ? left + (d.v % 2 ? d.w * T - 6 : 6) : left + s.w / 2, sy = foot - s.h + (d.k === 'cooling' ? 14 : 2);
            for (let q = 0; q < (d.k === 'cooling' ? 3 : 1); q++) this.fx.push({ kind: 'smoke', x: sx + (R() - 0.5) * (d.k === 'cooling' ? d.w * 8 : 3), y: sy, vx: 5 + R() * 6, vy: -10 - R() * 6, t: -q * 0.2, life: 2.6 });
          } else if (d.k === 'vent') for (let q = 0; q < 4; q++) this.fx.push({ kind: 'smoke', x: d.x * T + 8 + (R() - 0.5) * 8, y: foot - 6, vx: (R() - 0.5) * 6, vy: -18 - R() * 12, t: -q * 0.12, life: 1.3 });
          else this.fx.push({ kind: 'spark', x: d.x * T + 8, y: foot - 14, vx: (R() - 0.5) * 30, vy: -20 - R() * 20, t: 0, life: 0.8, c: '#ffb24a' });
        }
      }
    },
    // ------------------------------------------------ riding
    stepRide() {
      const r = this.ride;
      if (!r) return;
      const rl = railOf(this.Rm);
      if (!rl) { this.ride = null; return; }
      const st = trainAt(rl, r.k), h = this.hero;
      if (st.stop && st.stop !== r.lastStop) { r.lastStop = st.stop; if (r.stops > 0) r.stops--; if (this.auto && r.stops <= 0) r.off = true; }
      if (st.stop && r.off && st.stop !== r.from) {
        // off at this stop: onto the platform beside the coach you were in
        const p = along(rl, st.s - 2 * GAP), tx = Math.floor(p.x / T);
        this.ride = null;
        h.x = tx * T + 8; h.y = (st.stop.y - 1) * T + 12; h.path = []; h.task = null; this.stick = null;
        this.unstick(); this.sparkle(h.x, h.y - 10, '#ffe8a0', 10); h.actor.emote('wave', 0.8); h.busy = 0.6;
        return;
      }
      const p = along(rl, st.s - 2 * GAP);
      h.x = p.x; h.y = p.y + 4; h.vx = 0; h.vy = 0; h.path = []; h.task = null; this.stick = null;
      this.cam.x = h.x; this.cam.y = h.y - 16;
    },
    step(dt) {
      base.step.call(this, dt);
      if (this.ride) this.stepRide(dt);
    },
    drawWalker(b, w, X, Y) { if (w === this.hero && this.ride) return; return base.drawWalker.call(this, b, w, X, Y); },
    board(k, stop) {
      this.ride = { k, from: stop, lastStop: stop, stops: this.auto ? 1 + Math.floor(Math.random() * 3) : Infinity, off: false };
      const h = this.hero; h.path = []; h.task = null; this.stick = null;
      this.chime(h.x, h.y - 20, '#ffe8a0', 3);
    },
    tapDream(wx, wy) {
      if (this.ride) { if (!this.ride.off) { this.ride.off = true; this.icon(this.hero.x, this.hero.y - 30, 'star'); } return true; }
      const rl = railOf(this.Rm);
      if (rl) for (const o of this.trains || []) {
        if (Math.abs(wx - o.x) > (o.dir === 'h' ? 17 : 9) || wy > o.y + 10 || wy < o.y - 30) continue;
        const st = trainAt(rl, o.k), h = this.hero;
        if (st.stop && Math.hypot(o.x - h.x, o.y - h.y) < 7 * T) this.board(o.k, st.stop);
        else { this.chime(o.x, o.y - 24, '#ffe8a0', 2); this.icon(o.x, o.y - 34, 'note'); }
        return true;
      }
      return base.tapDream.call(this, wx, wy);
    },
    // the autopilot takes the train now and then: when one stands at a platform near it, it gets on
    // and rides a stop or three; sometimes it walks to a station it is near
    autopilot(dt) {
      if (this.ride) return;
      const rl = this.ready && railOf(this.Rm), h = this.hero;
      if (rl && !this.fade && !h.path.length && !h.task && h.busy <= 0) {
        for (let k = 0; k < 2; k++) {
          const st = trainAt(rl, k);
          if (!st.stop || this.autoRode === `${k}|${st.stop.at}|${Math.floor(Date.now() / 30000)}`) continue;
          const p = along(rl, st.s - 2 * GAP);
          if (Math.hypot(p.x - h.x, p.y - h.y) < 6 * T) { this.autoRode = `${k}|${st.stop.at}|${Math.floor(Date.now() / 30000)}`; if (Math.random() < 0.5) { this.board(k, st.stop); return; } }
        }
        if (Math.random() < dt * 0.02) {
          const near = rl.stops.map((s) => [s, Math.hypot(s.x * T - h.x, s.y * T - h.y)]).filter(([, d]) => d < 40 * T && d > 3 * T).sort((a, b) => a[1] - b[1])[0];
          if (near) { const s = near[0]; if (this.goTo((x, y) => Math.abs(x - s.x) <= 2 && y === s.y - 1, null)) return; }
        }
      }
      base.autopilot.call(this, dt);
    },
    // ------------------------------------------------ a new world from a new seed
    renewWorld() {
      if (this.fade) return;
      this.closeUI();
      this.fade = { t: 0, col: '#fff8e8', p: { to: 'surface' }, done: true };
      const go = () => { this.ride = null; Wd.renew(); this.enter('surface'); this.hint = 6; for (let i = 0; i < 3; i++) this.chime(this.hero.x, this.hero.y - 20 - i * 6, '#fff6c8', 2); };
      this.later(0.45, go);
    }
  });
}
