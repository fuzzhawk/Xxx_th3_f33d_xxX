// MARROW engine (biomechanics rig, SDF pixel renderer, clothing and face), from the
// user-supplied MARROW sprite studio. Concatenated into one module; API at the bottom.
/* eslint-disable */
/* ============================================================
   MARROW — biomechanics core
   Planar (sagittal) articulated body: 19 segments, 18 joint DOF.
   Anthropometry: Winter (2009) segment lengths, masses, COM, gyration.
   Muscles: per-joint flexor/extensor torque generators with
     activation dynamics, Hill force-velocity, passive ROM tissue,
     hard ligament stops, gravity + ground-reaction loads.
   ============================================================ */
const D2R = Math.PI / 180, R2D = 180 / Math.PI, GRAV = 9.81;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const mjerk = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (10 + t * (-15 + 6 * t));
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };

/* Joint types. pos/neg = anatomical names for +/- rotation. min/max = soft ROM (deg, AAOS-style norms).
   tPos/tNeg = peak isometric torque (N·m) for a 1.75 m / 75 kg reference adult.
   spd = joint speed factor (max shortening velocity), s = sign of distal rotation per + angle. */
const JT = {
  lumbar:   { name: 'Lumbar spine',  pos: 'Flexion', neg: 'Extension', min: -25, max: 55, tPos: 170, tNeg: 230, spd: .35, reg: 'core', s: -1 },
  thoracic: { name: 'Thoracic spine',pos: 'Flexion', neg: 'Extension', min: -15, max: 35, tPos: 110, tNeg: 150, spd: .35, reg: 'core', s: -1 },
  neck:     { name: 'Neck',          pos: 'Flexion', neg: 'Extension', min: -45, max: 40, tPos: 30, tNeg: 42, spd: .9, reg: 'upper', s: -1 },
  head:     { name: 'Head nod',      pos: 'Flexion', neg: 'Extension', min: -25, max: 20, tPos: 14, tNeg: 20, spd: .9, reg: 'upper', s: -1 },
  hip:      { name: 'Hip',           pos: 'Flexion', neg: 'Extension', min: -20, max: 120, tPos: 160, tNeg: 230, spd: .9, reg: 'lower', s: 1 },
  knee:     { name: 'Knee',          pos: 'Flexion', neg: 'Extension', min: -3, max: 140, tPos: 120, tNeg: 240, spd: 1.25, reg: 'lower', s: -1 },
  ankle:    { name: 'Ankle',         pos: 'Dorsiflexion', neg: 'Plantarflexion', min: -50, max: 35, tPos: 45, tNeg: 200, spd: 1, reg: 'lower', s: 1 },
  toe:      { name: 'Toes (MTP)',    pos: 'Extension', neg: 'Flexion', min: -30, max: 70, tPos: 20, tNeg: 30, spd: 1, reg: 'lower', s: 1 },
  shoulder: { name: 'Shoulder',      pos: 'Flexion', neg: 'Extension', min: -55, max: 175, tPos: 85, tNeg: 100, spd: 1.1, reg: 'upper', s: 1 },
  elbow:    { name: 'Elbow',         pos: 'Flexion', neg: 'Extension', min: -3, max: 145, tPos: 75, tNeg: 55, spd: 1.4, reg: 'upper', s: 1 },
  wrist:    { name: 'Wrist',         pos: 'Flexion', neg: 'Extension', min: -70, max: 80, tPos: 14, tNeg: 10, spd: 1.6, reg: 'upper', s: 1 },
};
const JT_ORDER = ['hip', 'knee', 'ankle', 'toe', 'lumbar', 'thoracic', 'neck', 'head', 'shoulder', 'elbow', 'wrist'];

const JOINTS = [
  ['lumbar', 'C'], ['thoracic', 'C'], ['neck', 'C'], ['head', 'C'],
  ['hip', 'N'], ['knee', 'N'], ['ankle', 'N'], ['toe', 'N'],
  ['hip', 'F'], ['knee', 'F'], ['ankle', 'F'], ['toe', 'F'],
  ['shoulder', 'N'], ['elbow', 'N'], ['wrist', 'N'],
  ['shoulder', 'F'], ['elbow', 'F'], ['wrist', 'F'],
].map(([type, side], i) => ({ i, type, side, id: side === 'C' ? type : type + side }));
const NJ = JOINTS.length;
const J = {}; JOINTS.forEach(j => J[j.id] = j.i);

const SEGS = ['pelvis', 'abdomen', 'thorax', 'neck', 'head',
  'thighN', 'shankN', 'footN', 'toesN', 'thighF', 'shankF', 'footF', 'toesF',
  'upperArmN', 'forearmN', 'handN', 'upperArmF', 'forearmF', 'handF'];
const SI = {}; SEGS.forEach((n, i) => SI[n] = i);
const ARMS = ['upperArmN', 'forearmN', 'handN', 'upperArmF', 'forearmF', 'handF'];
const CHAIN_N = {
  lumbar: ['abdomen', 'thorax', 'neck', 'head', ...ARMS], thoracic: ['thorax', 'neck', 'head', ...ARMS],
  neck: ['neck', 'head'], head: ['head'],
  hip: s => ['thigh' + s, 'shank' + s, 'foot' + s, 'toes' + s], knee: s => ['shank' + s, 'foot' + s, 'toes' + s],
  ankle: s => ['foot' + s, 'toes' + s], toe: s => ['toes' + s],
  shoulder: s => ['upperArm' + s, 'forearm' + s, 'hand' + s], elbow: s => ['forearm' + s, 'hand' + s], wrist: s => ['hand' + s],
};
const CHAIN = JOINTS.map(j => { const c = CHAIN_N[j.type]; return (typeof c === 'function' ? c(j.side) : c).map(n => SI[n]); });

function defaultJoints() { const o = {}; for (const t in JT) o[t] = { min: JT[t].min, max: JT[t].max, sPos: 100, sNeg: 100 }; return o; }
const DEFAULTS = {
  height: 1.75, muscle: 1, bias: 0, fat: 18, bone: 1,
  headL: 1, neckL: 1, torsoL: 1, upperArmL: 1, forearmL: 1, handL: 1, thighL: 1, shankL: 1, footL: 1, chest: 1, belly: 1,
  strength: 1, fastTwitch: 50, actTime: 25, control: 18, stiff: 1,
  walkCadence: 108, walkStride: 1.1, walkArm: 18, walkLean: 3, walkKnee: 1,
  runCadence: 168, runStride: 1, runArm: 32, runLean: 8, runKnee: 1,
  hunch: 0, jowl: 0, brow: 0, eyes: 1, handSize: 1, snout: 0, armBulk: 1, headRound: 0, shots: 3, weapon: 'pistol', danceEnergy: 1,
  jumpDepth: 60, jumpEffort: 100, jumpArms: 150, jumpTuck: 45, jumpLand: 55,
  atkType: 'punch', atkEffort: 100, atkWind: 50, atkRecover: 1,
  joints: defaultJoints(),
};

/* ---------------- rig ---------------- */
function buildRig(p) {
  const H = p.height, R = { H, p };
  const L = {
    pelvis: .06 * H * p.torsoL, abdomen: .105 * H * p.torsoL, thorax: .125 * H * p.torsoL,
    neck: .05 * H * p.neckL, head: .13 * H * p.headL,
    upperArm: .186 * H * p.upperArmL, forearm: .146 * H * p.forearmL, hand: .108 * H * p.handL,
    thigh: .245 * H * p.thighL, shank: .246 * H * p.shankL,
    footH: .039 * H * Math.sqrt(p.footL * p.shankL), heelBack: .04 * H * p.footL, ballFwd: .08 * H * p.footL, toeLen: .032 * H * p.footL,
    shDrop: .02 * H * p.torsoL,
  };
  R.L = L;
  R.stature = L.footH + L.shank + L.thigh + L.pelvis + L.abdomen + L.thorax + L.neck + L.head;
  const fat = clamp(p.fat, 3, 60) / 100;
  R.lean = 61 * Math.pow(H / 1.75, 2.5) * (0.6 + 0.4 * p.muscle) * (0.92 + 0.08 * p.bone);
  R.M = R.lean / (1 - fat); R.fatMass = R.M - R.lean;
  const base = { pelvis: [.142, 'torsoL'], abdomen: [.139, 'torsoL'], thorax: [.216, 'torsoL'], neck: [.013, 'neckL'], head: [.068, 'headL'],
    upperArm: [.028, 'upperArmL'], forearm: [.016, 'forearmL'], hand: [.006, 'handL'], thigh: [.1, 'thighL'], shank: [.0465, 'shankL'], foot: [.0115, 'footL'], toes: [.003, 'footL'] };
  const ab2 = (p.armBulk || 1) ** 2, hs = p.handSize || 1;
  const bulk = { abdomen: p.belly * (0.7 + 1.5 * fat), thorax: p.chest, head: Math.pow(p.headL, 0.25), upperArm: ab2, forearm: ab2, hand: hs * hs };
  let sum = 0; const raw = {};
  for (const k in base) { const [f, key] = base[k]; const r = f * p[key] * (bulk[k] || 1); raw[k] = r; sum += r * (['pelvis', 'abdomen', 'thorax', 'neck', 'head'].includes(k) ? 1 : 2); }
  R.mass = {}; for (const k in raw) R.mass[k] = raw[k] / sum * R.M;
  const regMul = { core: 1, upper: 1 + 0.35 * p.bias, lower: 1 - 0.35 * p.bias };
  R.regMul = regMul;
  const sScale = p.strength * p.muscle * Math.pow(H / 1.75, 3);
  const wBase = 14 + 0.24 * p.fastTwitch;
  R.jt = {};
  for (const t in JT) {
    const d = JT[t], u = p.joints[t];
    const mn = Math.min(u.min, u.max - 5), mx = Math.max(u.max, u.min + 5);
    const am = (t === 'shoulder' || t === 'elbow' || t === 'wrist') ? ab2 : 1;
    R.jt[t] = { min: mn * D2R, max: mx * D2R, tPos: d.tPos * sScale * regMul[d.reg] * am * u.sPos / 100, tNeg: d.tNeg * sScale * regMul[d.reg] * am * u.sNeg / 100, wmax: wBase * d.spd, s: d.s };
  }
  R.tAct = p.actTime / 1000; R.tDeact = p.actTime * 1.6 / 1000; R.wn = p.control; R.stiff = p.stiff;
  R.kPass = 3 * Math.pow(H / 1.75, 3) * p.stiff;
  R.muscleR = { upper: Math.sqrt(p.muscle * regMul.upper), lower: Math.sqrt(p.muscle * regMul.lower), core: Math.sqrt(p.muscle) };
  R.fatT = H * 0.0012 * Math.max(0.6, p.fat - 4);
  return R;
}

function newState() { return { x: 0, y: 1, tilt: 0, q: new Float64Array(NJ), w: new Float64Array(NJ), act: new Float64Array(NJ), eff: new Float64Array(NJ), tq: new Float64Array(NJ) }; }
function cloneQ(st) { return { x: st.x, y: st.y, tilt: st.tilt, q: Float64Array.from(st.q) }; }

/* ---------------- forward kinematics ---------------- */
function fk(R, pose) {
  const L = R.L, q = pose.q, M = R.mass, S = new Array(SEGS.length);
  const mk = (i, ox, oy, a, len, ant, m, cf, gy) => {
    const dx = Math.cos(a), dy = Math.sin(a);
    return S[i] = { ox, oy, a, dx, dy, len, ant, ex: ox + dx * len, ey: oy + dy * len, m, cx: ox + dx * len * cf, cy: oy + dy * len * cf, I: m * (gy * len) ** 2 };
  };
  const P = Math.PI / 2 - pose.tilt;
  const pel = mk(0, pose.x, pose.y, P, L.pelvis, -1, M.pelvis, .45, .3);
  const aA = P - q[J.lumbar]; const abd = mk(1, pel.ex, pel.ey, aA, L.abdomen, -1, M.abdomen, .5, .3);
  const aT = aA - q[J.thoracic]; const tho = mk(2, abd.ex, abd.ey, aT, L.thorax, -1, M.thorax, .5, .3);
  const aN = aT - q[J.neck]; const nec = mk(3, tho.ex, tho.ey, aN, L.neck, -1, M.neck, .5, .3);
  const aH = aN - q[J.head]; mk(4, nec.ex, nec.ey, aH, L.head, -1, M.head, .4, .3);
  const sh = { x: tho.ex - tho.dx * L.shDrop, y: tho.ey - tho.dy * L.shDrop };
  const jp = new Array(NJ);
  jp[J.lumbar] = { x: pel.ex, y: pel.ey }; jp[J.thoracic] = { x: abd.ex, y: abd.ey };
  jp[J.neck] = { x: tho.ex, y: tho.ey }; jp[J.head] = { x: nec.ex, y: nec.ey };
  const feet = {};
  for (const s of ['N', 'F']) {
    const o = s === 'N' ? 0 : 4;
    const aTh = P - Math.PI + q[J['hip' + s]];
    const th = mk(5 + o, pose.x, pose.y, aTh, L.thigh, 1, M.thigh, .433, .323);
    const aSh = aTh - q[J['knee' + s]];
    const sk = mk(6 + o, th.ex, th.ey, aSh, L.shank, 1, M.shank, .433, .302);
    const aF = aSh + Math.PI / 2 + q[J['ankle' + s]];
    const ft = mk(7 + o, sk.ex, sk.ey, aF, L.ballFwd, 1, M.foot, .3, .45);
    const nx = -ft.dy, ny = ft.dx;
    ft.cx = sk.ex + ft.dx * L.ballFwd * .25 - nx * L.footH * .5; ft.cy = sk.ey + ft.dy * L.ballFwd * .25 - ny * L.footH * .5;
    const heel = { x: sk.ex - ft.dx * L.heelBack - nx * L.footH, y: sk.ey - ft.dy * L.heelBack - ny * L.footH };
    const ball = { x: sk.ex + ft.dx * L.ballFwd - nx * L.footH, y: sk.ey + ft.dy * L.ballFwd - ny * L.footH };
    const aTo = aF + q[J['toe' + s]];
    const to = mk(8 + o, ball.x, ball.y, aTo, L.toeLen, 1, M.toes, .5, .3);
    feet[s] = { heel, ball, tip: { x: to.ex, y: to.ey } };
    jp[J['hip' + s]] = { x: pose.x, y: pose.y }; jp[J['knee' + s]] = { x: th.ex, y: th.ey };
    jp[J['ankle' + s]] = { x: sk.ex, y: sk.ey }; jp[J['toe' + s]] = ball;
  }
  for (const s of ['N', 'F']) {
    const o = s === 'N' ? 0 : 3;
    const aU = aT - Math.PI + q[J['shoulder' + s]];
    const ua = mk(13 + o, sh.x, sh.y, aU, L.upperArm, 1, M.upperArm, .436, .322);
    const aFa = aU + q[J['elbow' + s]];
    const fa = mk(14 + o, ua.ex, ua.ey, aFa, L.forearm, 1, M.forearm, .43, .303);
    const aHa = aFa + q[J['wrist' + s]];
    mk(15 + o, fa.ex, fa.ey, aHa, L.hand * .62, 1, M.hand, .45, .3);
    jp[J['shoulder' + s]] = sh; jp[J['elbow' + s]] = { x: ua.ex, y: ua.ey }; jp[J['wrist' + s]] = { x: fa.ex, y: fa.ey };
  }
  let mx = 0, my = 0, mt = 0;
  for (const g of S) { mx += g.m * g.cx; my += g.m * g.cy; mt += g.m; }
  return { S, jp, feet, com: { x: mx / mt, y: my / mt }, sh };
}
const footPts = f => [f.heel, f.ball, f.tip];
const minY = f => Math.min(f.heel.y, f.ball.y, f.tip.y);

/* ---------------- muscle model ---------------- */
function fv(v) { // v = shortening velocity / vmax (negative = lengthening)
  if (v >= 0) return Math.max(0, (1 - v) / (1 + v / 0.3));
  return Math.min(1.5, 1 + 2.5 * (-v));
}
function passiveTorque(R, jt, q, w) {
  const sg = 6 * D2R, k = R.kPass;
  return -k * (Math.exp((q - jt.max) / sg) - Math.exp((jt.min - q) / sg)) - 0.05 * k * w * (q > jt.max || q < jt.min ? 1 : 0);
}
const HARD = 10 * D2R;

/* loads acting on joint j: distal-chain gravity, plus ground reaction when that leg bears weight */
function jointLoad(R, F, j, stance) {
  const jt = R.jt[JOINTS[j].type], jp = F.jp[j];
  if (stance && stance.nload && stance.nload[j] !== undefined) {
    // normative gait moment (feed-forward demand); inertia still includes the supported body
    let I = 0; for (const k of CHAIN[j]) { const g = F.S[k]; const rx = g.cx - jp.x, ry = g.cy - jp.y; I += g.I + g.m * (rx * rx + ry * ry); }
    const Ic = Math.max(I, 8e-3);
    const st = stance[JOINTS[j].side]; if (st && st.w > 0) { const Jy = -jt.s * (st.cop - jp.x); I += st.w * R.M * Jy * Jy; }
    I = Math.max(I, 8e-3);
    return { I, Ic: Math.max(Ic, 0.15 * I), tg: -stance.nload[j] };
  }
  let I = 0, tg = 0;
  for (const k of CHAIN[j]) { const g = F.S[k]; const rx = g.cx - jp.x, ry = g.cy - jp.y; I += g.I + g.m * (rx * rx + ry * ry); tg += -g.m * GRAV * rx; }
  tg *= jt.s;
  const side = JOINTS[j].side, leg = JOINTS[j].type === 'hip' || JOINTS[j].type === 'knee' || JOINTS[j].type === 'ankle' || JOINTS[j].type === 'toe';
  if (leg && stance && stance[side] && stance[side].w > 0) {
    const st = stance[side], rx = st.cop - jp.x;
    if (JOINTS[j].type === 'toe' && rx < 0) { /* COP behind MTP: toes unloaded */ }
    else {
      // GRF line of action runs from the COP toward the whole-body COM (inverted-pendulum stance)
      const ry = -jp.y, fx = st.fy * (F.com.x - st.cop) / Math.max(0.2, F.com.y);
      const Jy = -jt.s * rx; I += st.w * R.M * Jy * Jy; tg += jt.s * (rx * st.fy - ry * fx);
    }
  }
  return { I: Math.max(I, 8e-3), tg };
}

/* one integration step of the torque-limited muscle servos */
function servoStep(R, st, F, tgt, mask, stance, dt, effMax, tgtW, tgtA) {
  const wn = R.wn;
  for (let j = 0; j < NJ; j++) {
    if (!mask[j]) continue;
    const jt = R.jt[JOINTS[j].type];
    let { I, Ic, tg } = jointLoad(R, F, j, stance); if (!Ic) Ic = I;
    const aff = tgtA ? I * tgtA[j] : 0;
    // normative moments already contain the limb's own inertial demand
    if (stance && stance.nload && stance.nload[j] !== undefined) tg += aff;
    const target = clamp(tgt[j], jt.min - 4 * D2R, jt.max + 4 * D2R);
    const q = st.q[j], w = st.w[j];
    const tdes = aff + Ic * wn * wn * (target - q) + 2 * Ic * wn * ((tgtW ? tgtW[j] : 0) - w) - tg;
    // the nervous system compensates for the force-velocity loss it expects at the current speed
    const cap0 = (tdes >= 0 ? jt.tPos : jt.tNeg) * Math.max(0.15, fv((tdes >= 0 ? w : -w) / jt.wmax));
    const u = clamp(tdes / cap0, -effMax, effMax);
    const a = st.act[j];
    const rising = Math.abs(u) > Math.abs(a) || u * a < 0;
    const A = st.act[j] = a + (u - a) * Math.min(1, dt / (rising ? R.tAct : R.tDeact));
    const vs = (A >= 0 ? w : -w) / jt.wmax;
    const tm = A * (A >= 0 ? jt.tPos : jt.tNeg) * fv(vs);
    const tp = passiveTorque(R, jt, q, w);
    const alpha = (tm + tp + tg - 0.02 * Ic * wn * w) / I;
    let nw = w + alpha * dt, nq = q + nw * dt;
    if (nq > jt.max + HARD) { nq = jt.max + HARD; if (nw > 0) nw = 0; }
    if (nq < jt.min - HARD) { nq = jt.min - HARD; if (nw < 0) nw = 0; }
    st.q[j] = nq; st.w[j] = nw; st.tq[j] = tm; st.eff[j] = Math.abs(tm) / (A >= 0 ? jt.tPos : jt.tNeg) * Math.sign(A) || 0;
    st.eff[j] = Math.abs(A);
  }
}

/* static effort for joints driven kinematically (stance legs): |required torque| / capacity */
function staticEffort(R, F, st, j, stance) {
  if (JOINTS[j].type === 'toe') { st.eff[j] = 0.1; st.tq[j] = 0; return; }
  const jt = R.jt[JOINTS[j].type];
  const { tg } = jointLoad(R, F, j, stance);
  const need = -tg; // muscle must cancel load
  st.tq[j] = need;
  st.eff[j] = Math.abs(need) / (need >= 0 ? jt.tPos : jt.tNeg);
}

/* COP under COM, clamped to the grounded part of the sole */
function copOf(F, side) {
  const f = F.feet[side], pts = footPts(f), my = minY(f);
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) if (p.y < my + 0.008) { lo = Math.min(lo, p.x); hi = Math.max(hi, p.x); }
  return clamp(F.com.x, lo, hi);
}

/* gaze stabilisation: neck + head share the correction that keeps the head upright */
function gazeTargets(F, tgt, down) {
  const tho = F.S[SI.thorax].a, want = Math.PI / 2 - (down || 4) * D2R;
  const tot = wrapA(tho - want);
  tgt[J.neck] = tot * 0.55; tgt[J.head] = tot * 0.45;
}

/* frame recorder */
function record(R, st, F, t, extra) {
  return Object.assign({ t, x: st.x, y: st.y, tilt: st.tilt, q: Float32Array.from(st.q), act: Float32Array.from(st.act), eff: Float32Array.from(st.eff), tq: Float32Array.from(st.tq), com: { x: F.com.x, y: F.com.y } }, extra || {});
}

/* ---------------- periodic gait curves (Winter / Perry norms, deg) ---------------- */
function pcurve(keys) {
  const P = keys.slice(0, -1).map(k => [k[0] / 100, k[1]]), n = P.length;
  const at = i => { const m = ((i % n) + n) % n, w = Math.floor(i / n); return [P[m][0] + w, P[m][1]]; };
  return t => {
    t -= Math.floor(t); let i = 0; while (i < n - 1 && P[i + 1][0] <= t) i++;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const span = p2[0] - p1[0], u = (t - p1[0]) / span;
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * span, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * span;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  };
}
const GAIT = {
  hip:   pcurve([[0, 25], [12, 22], [30, 6], [50, -11], [60, -4], [72, 17], [86, 30], [100, 25]]),
  knee:  pcurve([[0, 3], [15, 17], [38, 4], [50, 8], [62, 38], [72, 61], [84, 38], [95, 6], [100, 3]]),
  ankle: pcurve([[0, 1], [8, -6], [16, -1], [30, 6], [45, 10], [55, 1], [62, -14], [68, -5], [78, 3], [90, 3], [100, 1]]),
  toe:   pcurve([[0, 12], [8, 3], [40, 3], [50, 12], [57, 32], [63, 42], [70, 18], [82, 6], [100, 12]]),
};
/* Normative sagittal joint moments in walking, N·m/kg, sign = our joint convention (Winter 2009) */
const GAIT_M = {
  hip:   pcurve([[0, -.45], [8, -.7], [18, -.35], [30, 0], [45, .5], [55, .7], [63, .3], [75, .05], [88, -.25], [100, -.45]]),
  knee:  pcurve([[0, .1], [5, -.3], [15, -.65], [28, -.1], [40, .3], [50, .15], [57, -.2], [65, -.1], [75, 0], [90, .25], [100, .1]]),
  ankle: pcurve([[0, .1], [6, .15], [12, -.05], [30, -.6], [45, -1.3], [52, -1.5], [58, -1.0], [64, -.2], [68, .05], [85, .03], [100, .1]]),
  toe:   pcurve([[0, 0], [45, -.03], [55, -.08], [62, -.04], [66, 0], [100, 0]]),
};
/* Running norms (Novacheck 1998, ~3.5 m/s), deg and N·m/kg */
const RUN = {
  hip:   pcurve([[0, 36], [15, 26], [38, -8], [50, 6], [66, 38], [85, 54], [100, 36]]),
  knee:  pcurve([[0, 20], [15, 42], [38, 18], [55, 72], [70, 104], [85, 68], [95, 26], [100, 20]]),
  ankle: pcurve([[0, 4], [15, 20], [30, 6], [38, -22], [50, -10], [70, 4], [90, 6], [100, 4]]),
  toe:   pcurve([[0, 8], [25, 5], [33, 28], [38, 40], [46, 14], [60, 5], [100, 8]]),
};
const RUN_M = {
  hip:   pcurve([[0, -1.8], [10, -1.2], [25, .5], [38, 1.2], [50, 1.4], [65, .4], [80, -.6], [92, -1.2], [100, -1.8]]),
  knee:  pcurve([[0, -.5], [12, -2.1], [25, -1.2], [38, 0], [55, .2], [80, .4], [92, .5], [100, -.5]]),
  ankle: pcurve([[0, 0], [8, -1.4], [18, -2.3], [30, -1.3], [38, 0], [100, 0]]),
  toe:   pcurve([[0, 0], [18, -.08], [34, -.06], [38, 0], [100, 0]]),
};
function gaitWeight(G, ph) {
  ph -= Math.floor(ph);
  if (G.toff > .5) { const ds = G.toff - .5; if (ph < ds) return sstep(ph / ds); if (ph < .5) return 1; if (ph < G.toff) return 1 - sstep((ph - .5) / ds); return 0; }
  const e = .03; if (ph < e) return sstep(ph / e); if (ph < G.toff - e) return 1; if (ph < G.toff) return 1 - sstep((ph - G.toff + e) / e); return 0;
}
/* body-style posture: hunch flexes the spine and pitches the pelvis; gaze keeps the head level */
function postureAdd(p, tgt) {
  const h = p.hunch || 0; tgt[J.lumbar] += h * 10 * D2R; tgt[J.thoracic] += h * 24 * D2R;
  // arms keep their world-space intent (hanging, aiming, striking) when the chest pitches forward
  const c = h * 48 * D2R * 0.9; tgt[J.shoulderN] += c; tgt[J.shoulderF] += c;
}
const hunchTilt = p => (p.hunch || 0) * 14 * D2R;
function gaitCfg(p, kind) {
  if (kind === 'run') return { kind, C: RUN, M: RUN_M, toff: .38, T: 120 / p.runCadence, stride: p.runStride, knee: p.runKnee, arm: p.runArm, lean: p.runLean, elbow: 88, soft: true,
    ms: (0.5 + 0.5 * p.runStride) * (0.6 + 0.4 * p.runCadence / 170), bob: 1 };
  return { kind: 'walk', C: GAIT, M: GAIT_M, toff: .62, T: 120 / p.walkCadence, stride: p.walkStride, knee: p.walkKnee, arm: p.walkArm, lean: p.walkLean, elbow: 14,
    ms: (0.5 + 0.5 * p.walkStride) * (0.6 + 0.4 * p.walkCadence / 108), bob: 1 };
}
function gaitTargets(p, G, ph, F, tgt) {
  const hm = G.kind === 'run' ? 20 : 8;
  for (const s of ['N', 'F']) {
    const phi = s === 'N' ? ph : ph + .5;
    tgt[J['hip' + s]] = (hm + (G.C.hip(phi) - hm) * G.stride + G.lean) * D2R + hunchTilt(p);
    const k = G.C.knee(phi); tgt[J['knee' + s]] = (k + (G.knee - 1) * Math.max(0, k - 12) + (G.stride - 1) * 6 * Math.max(0, k - 30) / 30 + (p.hunch || 0) * 8) * D2R;
    tgt[J['ankle' + s]] = G.C.ankle(phi) * (0.6 + 0.4 * G.stride) * D2R;
    tgt[J['toe' + s]] = G.C.toe(phi) * D2R;
    const sp = (G.kind === 'run' ? 2 : 4) - G.arm * Math.cos(2 * Math.PI * (phi - 0.04));
    tgt[J['shoulder' + s]] = sp * D2R;
    tgt[J['elbow' + s]] = (G.kind === 'run' ? G.elbow + 18 * Math.sin(2 * Math.PI * (phi - .3)) : 14 + 0.45 * Math.max(0, sp + 10)) * D2R;
    tgt[J['wrist' + s]] = 6 * D2R;
  }
  tgt[J.lumbar] = 2 * Math.sin(4 * Math.PI * ph) * D2R; tgt[J.thoracic] = 1 * D2R;
  postureAdd(p, tgt);
  if (F) gazeTargets(F, tgt, 4);
}
function walkTargets(p, ph, F, tgt) { gaitTargets(p, gaitCfg(p, 'walk'), ph, F, tgt); }

/* ---------------- WALK / RUN: demand-driven gait ----------------
   Target joint angles come from normative gait curves (shaped by the sliders, clamped to ROM).
   Each joint's muscle demand comes from normative sagittal moments (legs, scaled by body mass and
   speed) or from limb gravity + inertia (spine, neck, arms). When demand exceeds the joint's
   capacity (strength x force-velocity), the joint yields in the direction of the load, as weak
   joints do in clinical gait (crouch knee, collapsed push-off, drooping arms). The result is
   smoothed by a critically damped second-order filter and placed on the ground by rolling contact.
   Running adds flight phases: the body follows a ballistic arc between foot contacts. */
const YIELD = { lumbar: 14, thoracic: 10, neck: 20, head: 15, hip: 16, knee: 28, ankle: 16, toe: 10, shoulder: 30, elbow: 30, wrist: 25 };
function simGait(R, p, kind) {
  const G = gaitCfg(p, kind), T = G.T, dt = 1 / 480, recDt = 1 / 120, wf = 34;
  const st = newState(), tgt = new Float64Array(NJ), tW = new Float64Array(NJ), tA = new Float64Array(NJ), tmp = new Float64Array(NJ);
  const tiltAt = ph => (G.lean + 1.5 * Math.sin(4 * Math.PI * ph + .3)) * D2R + hunchTilt(p);
  const ms = R.M * G.ms;
  const yieldBy = new Float64Array(NJ);
  const shape = (ph, F) => {
    gaitTargets(p, G, ph, F, tgt);
    const e = 0.004, h = e * T; gaitTargets(p, G, ph + e, F, tW); gaitTargets(p, G, ph - e, F, tA);
    for (let j = 0; j < NJ; j++) { const a = tW[j], b = tA[j]; tW[j] = (a - b) / (2 * h); tA[j] = (a - 2 * tgt[j] + b) / (h * h); }
  };
  st.tilt = tiltAt(0); gaitTargets(p, G, 0, null, tgt); st.q.set(tgt);
  let F = fk(R, st); shape(0, F); st.q.set(tgt); st.w.set(tW);
  F = fk(R, st); st.y -= Math.min(minY(F.feet.N), minY(F.feet.F));
  const frames = []; let t = 0, nextRec = 2 * T, x0 = null; const tEnd = 3 * T + 1e-9;
  let minClear = Infinity, maxY = -Infinity, minYr = Infinity, vx = 0, vy = 0, air = false, flightT = 0;
  const tFlight = G.toff < .5 ? (0.5 - G.toff) * T : 0;
  while (t <= tEnd) {
    const ph = t / T;
    st.tilt = tiltAt(ph);
    F = fk(R, st);
    shape(ph, F);
    const W = { N: gaitWeight(G, ph), F: gaitWeight(G, ph + .5) };
    for (let j = 0; j < NJ; j++) {
      const jo = JOINTS[j], jt = R.jt[jo.type];
      let m;
      if (jo.side !== 'C' && G.M[jo.type]) {
        const phi = jo.side === 'N' ? ph : ph + .5; m = G.M[jo.type](phi) * ms;
        if ((jo.type === 'ankle' || jo.type === 'toe') && m < 0) m *= clamp(W[jo.side] * 2, 0, 1);
      } else { const L = jointLoad(R, F, j, null); m = L.I * tA[j] - L.tg; }
      // in cyclic gait the tendons store and return energy, so fibres shorten at roughly half the joint speed
      const cap = (m >= 0 ? jt.tPos : jt.tNeg) * Math.max(0.15, fv(0.5 * (m >= 0 ? tW[j] : -tW[j]) / jt.wmax));
      const e = Math.abs(m) / Math.max(cap, 1e-6);
      st.eff[j] = e; st.act[j] = Math.sign(m) * Math.min(e, 1); st.tq[j] = m;
      const y = e > 1 ? (1 - 1 / e) * YIELD[jo.type] * D2R : 0;
      yieldBy[j] += ((-Math.sign(m) * y) - yieldBy[j]) * Math.min(1, dt / 0.05);
      tmp[j] = clamp(tgt[j] + yieldBy[j], jt.min - 3 * D2R, jt.max + 3 * D2R);
    }
    const before = F, px = st.x, py = st.y;
    for (let j = 0; j < NJ; j++) {
      const a = tA[j] + wf * wf * (tmp[j] - st.q[j]) + 2 * wf * (tW[j] - st.w[j]);
      st.w[j] += a * dt; st.q[j] += st.w[j] * dt;
    }
    const planted = W.N > 0 || W.F > 0;
    if (planted) {
      air = false;
      let after = fk(R, st), sw = 0, dx = 0;
      for (const s of ['N', 'F']) {
        const w = W[s]; if (w <= 0) continue;
        const fa = after.feet[s], fb = before.feet[s], my = minY(fa);
        const grounded = clamp(1 - minY(fb) / 0.02, 0, 1);
        const pa = footPts(fa), pb = footPts(fb);
        let ws = 0, ddx = 0;
        for (let k = 0; k < 3; k++) { const kw = Math.exp(-(pa[k].y - my) / 0.004); ws += kw; ddx += kw * (pa[k].x - pb[k].x); }
        const we = w * grounded; dx += we * ddx / ws; sw += we;
      }
      if (sw > 1e-6) st.x -= dx / sw; else st.x += vx * dt;
      after = fk(R, st);
      let lift = -Infinity;
      for (const s of ['N', 'F']) if (W[s] > 0.02) lift = Math.max(lift, -minY(after.feet[s]));
      lift = Math.max(lift === -Infinity ? 0 : lift, -minY(after.feet.N), -minY(after.feet.F));
      st.y += G.soft ? clamp(lift, -.006, .006) : lift;
      vx += ((st.x - px) / dt - vx) * 0.05; vy = (st.y - py) / dt;
    } else {
      if (!air) { air = true; flightT = 0; vy = GRAV * tFlight / 2; }
      vy -= GRAV * dt; st.y += vy * dt; st.x += vx * dt; flightT += dt;
      const a2 = fk(R, st); const pen = Math.min(minY(a2.feet.N), minY(a2.feet.F)); if (pen < 0) st.y -= pen;
    }
    if (t >= nextRec - 1e-9) {
      const Fr = fk(R, st);
      if (x0 === null) x0 = st.x;
      const grf = [];
      for (const s of ['N', 'F']) if (W[s] > 0.01) grf.push({ x: copOf(Fr, s), f: W[s] * R.M * GRAV * (G.kind === 'run' ? 2.4 : 1) });
      frames.push(record(R, st, Fr, t - 2 * T, { grf, ph: ph % 1, phase: planted ? (W.N > .5 ? 'near stance' : 'far stance') : 'flight' }));
      for (const s of ['N', 'F']) { const lp = ((s === 'N' ? ph : ph + .5) % 1); if (lp > G.toff + .06 && lp < .95) { const m = minY(Fr.feet[s]); if (m < minClear) minClear = m; } }
      maxY = Math.max(maxY, st.y); minYr = Math.min(minYr, st.y);
      nextRec += recDt;
    }
    t += dt;
  }
  const x1 = frames[frames.length - 1].x, speed = (x1 - x0) / T;
  for (const f of frames) f.dx = f.x - (x0 + speed * f.t);
  frames.pop();
  const peak = peakEffort(frames);
  return {
    name: kind, frames, duration: T, loop: true, anchorX: 0.5, speed, endState: st,
    metrics: [
      ['Speed', speed.toFixed(2) + ' m/s'], ['Stride', (speed * T).toFixed(2) + ' m'], ['Cycle', T.toFixed(2) + ' s'],
      ['Froude no.', (speed * speed / (GRAV * (R.L.thigh + R.L.shank + R.L.footH))).toFixed(2)],
      [kind === 'run' ? 'Vertical bounce' : 'Hip bob', ((maxY - minYr) * 100).toFixed(1) + ' cm'], ['Toe clearance', (minClear * 100).toFixed(1) + ' cm'],
      ['Peak effort', peak.label],
    ],
    warn: [...(minClear < -0.002 ? ['Swing foot scuffs the ground. More knee lift or less stride helps.'] : []), ...effortWarn(peak)],
  };
}
const simWalk = (R, p) => simGait(R, p, 'walk');
function peakEffort(frames) {
  let best = 0, bj = 0;
  for (const f of frames) for (let j = 0; j < NJ; j++) if (f.eff[j] > best) { best = f.eff[j]; bj = j; }
  return { v: best, j: bj, label: `${JT[JOINTS[bj].type].name}${JOINTS[bj].side === 'C' ? '' : JOINTS[bj].side === 'N' ? ' (near)' : ' (far)'} ${Math.round(best * 100)}%` };
}
function effortWarn(pk) { return pk.v > 1.02 ? [`${JT[JOINTS[pk.j].type].name} demand exceeds strength (${Math.round(pk.v * 100)}%): the joint will buckle in a real body.`] : []; }

/* ---------------- stance-leg inverse kinematics ---------------- */
function kneeStraight(R) { return Math.max(R.jt.knee.min, 2 * D2R); }
function ankleFromBall(R, ball, beta) {
  const L = R.L, fa = -beta, c = Math.cos(fa), s = Math.sin(fa), bx = L.ballFwd, by = -L.footH;
  return { x: ball.x - (c * bx - s * by), y: ball.y - (s * bx + c * by) };
}
function legReachOK(R, hip, ball, beta) {
  const a = ankleFromBall(R, ball, beta), L = R.L, ks = kneeStraight(R);
  const dLim = Math.sqrt(L.thigh ** 2 + L.shank ** 2 + 2 * L.thigh * L.shank * Math.cos(ks));
  return Math.hypot(a.x - hip.x, a.y - hip.y) <= dLim;
}
function betaNeeded(R, hip, ball) {
  if (legReachOK(R, hip, ball, 0)) return 0;
  let lo = 0, hi = 75 * D2R;
  if (!legReachOK(R, hip, ball, hi)) return Infinity;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (legReachOK(R, hip, ball, m)) hi = m; else lo = m; }
  return hi;
}
function legIK(R, q, side, tilt, hip, ball, beta) {
  const L = R.L, a = ankleFromBall(R, ball, beta), t = L.thigh, s = L.shank, ks = kneeStraight(R);
  const dLim = Math.sqrt(t * t + s * s + 2 * t * s * Math.cos(ks));
  const dx = a.x - hip.x, dy = a.y - hip.y; let d = Math.hypot(dx, dy); d = clamp(d, 0.05, dLim);
  const A = Math.acos(clamp((t * t + d * d - s * s) / (2 * t * d), -1, 1));
  const thigh = Math.atan2(dy, dx) + A;
  const kx = hip.x + Math.cos(thigh) * t, ky = hip.y + Math.sin(thigh) * t;
  const shank = Math.atan2(a.y - ky, a.x - kx), P = Math.PI / 2 - tilt;
  q[J['hip' + side]] = wrapA(thigh - (P - Math.PI));
  q[J['knee' + side]] = wrapA(thigh - shank);
  q[J['ankle' + side]] = wrapA(-beta - shank - Math.PI / 2);
  q[J['toe' + side]] = beta;
}
/* place the hip so the whole-body COM sits over targetX (static balance) */
function balancedLegs(R, st, h, targetX, legs) {
  let hx = st.x;
  for (let it = 0; it < 4; it++) {
    st.x = hx; st.y = h;
    for (const L of legs) L.set(st, { x: hx, y: h });
    const c = fk(R, st).com.x; const err = targetX - c; hx += err; if (Math.abs(err) < 1e-4) break;
  }
  st.x = hx; st.y = h;
  for (const L of legs) L.set(st, { x: hx, y: h });
}

/* ---------------- JUMP: Alexander-style one-DOF leg-extension dynamics ---------------- */
function simJump(R, p) {
  const H = R.H, dt = 1 / 480, recDt = 1 / 120, M = R.M;
  const st = newState(), tgt = new Float64Array(NJ);
  const balls = { N: { x: .012 * H, y: 0 }, F: { x: -.012 * H, y: 0 } };
  const comX = () => (balls.N.x + balls.F.x) / 2 - 0.05 * H;
  let hStand = 0, hMin = 0, leanMax = 42 * D2R, betaFn = h => 0, maxBeta = (-R.jt.ankle.min) - 6 * D2R;
  const upperMask = new Uint8Array(NJ); ['lumbar', 'thoracic', 'neck', 'head', 'shoulderN', 'elbowN', 'wristN', 'shoulderF', 'elbowF', 'wristF'].forEach(k => upperMask[J[k]] = 1);
  const allMask = new Uint8Array(NJ).fill(1);
  const crouchFrac = h => hStand > hMin ? clamp((hStand - h) / (hStand - hMin), 0, 1) : 0;
  const legLen = R.L.thigh + R.L.shank;
  const leanAt = h => hunchTilt(p) + (p.walkLean * 0.5) * D2R + Math.min(65 * D2R, 2.3 * Math.max(0, hStand - h) / legLen);
  const legs = ['N', 'F'].map(s => ({ s, set: (st2, hip) => { const b = Math.max(betaFn(hip.y), betaNeeded(R, hip, balls[s])); legIK(R, st2.q, s, st2.tilt, hip, balls[s], Math.min(b, 75 * D2R)); } }));
  const pose = h => { st.tilt = leanAt(h); balancedLegs(R, st, h, comX(), legs); };
  // standing height: highest hip with flat feet
  st.q.fill(0); st.q[J.elbowN] = st.q[J.elbowF] = 10 * D2R; st.x = comX() - 0.0 * H;
  { hStand = .55 * H; let lo = .3 * H, hi = .75 * H; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; hStand = m; pose(m); if (st.q[J.toeN] < 1e-5 && st.q[J.toeF] < 1e-5) lo = m; else hi = m; } hStand = lo - 0.0004 * H; }
  hMin = hStand;
  const legJ = ['hipN', 'kneeN', 'ankleN', 'toeN', 'hipF', 'kneeF', 'ankleF', 'toeF'].map(k => J[k]);
  const legForce = (h, hv, act) => { // generalized force along hip height via virtual work
    const e = 0.002; pose(h); const q0 = Float64Array.from(st.q); pose(h + e); const q1 = st.q;
    let Fo = 0; const c = {};
    for (const j of legJ) {
      const jt = R.jt[JOINTS[j].type]; const cj = clamp((q1[j] - q0[j]) / e, -30, 30); c[j] = cj;
      if (Math.abs(cj) < 1e-6) continue;
      const cap = cj > 0 ? jt.tPos : jt.tNeg; const v = Math.abs(cj) * hv / jt.wmax;
      Fo += cap * Math.abs(cj) * fv(v) * act;
    }
    pose(h); return { F: Fo, c };
  };
  // deepest feasible crouch (ROM + strength)
  const okROM = () => { for (const j of legJ) { const jt = R.jt[JOINTS[j].type]; if (st.q[j] > jt.max + 1e-3 || st.q[j] < jt.min - 4 * D2R) return false; } return true; };
  hMin = hStand - 0.02 * H; // provisional for leanAt
  let limitBy = 'range of motion';
  { let h = hStand, last = hStand; const hm0 = hStand * 0.42; hMin = hm0;
    for (h = hStand; h > hm0; h -= 0.004) {
      pose(h); if (!okROM()) { if (typeof process!=="undefined"&&process.env.DBG) console.log("ROMfail", h.toFixed(3), hStand.toFixed(3), legJ.map(j=>JOINTS[j].id+":"+(st.q[j]*R2D).toFixed(1)).join(" ")); break; }
      const { F } = legForce(h, 0, 1); if (F < 1.12 * M * GRAV) { limitBy = 'strength'; break; }
      last = h;
    }
    if (h <= hm0) limitBy = 'depth cap';
    hMin = last; }
  const hC = hStand - clamp(p.jumpDepth / 100, 0.05, 1) * (hStand - hMin);
  // highest reachable hip (knee straight, ankle at plantar limit)
  let hTO = hStand;
  { for (let h = hStand; h < hStand + .25 * H; h += 0.002) { const b = betaNeeded(R, { x: comX() + 0.02 * H, y: h }, balls.N); if (!isFinite(b) || b > maxBeta) break; hTO = h; } }
  const frames = [], effMax = p.jumpEffort / 100, eff = new Float64Array(NJ);
  let phase = 'idle', t = 0, t0 = 0, h = hStand, hv = 0, act = 0, nextRec = 0, ddh = 0;
  let prevCom = null, comB = null, hFrom = 0, hTd = 0, betaTd = 0, blend = 0, qBlend = null, hard = false, takeoffV = 0, peakCom = -Infinity, comStand = 0, landF = 0, peakPow = 0, landDepthAct = 0, airT = 0, tTO = 0;
  const Tcm = 0.22 + 0.42 * clamp(p.jumpDepth / 100, 0, 1);
  const armT = { idle: [0, 10], down: [-45, 15], push: [p.jumpArms, 20], flight: [p.jumpArms * .75, 25], land: [35, 35], up: [5, 12], end: [0, 10] };
  const hStop = hStand - clamp(p.jumpLand / 100, 0.1, 1) * (hStand - hMin);
  pose(hStand); comStand = fk(R, st).com.y;
  const setUpper = (F) => {
    const [sh, el] = armT[phase] || armT.idle; const lean = st.tilt;
    for (const s of ['N', 'F']) { tgt[J['shoulder' + s]] = (sh + (s === 'F' ? -4 : 0)) * D2R; tgt[J['elbow' + s]] = el * D2R; tgt[J['wrist' + s]] = 5 * D2R; }
    const c = phase === 'flight' ? 0.4 * p.jumpTuck / 100 : crouchFrac(h);
    const ln = phase === 'flight' ? 0.4 * leanMax * c : st.tilt - hunchTilt(p) - (p.walkLean * 0.5) * D2R; tgt[J.lumbar] = 0.25 * ln; tgt[J.thoracic] = 0.12 * ln; postureAdd(p, tgt);
    gazeTargets(F, tgt, 6);
  };
  const flightTargets = (rising) => {
    const tk = p.jumpTuck / 100;
    for (const s of ['N', 'F']) {
      if (rising) { tgt[J['hip' + s]] = (10 + 70 * tk) * D2R; tgt[J['knee' + s]] = (8 + 90 * tk) * D2R; tgt[J['ankle' + s]] = -28 * D2R; tgt[J['toe' + s]] = 0; }
      else { tgt[J['hip' + s]] = 24 * D2R; tgt[J['knee' + s]] = 18 * D2R; tgt[J['ankle' + s]] = -22 * D2R; tgt[J['toe' + s]] = 8 * D2R; }
    }
  };
  pose(hStand);
  const tMax = 6;
  while (t < tMax) {
    let F = fk(R, st);
    if (phase !== 'flight') {
      // stance phases: legs follow the 1-DOF path
      if (phase === 'idle') { h = hStand; hv = 0; ddh = 0; act = 0.15; if (t > 0.18) { phase = 'down'; t0 = t; } }
      else if (phase === 'down') {
        const u = (t - t0) / Tcm, hn = lerp(hStand, hC, mjerk(u)); const nv = (hn - h) / dt; ddh = (nv - hv) / dt; hv = nv; h = hn;
        if (u >= 1) { phase = 'push'; t0 = t; act = 0.25; hv = 0; }
      } else if (phase === 'push') {
        act += (effMax - act) * Math.min(1, dt / R.tAct);
        const { F: Fl } = legForce(h, hv, act); ddh = Fl / M - GRAV; hv += ddh * dt; h += hv * dt;
        peakPow = Math.max(peakPow, Fl * hv);
        pose(h);
        if (h >= hTO || st.q[J.toeN] >= maxBeta || st.q[J.toeF] >= maxBeta) {
          F = fk(R, st);
          const { c } = legForce(h - 0.003, hv, act); pose(h);
          const ce = fk(R, st).com;
          const vy = prevCom ? (ce.y - prevCom.y) / dt : hv;
          comB = { x: ce.x, y: ce.y, vx: 0, vy }; takeoffV = vy; tTO = t;
          for (const j of legJ) st.w[j] = (c[j] || 0) * hv;
          phase = 'flight'; t0 = t;
        }
      } else if (phase === 'land') {
        const rem = Math.max(h - hStop, 0.004 * H);
        const aReq = hv < 0 ? hv * hv / (2 * rem) : 0;
        const need = M * (GRAV + aReq);
        const { F: cap } = legForce(h, hv, 1);
        const Fa = Math.min(need, cap * effMax * 1.0);
        landF = Math.max(landF, Fa);
        ddh = Fa / M - GRAV; hv += ddh * dt; h += hv * dt;
        if (h <= hMin) { h = hMin; if (hv < -0.3) hard = true; hv = 0; }
        if (hv >= -0.04 || h <= hStop + 0.002) { hv = 0; phase = 'up'; t0 = t; hFrom = h; landDepthAct = hTd - h; betaFn = () => 0; }
      } else if (phase === 'up') {
        const u = (t - t0) / 0.6, hn = lerp(hFrom, hStand, mjerk(u)); const nv = (hn - h) / dt; ddh = (nv - hv) / dt; hv = nv; h = hn;
        if (u >= 1) { phase = 'end'; t0 = t; }
      } else if (phase === 'end') { h = hStand; hv = 0; ddh = 0; if (t - t0 > 0.25) break; }
      const prevQ = Float64Array.from(st.q);
      pose(h);
      if (blend > 0) { const k = 1 - sstep(blend / 0.06); for (const j of legJ) st.q[j] = lerp(qBlend[j], st.q[j], 1 - (1 - k)); blend -= dt; if (blend <= 0) blend = 0; }
      for (const j of legJ) st.w[j] = (st.q[j] - prevQ[j]) / dt;
      F = fk(R, st);
      setUpper(F);
      servoStep(R, st, F, tgt, upperMask, null, dt, 1);
      // leg effort (shared demand / capacity)
      const fyTot = M * (GRAV + ddh);
      const { F: capNow } = (phase === 'push' || phase === 'land') ? legForce(h, hv, 1) : legForce(h, 0, 1);
      const r = capNow > 1 ? Math.max(0, fyTot) / capNow : 0;
      const rr = phase === 'push' ? act : Math.min(r, 1.5);
      for (const j of legJ) { st.eff[j] = rr; st.act[j] = rr; }
      F = fk(R, st); prevCom = { x: F.com.x, y: F.com.y };
      if (t >= nextRec - 1e-9) {
        frames.push(record(R, st, F, t, { grf: [{ x: copOf(F, 'N'), f: Math.max(0, fyTot) / 2 }, { x: copOf(F, 'F'), f: Math.max(0, fyTot) / 2 }], phase }));
        nextRec += recDt;
      }
    } else {
      // flight: COM is ballistic, every joint is muscle-driven
      const rising = comB.vy > -0.4;
      flightTargets(rising); setUpper(F);
      st.tilt = lerp(st.tilt, (p.walkLean * 0.5 + 4 + 10 * p.jumpTuck / 100 * (rising ? 1 : 0.3)) * D2R, Math.min(1, dt / 0.08));
      servoStep(R, st, F, tgt, allMask, null, dt, 1);
      comB.vy -= GRAV * dt; comB.y += comB.vy * dt; comB.x += comB.vx * dt;
      F = fk(R, st); st.x += comB.x - F.com.x; st.y += comB.y - F.com.y; F = fk(R, st);
      peakCom = Math.max(peakCom, comB.y); airT = t - tTO;
      const lowest = Math.min(minY(F.feet.N), minY(F.feet.F));
      if (lowest <= 0 && comB.vy < 0) {
        st.y -= lowest; F = fk(R, st);
        balls.N = { x: F.feet.N.ball.x, y: 0 }; balls.F = { x: F.feet.F.ball.x, y: 0 };
        const fN = F.S[SI.footN]; betaTd = clamp(-fN.a, 0, 60 * D2R); hTd = st.y;
        betaFn = hh => betaTd * clamp((hh - (hTd - 0.05 * H)) / (0.05 * H), 0, 1);
        h = st.y; hv = comB.vy; qBlend = Float64Array.from(st.q); blend = 0.06;
        phase = 'land'; t0 = t;
      }
      if (t >= nextRec - 1e-9) { frames.push(record(R, st, F, t, { grf: [], phase })); nextRec += recDt; }
    }
    t += dt;
  }
  const jumpH = peakCom - comStand;
  const peak = peakEffort(frames.filter(f => f.phase !== 'flight'));
  const warn = [];
  if (hard) warn.push('Hard landing: the legs ran out of range of motion before absorbing the impact.');
  if (limitBy === 'strength') warn.push('Crouch depth is limited by leg strength, not joint range.');
  return {
    name: 'jump', frames, duration: frames.length * recDt, loop: false, anchorX: 0.5,
    metrics: [
      ['Jump height (COM)', (jumpH * 100).toFixed(1) + ' cm'], ['Take-off velocity', takeoffV.toFixed(2) + ' m/s'],
      ['Airtime', airT.toFixed(2) + ' s'], ['Peak leg power', (peakPow / M).toFixed(1) + ' W/kg'],
      ['Crouch limit', `${((hStand - hMin) * 100).toFixed(0)} cm (${limitBy})`],
      ['Landing peak force', (landF / (M * GRAV)).toFixed(1) + ' × body weight'], ['Landing absorb', (landDepthAct * 100).toFixed(0) + ' cm'],
    ],
    warn,
  };
}

/* ---------------- MOVES: choreography scripts run through the same muscles ----------------
   A script is a list of phases. Each phase blends joint targets (deg) and whole-body intent:
   wf = weight on the near foot (0..1), cr = crouch (×height), lean = pelvis pitch (deg), yaw = body
   turn (deg). Legs are 'stance' (inverse kinematics to a planted footprint, hips placed so the COM
   sits over the support), 'swing' (muscle-driven) or 'plant' (muscle-driven back onto a footprint).
   launch = {vx, vy} m/s throws the body into ballistic flight (scaled by leg power); land / ground
   end the phase on touchdown; roll = {to} pitches the whole body around its contact with the floor. */
const MOVES = [
  ['walk', 'Walk', 'Locomotion'], ['run', 'Run', 'Locomotion'], ['jump', 'Jump', 'Locomotion'], ['runjump', 'Running jump', 'Locomotion'],
  ['turn', 'Turn around', 'Locomotion'], ['roll', 'Dive roll', 'Locomotion'],
  ['punch', 'Punch', 'Fighting'], ['kick', 'Front kick', 'Fighting'], ['overhead', 'Overhead smash', 'Fighting'], ['fire', 'Fire weapon', 'Fighting'],
  ['palm', 'Palm strike', 'Kung fu'], ['sidekick', 'Side kick', 'Kung fu'], ['flyknee', 'Flying knee', 'Kung fu'], ['sweep', 'Spinning sweep', 'Kung fu'], ['flurry', 'Chain punches', 'Kung fu'],
  ['dance', 'Victory dance', 'Emote'],
  ['hurt', 'Hit reaction', 'Reactions'], ['knockdown', 'Knocked down', 'Reactions'], ['block', 'Block', 'Reactions'],
  ['uppercut', 'Rising uppercut', 'Specials'], ['hadouken', 'Energy blast', 'Specials'], ['spinkick', 'Hurricane kick', 'Specials'],
];
const MOVE_NAME = Object.fromEntries(MOVES.map(m => [m[0], m[1]]));
const STAND = { shoulderN: 4, elbowN: 14, wristN: 4, shoulderF: 2, elbowF: 14, wristF: 4, lumbar: 0, thoracic: 0 };
const GUARD = { shoulderN: 52, elbowN: 122, wristN: 0, shoulderF: 40, elbowF: 128, wristF: 0, lumbar: 4, thoracic: 4 };
const LEGREST = { hipN: 20, kneeN: 30, ankleN: 0, toeN: 0, hipF: 20, kneeF: 30, ankleF: 0, toeF: 0 };
function moveScript(p, id) {
  const w = p.atkWind / 100, rc = p.atkRecover, E = p.danceEnergy || 1;
  const G = o => Object.assign({}, GUARD, o || {}), S = o => Object.assign({}, STAND, o || {});
  const fight = { stance: { N: .12, F: -.15 }, anchorX: .4 };
  switch (id) {
    case 'kick': return { ...fight, anchorX: .36, hit: 'toesN', phases: [
      { n: 'guard', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'shift', d: .28, wf: 0, cr: .04, lean: 3 },
      { n: 'chamber', d: .22 + .12 * w, tg: { hipN: 92, kneeN: 118, ankleN: -12, toeN: 0, shoulderN: 45, shoulderF: 30 }, wf: 0, cr: .045, lean: -2 - 4 * w, legs: { N: 'swing' } },
      { n: 'strike', strike: 1, d: .4, snap: 1, until: ['kneeN'], tg: { hipN: 98, kneeN: 3, ankleN: 14, toeN: 45, lumbar: -6, shoulderN: 30, shoulderF: 20, elbowN: 110 }, cr: .05, lean: -12 },
      { n: 'impact', strike: 1, d: .06 },
      { n: 'retract', d: .22 * rc, tg: { hipN: 90, kneeN: 112, ankleN: -8, toeN: 5, lumbar: 4 }, lean: -2 },
      { n: 'plant', d: .38 * rc, tg: G(), cr: .04, lean: 3, legs: { N: 'plant' } },
      { n: 'shift back', d: .28 * rc, wf: .45, cr: .035, lean: 6 },
      { n: 'guard', d: .2 },
    ] };
    case 'overhead': return { ...fight, hit: 'handN', phases: [
      { n: 'guard', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'raise', d: .35 + .25 * w, tg: { shoulderN: 150 + 18 * w, elbowN: 95, wristN: -25, shoulderF: 145 + 18 * w, elbowF: 100, wristF: -25, lumbar: -6 - 8 * w, thoracic: -4 - 6 * w }, wf: .35, cr: .03, lean: 2 - 6 * w },
      { n: 'strike', strike: 1, d: .5, snap: 1, until: ['shoulderN'], tg: { shoulderN: 22, elbowN: 8, wristN: 12, shoulderF: 18, elbowF: 12, wristF: 12, lumbar: 28, thoracic: 16 }, wf: .66, cr: .09, lean: 20 },
      { n: 'impact', strike: 1, d: .08 },
      { n: 'recover', d: .45 * rc, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'guard', d: .2 },
    ] };
    case 'fire': {
      const rifle = p.weapon === 'rifle';
      const aim = rifle ? { shoulderN: 58, elbowN: 96, wristN: -12, shoulderF: 84, elbowF: 22, wristF: -10, lumbar: 2, thoracic: 2 } : { shoulderN: 88, elbowN: 4, wristN: 0, shoulderF: 80, elbowF: 32, wristF: 0, lumbar: 2, thoracic: 2 };
      const kick = rifle ? { shoulderN: 52, elbowN: 102, wristN: -16, shoulderF: 90, elbowF: 26 } : { shoulderN: 96, elbowN: 24, wristN: -22, shoulderF: 86, elbowF: 40 };
      const ph = [
        { n: 'ready', d: .25, tg: S(), wf: .5, cr: .02, lean: 3 },
        { n: 'raise', d: .3, tg: aim, wf: .58, cr: .045, lean: rifle ? 6 : 4 },
        { n: 'aim', d: .18 },
      ];
      const shots = Math.round(p.shots || 3);
      for (let i = 0; i < shots; i++) ph.push({ n: 'fire', d: .05, snap: 1, flash: 1, tg: kick, lean: rifle ? 2 : 4 }, { n: 'recoil', d: rifle ? .16 : .13, tg: aim, lean: rifle ? 6 : 4 });
      ph.push({ n: 'hold', d: .18 }, { n: 'lower', d: .35, tg: S(), wf: .5, cr: .02, lean: 3 });
      return { stance: { N: .08, F: -.1 }, anchorX: .38, weapon: p.weapon, hit: null, phases: ph };
    }
    case 'palm': return { ...fight, hit: 'handN', phases: [
      { n: 'guard', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'coil', d: .14 + .1 * w, tg: { shoulderN: 20, elbowN: 135, wristN: -60, shoulderF: 55, elbowF: 110, lumbar: 0 }, wf: .35, cr: .05, lean: 4 },
      { n: 'step', d: .16, tg: {}, wf: .2, legs: { N: 'plant' }, step: { side: 'N', dx: .1 }, cr: .06 },
      { n: 'strike', strike: 1, d: .35, snap: 1, until: ['elbowN'], tg: { shoulderN: 84, elbowN: 3, wristN: -68, shoulderF: 15, elbowF: 125, lumbar: 8, thoracic: 6 }, wf: .7, cr: .08, lean: 12 },
      { n: 'impact', strike: 1, d: .1 },
      { n: 'recover', d: .4 * rc, tg: G(), wf: .45, cr: .045, lean: 6 },
      { n: 'guard', d: .2 },
    ] };
    case 'sidekick': return { ...fight, anchorX: .34, hit: 'footN', phases: [
      { n: 'guard', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'shift', d: .25, wf: 0, cr: .045, lean: 0 },
      { n: 'chamber', d: .22 + .1 * w, tg: { hipN: 100, kneeN: 132, ankleN: 12, toeN: 0, shoulderN: 40, elbowN: 115, shoulderF: 60, elbowF: 100 }, cr: .05, lean: -14, legs: { N: 'swing' } },
      { n: 'strike', strike: 1, d: .4, snap: 1, until: ['kneeN'], tg: { hipN: 96, kneeN: 2, ankleN: 18, toeN: 20, lumbar: -14, thoracic: -6, shoulderN: 25, elbowN: 95, shoulderF: 70, elbowF: 60 }, cr: .06, lean: -36 },
      { n: 'impact', strike: 1, d: .1 },
      { n: 'retract', d: .22 * rc, tg: { hipN: 98, kneeN: 125, ankleN: 5, lumbar: 2, thoracic: 2 }, lean: -10 },
      { n: 'plant', d: .38 * rc, tg: G(), cr: .04, lean: 3, legs: { N: 'plant' } },
      { n: 'shift back', d: .26 * rc, wf: .45, cr: .035, lean: 6 },
      { n: 'guard', d: .2 },
    ] };
    case 'flyknee': return { ...fight, travel: 1, hit: 'thighN', phases: [
      { n: 'guard', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'load', d: .2 + .1 * w, tg: { shoulderN: -25, elbowN: 40, shoulderF: -30, elbowF: 40 }, wf: .5, cr: .12, lean: 18 },
      { n: 'launch', strike: 1, d: .5, launch: { vx: 1.3, vy: 2.5 }, land: 1, tg: { hipN: 122, kneeN: 142, ankleN: -25, hipF: -6, kneeF: 45, ankleF: -30, shoulderN: 125, elbowN: 85, shoulderF: 135, elbowF: 75, lumbar: 6 }, lean: 6 },
      { n: 'descend', d: .4, land: 1, tg: { hipN: 50, kneeN: 45, ankleN: -15, hipF: 30, kneeF: 20, ankleF: -15, shoulderN: 60, elbowN: 110, shoulderF: 50, elbowF: 115 }, lean: 6, minT: .12 },
      { n: 'land', d: .25, tg: G(), cr: .1, lean: 10, legs: { N: 'stance', F: 'stance' } },
      { n: 'recover', d: .4 * rc, wf: .45, cr: .035, lean: 6 },
      { n: 'guard', d: .15 },
    ] };
    case 'sweep': return { ...fight, anchorX: .5, hit: 'footN', phases: [
      { n: 'guard', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'drop', d: .32, tg: { hipN: 98, kneeN: 4, ankleN: 10, toeN: 10, shoulderN: 60, elbowN: 35, shoulderF: 85, elbowF: 15, lumbar: 10, thoracic: 8 }, wf: 0, cr: .27, lean: 26, legs: { N: 'swing' } },
      { n: 'spin', strike: 1, d: .42 / Math.sqrt(Math.max(.3, p.strength)), yaw: 360, linYaw: 1 },
      { n: 'rise', d: .4 * rc, tg: G(), cr: .04, lean: 6, legs: { N: 'plant' } },
      { n: 'settle', d: .25, wf: .45, cr: .035 },
    ] };
    case 'flurry': {
      const ph = [{ n: 'guard', d: .3, tg: G({ shoulderN: 45, elbowN: 105, shoulderF: 50, elbowF: 100, wristN: -5, wristF: -5 }), wf: .5, cr: .05, lean: 5 }];
      const n = 6;
      for (let i = 0; i < n; i++) {
        const near = i % 2 === 0;
        ph.push({ n: near ? 'near punch' : 'far punch', strike: near ? 1 : 0, d: .15, snap: 1, tg: near ? { shoulderN: 84, elbowN: 4, shoulderF: 46, elbowF: 112 } : { shoulderF: 86, elbowF: 6, shoulderN: 46, elbowN: 112 }, lean: 7, wf: .55 });
      }
      ph.push({ n: 'recover', d: .35 * rc, tg: G(), wf: .45, cr: .035, lean: 6 }, { n: 'guard', d: .15 });
      return { ...fight, stance: { N: .1, F: -.12 }, hit: 'handN', phases: ph };
    }
    case 'dance': {
      const b = .26 / E, A = Math.min(1.4, .7 + .3 * E);
      return { stance: { N: .07, F: -.07 }, anchorX: .5, loop: 1, loopStart: 1, phases: [
        { n: 'stand', d: .2, tg: S(), wf: .5, cr: .02, lean: 3 },
        { n: 'pump near', d: b, tg: { shoulderN: 172 * A > 175 ? 175 : 165, elbowN: 20, wristN: -10, shoulderF: 10, elbowF: 95, lumbar: -4, thoracic: -2 }, wf: .7, cr: .06 * A, lean: 2 },
        { n: 'down', d: b, tg: { shoulderN: 120, elbowN: 75 }, wf: .55, cr: .015 },
        { n: 'pump far', d: b, tg: { shoulderF: 165, elbowF: 20, wristF: -10, shoulderN: 10, elbowN: 95 }, wf: .3, cr: .06 * A, lean: 2 },
        { n: 'down', d: b, tg: { shoulderF: 120, elbowF: 75 }, wf: .45, cr: .015 },
        { n: 'arms up', d: b, tg: { shoulderN: 160, elbowN: 25, shoulderF: 158, elbowF: 25, lumbar: -10, thoracic: -6 }, wf: .5, cr: .07 * A, lean: -4 },
        { n: 'hop', d: .5, launch: { vx: 0, vy: 1.3 * A }, land: 1, minT: .05, tg: { shoulderN: 170, elbowN: 10, shoulderF: 168, elbowF: 10, hipN: 25, kneeN: 40, hipF: 20, kneeF: 35, ankleN: -20, ankleF: -20 }, lean: -2 },
        { n: 'land', d: b, tg: { shoulderN: 130, elbowN: 70, shoulderF: 128, elbowF: 70, lumbar: 4, thoracic: 2 }, cr: .08, wf: .5, lean: 6, legs: { N: 'stance', F: 'stance' } },
        { n: 'reset', d: b, tg: { shoulderN: 90, elbowN: 60, shoulderF: 30, elbowF: 95, lumbar: -2, thoracic: -2 }, cr: .02, lean: 2 },
      ] };
    }
    case 'turn': return { stance: { N: .05, F: -.05 }, anchorX: .5, phases: [
      { n: 'stand', d: .25, tg: S(), wf: .5, cr: .02, lean: 3 },
      { n: 'wind', d: .12, tg: S({ shoulderN: 20, shoulderF: -10, elbowN: 40 }), cr: .05, wf: .6, yaw: -12 },
      { n: 'pivot', d: .42, tg: S({ shoulderN: -15, shoulderF: 25, elbowF: 40, elbowN: 25 }), cr: .045, wf: .4, yaw: 180 },
      { n: 'settle', d: .3, tg: S(), cr: .02, wf: .5, lean: 3 },
    ] };
    case 'roll': return { stance: { N: .05, F: -.05 }, anchorX: .5, travel: 1, phases: [
      { n: 'stand', d: .22, tg: S(), wf: .5, cr: .02, lean: 3 },
      { n: 'crouch', d: .26, tg: S({ shoulderN: 60, shoulderF: 55, elbowN: 25, elbowF: 25, lumbar: 10, thoracic: 6 }), wf: .75, cr: .16, lean: 40 },
      { n: 'dive', d: .6, launch: { vx: 2.3, vy: 1.4 }, ground: 1, minT: .08, tg: { shoulderN: 150, elbowN: 8, shoulderF: 145, elbowF: 10, hipN: 5, kneeN: 10, hipF: 0, kneeF: 15, ankleN: -30, ankleF: -30, lumbar: 4, thoracic: 0 }, lean: 85, gaze: 0 },
      { n: 'roll', d: .62, roll: { to: 360 }, tg: { hipN: 125, kneeN: 145, ankleN: -20, hipF: 125, kneeF: 145, ankleF: -20, lumbar: 45, thoracic: 30, neck: 35, head: 15, shoulderN: 70, elbowN: 115, shoulderF: 65, elbowF: 115 }, gaze: 0 },
      { n: 'rise', d: .3, tg: S({ shoulderN: 70, shoulderF: 60, elbowN: 40, elbowF: 40, lumbar: 10, thoracic: 8 }), cr: .22, lean: 35, wf: .5, legs: { N: 'stance', F: 'stance' } },
      { n: 'stand', d: .45, tg: S(), cr: .02, lean: 3 },
    ] };
    // ---- added for The Feed's brawler: reactions and special moves
    case 'hurt': return { ...fight, hit: null, phases: [
      { n: 'guard', d: .1, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'impact', d: .1, snap: 1, tg: { neck: -38, head: -15, lumbar: -20, thoracic: -14, shoulderN: 18, elbowN: 55, shoulderF: -12, elbowF: 45 }, wf: .2, cr: .05, lean: -20 },
      { n: 'reel', d: .24, tg: { neck: -18, lumbar: -10, thoracic: -6, shoulderN: 35, elbowN: 95, shoulderF: 28, elbowF: 95 }, wf: .3, cr: .06, lean: -10 },
      { n: 'recover', d: .3, tg: G(), wf: .45, cr: .035, lean: 6 },
    ] };
    case 'knockdown': return { ...fight, travel: 1, hit: null, phases: [
      { n: 'impact', d: .1, snap: 1, tg: { neck: -40, lumbar: -25, thoracic: -15, shoulderN: 60, elbowN: 30, shoulderF: 50, elbowF: 20 }, wf: .1, lean: -25 },
      { n: 'fly', d: .6, launch: { vx: -1.5, vy: 1.7 }, ground: 1, minT: .1, tg: { hipN: 45, kneeN: 70, hipF: 25, kneeF: 35, shoulderN: 125, elbowN: 25, shoulderF: 115, elbowF: 35, neck: -25 }, lean: -82, gaze: 0 },
      { n: 'down', d: .9, tg: { hipN: 12, kneeN: 18, hipF: 6, kneeF: 12, shoulderN: 100, elbowN: 15, shoulderF: 92, elbowF: 12, neck: 5, lumbar: 0, thoracic: 0 }, lean: -88, gaze: 0 },
    ] };
    case 'block': return { ...fight, hit: null, phases: [
      { n: 'guard', d: .15, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'brace', d: .22, tg: { shoulderN: 72, elbowN: 150, wristN: -20, shoulderF: 66, elbowF: 150, wristF: -20, lumbar: 8, thoracic: 6, neck: 18 }, wf: .35, cr: .09, lean: 2 },
      { n: 'hold', d: .45 },
    ] };
    case 'uppercut': return { ...fight, travel: 1, hit: 'handN', phases: [
      { n: 'guard', d: .22, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'crouch', d: .18, tg: { shoulderN: 28, elbowN: 140, wristN: -10, shoulderF: 45, elbowF: 120, lumbar: 10, thoracic: 6 }, wf: .55, cr: .2, lean: 14 },
      { n: 'rise', strike: 1, d: .45, snap: 1, launch: { vx: .5, vy: 2.5 }, land: 1, tg: { shoulderN: 170, elbowN: 12, wristN: 0, shoulderF: 30, elbowF: 125, hipN: 62, kneeN: 95, ankleN: -20, hipF: -6, kneeF: 18, lumbar: -10, thoracic: -6 }, lean: -4 },
      { n: 'descend', d: .38, land: 1, minT: .1, tg: { hipN: 40, kneeN: 50, hipF: 22, kneeF: 30, shoulderN: 120, elbowN: 60, shoulderF: 60, elbowF: 90 }, lean: 4 },
      { n: 'land', d: .24, tg: G(), cr: .1, lean: 8, legs: { N: 'stance', F: 'stance' } },
      { n: 'guard', d: .15 },
    ] };
    case 'hadouken': return { ...fight, hit: 'handN', phases: [
      { n: 'guard', d: .22, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'gather', d: .3, tg: { shoulderN: 18, elbowN: 140, wristN: -60, shoulderF: 24, elbowF: 135, wristF: -60, lumbar: -4, thoracic: -2 }, wf: .3, cr: .13, lean: -6 },
      { n: 'thrust', strike: 1, d: .28, snap: 1, until: ['elbowN'], tg: { shoulderN: 86, elbowN: 4, wristN: -70, shoulderF: 82, elbowF: 8, wristF: -70, lumbar: 10, thoracic: 6 }, wf: .72, cr: .11, lean: 16, step: { side: 'N', dx: .08 }, legs: { N: 'plant' } },
      { n: 'hold', strike: 1, d: .25 },
      { n: 'recover', d: .35, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'guard', d: .15 },
    ] };
    case 'spinkick': return { ...fight, travel: 1, hit: 'footN', phases: [
      { n: 'guard', d: .22, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'hop', d: .18, tg: { hipN: 30, kneeN: 60, shoulderN: 70, shoulderF: 70 }, cr: .14, lean: 4 },
      { n: 'spin', strike: 1, d: .8, launch: { vx: .9, vy: 1.6 }, land: 1, yaw: 720, linYaw: 1, tg: { hipN: 92, kneeN: 4, ankleN: 10, hipF: 40, kneeF: 90, shoulderN: 90, elbowN: 10, shoulderF: 90, elbowF: 10 }, lean: -8 },
      { n: 'land', d: .26, tg: G(), cr: .1, lean: 8, legs: { N: 'stance', F: 'stance' } },
      { n: 'guard', d: .2 },
    ] };
    default: return { ...fight, hit: 'handN', phases: [
      { n: 'guard', d: .32, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'wind-up', d: .08 + .14 * w, tg: { shoulderN: 50 - 30 * w, elbowN: 128, lumbar: 4 - 6 * w }, wf: .42 - .1 * w, lean: 6 - 4 * w },
      { n: 'strike', strike: 1, d: .4, snap: 1, until: ['shoulderN', 'elbowN'], tg: { shoulderN: 88, elbowN: 3, wristN: -4, shoulderF: 32, elbowF: 125, lumbar: 10, thoracic: 8 }, wf: .62, cr: .045, lean: 13 },
      { n: 'impact', strike: 1, d: .07 },
      { n: 'recover', d: .34 * rc, tg: G(), wf: .45, cr: .035, lean: 6 },
      { n: 'guard', d: .2 },
    ] };
  }
}
/* sample points with body thickness, for floor contact when not standing on the feet */
function bodyContactLow(R, F) {
  const H = R.H; let lo = Infinity;
  const chk = (x, y, r) => { const v = y - r; if (v < lo) lo = v; };
  for (let i = 0; i < F.S.length; i++) {
    const g = F.S[i], n = SEGS[i];
    const r = (n === 'pelvis' || n === 'abdomen' || n === 'thorax') ? .055 * H : n === 'head' ? .055 * H * R.p.headL : n.startsWith('thigh') ? .035 * H : .02 * H;
    chk(g.ox, g.oy, r); chk(g.ex, g.ey, r); chk((g.ox + g.ex) / 2, (g.oy + g.ey) / 2, r);
  }
  for (const s of ['N', 'F']) for (const p of footPts(F.feet[s])) chk(p.x, p.y, 0);
  return lo;
}
function legPower(R) { // leg extensor torque per body weight, relative to the reference adult
  const ref = (240 + 230 + 200) / (75 * GRAV);
  return clamp(Math.sqrt(((R.jt.knee.tNeg + R.jt.hip.tNeg + R.jt.ankle.tNeg) / (R.M * GRAV)) / ref), .55, 1.4);
}

function simScript(R, p, id, init, scOverride) {
  const H = R.H, dt = 1 / 480, recDt = 1 / 120, M = R.M;
  const sc = scOverride || moveScript(p, id);
  const effMax = clamp((id === 'dance' || id === 'turn' || id === 'roll' || id === 'fire' || id === 'runjump') ? 1 : p.atkEffort / 100, .1, 1);
  const st = newState(), tgt = new Float64Array(NJ);
  const anchors = { N: { x: sc.stance.N * H, y: 0 }, F: { x: sc.stance.F * H, y: 0 } };
  const legMode = { N: 'stance', F: 'stance' };
  const plantFrom = { N: null, F: null };
  const cop = s => anchors[s].x - .045 * H;
  const LEGJ = { N: ['hipN', 'kneeN', 'ankleN', 'toeN'].map(k => J[k]), F: ['hipF', 'kneeF', 'ankleF', 'toeF'].map(k => J[k]) };
  const LEG = {};
  for (const s of ['N', 'F']) LEG[s] = { s, set: (s2, hip) => legIK(R, s2.q, s, s2.tilt, hip, anchors[s], Math.min(betaNeeded(R, hip, anchors[s]), 70 * D2R)) };
  const hCache = {};
  const standH = () => {
    const sup = ['N', 'F'].filter(s => legMode[s] === 'stance');
    const key = sup.map(s => s + anchors[s].x.toFixed(4)).join('|');
    if (hCache[key] !== undefined) return hCache[key];
    let lo = .3 * H, hi = .75 * H;
    const cx = sup.length ? sup.reduce((a, s) => a + cop(s), 0) / sup.length + .02 * H : 0;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; const hip = { x: cx, y: m }; if (sup.every(s => legReachOK(R, hip, anchors[s], 8 * D2R))) lo = m; else hi = m; }
    return hCache[key] = lo;
  };
  // expand loops: record the second pass of the loop body
  let phases = sc.phases, recStartPhase = 0;
  if (sc.loop) { const intro = phases.slice(0, sc.loopStart), body = phases.slice(sc.loopStart); phases = [...intro, ...body, ...body]; recStartPhase = intro.length + body.length; }
  const ph0 = phases[0];
  const curTg = Object.assign({}, LEGREST, ph0.tg || {});
  const curPar = { wf: ph0.wf ?? .5, cr: ph0.cr ?? .03, lean: ph0.lean ?? 3, yaw: ph0.yaw ?? 0 };
  let mode = 'stance', tiltOff = 0;
  if (init) {
    st.q.set(init.q); st.w.set(init.w); st.x = init.x; st.y = init.y; st.tilt = init.tilt; mode = 'air';
    curPar.lean = (init.tilt - hunchTilt(p)) * R2D;
  } else {
    for (const k in curTg) st.q[J[k]] = curTg[k] * D2R;
    st.tilt = curPar.lean * D2R + hunchTilt(p); st.x = (cop('N') + cop('F')) / 2;
    balancedLegs(R, st, standH() - curPar.cr * H, lerp(cop('F'), cop('N'), curPar.wf), [LEG.N, LEG.F]);
    { const F = fk(R, st); tgt.set(st.q); postureAdd(p, tgt); gazeTargets(F, tgt, 5); st.q.set(tgt); }
  }
  let prevTg = Object.assign({}, curTg), prev = Object.assign({}, curPar);
  let pi = 0, t = 0, tp = 0, nextRec = 0, recT0 = sc.loop ? null : 0;
  const frames = [], servoMask = new Uint8Array(NJ);
  let comB = null, roll = null, flashUntil = -1, blend = { N: 0, F: 0 }, qBlend = { N: null, F: null };
  let peakV = 0, strikeT = 0, strikeStart = -1, reach = -Infinity, prevHit = null, reachedAt = null, airT = 0, maxCom = -Infinity, comStand = null;
  const lp = legPower(R);
  const toStance = (sides) => { // feet that touch down become planted footprints
    const F = fk(R, st);
    for (const s of sides) {
      anchors[s] = { x: F.feet[s].ball.x, y: 0 }; legMode[s] = 'stance';
      qBlend[s] = Float64Array.from(st.q); blend[s] = .08;
    }
    mode = 'stance';
    const hs = standH(); curPar.cr = prev.cr = clamp((hs - st.y) / H, -0.02, .45);
    const pt = st.tilt - hunchTilt(p);
    curPar.lean = prev.lean = pt * R2D;
  };
  const startPhase = i => {
    const ph = phases[i];
    prevTg = Object.assign({}, curTg); prev = Object.assign({}, curPar);
    if (ph.strike && strikeStart < 0) strikeStart = t;
    if (ph.flash) flashUntil = t + .045;
    if (i === recStartPhase && sc.loop) recT0 = t;
    if (ph.step) { const s = ph.step.side; anchors[s] = { x: anchors[s].x + ph.step.dx * H, y: 0 }; }
    if (ph.legs) for (const s of ['N', 'F']) {
      const m = ph.legs[s]; if (!m) continue;
      if (m === 'swing' && legMode[s] === 'stance') legMode[s] = 'swing';
      if (m === 'plant') { legMode[s] = 'plant'; const F = fk(R, st); plantFrom[s] = { x: F.feet[s].ball.x, y: F.feet[s].ball.y }; }
      if (m === 'stance' && legMode[s] === 'swing' && mode === 'stance') toStance([s]);
    }
    if (ph.launch) {
      const F = fk(R, st);
      comB = { x: F.com.x, y: F.com.y, vx: ph.launch.vx * lp, vy: ph.launch.vy * lp };
      mode = 'air'; legMode.N = legMode.F = 'swing';
    }
    if (ph.roll) { mode = 'roll'; roll = { a0: st.tilt, a1: ph.roll.to * D2R + hunchTilt(p) }; legMode.N = legMode.F = 'swing'; }
    else if (mode === 'roll') { st.tilt -= 2 * Math.PI; tiltOff += 2 * Math.PI; toStance(['N', 'F']); prev = Object.assign({}, curPar); }
  };
  startPhase(0);
  while (pi < phases.length && t < 12) {
    const ph = phases[pi], el = t - tp, u = el / ph.d;
    const bl = ph.snap ? sstep(el / .1) : sstep(u);
    if (ph.tg) for (const k in ph.tg) curTg[k] = ph.snap ? ph.tg[k] : lerp(prevTg[k] ?? ph.tg[k], ph.tg[k], bl);
    for (const k of ['wf', 'cr', 'lean']) if (ph[k] !== undefined) curPar[k] = lerp(prev[k], ph[k], bl);
    if (ph.yaw !== undefined) curPar.yaw = lerp(prev.yaw, ph.yaw, ph.linYaw ? clamp(u, 0, 1) : sstep(u));
    tgt.fill(0); for (const k in curTg) tgt[J[k]] = curTg[k] * D2R;
    postureAdd(p, tgt);
    if (mode === 'roll') st.tilt = lerp(roll.a0, roll.a1, sstep(u));
    else if (mode === 'air') st.tilt = lerp(st.tilt, curPar.lean * D2R + hunchTilt(p), Math.min(1, dt / .09));
    else st.tilt = curPar.lean * D2R + hunchTilt(p);
    let F = fk(R, st);
    if (ph.gaze !== 0) gazeTargets(F, tgt, 5);
    // swing legs returning to a footprint: lift, travel, set down
    for (const s of ['N', 'F']) if (legMode[s] === 'plant' && mode === 'stance') {
      const k = sstep(clamp(u / .9, 0, 1)), a = anchors[s], f0 = plantFrom[s];
      const goal = { x: lerp(f0.x, a.x, k), y: lerp(f0.y, 0, k) + .07 * H * Math.sin(Math.PI * k) * (Math.abs(f0.x - a.x) > .02 * H ? 1 : .3) };
      const qq = Float64Array.from(st.q); legIK(R, qq, s, st.tilt, { x: st.x, y: st.y }, goal, 0);
      for (const j of LEGJ[s]) tgt[j] = qq[j];
      const fs = F.feet[s];
      if ((u > .85 && minY(fs) < .02 * H) || u >= 1) { legMode[s] = 'stance'; qBlend[s] = Float64Array.from(st.q); blend[s] = .08; anchors[s] = { x: a.x, y: 0 }; }
    }
    servoMask.fill(0);
    ['lumbar', 'thoracic', 'neck', 'head', 'shoulderN', 'elbowN', 'wristN', 'shoulderF', 'elbowF', 'wristF'].forEach(k => servoMask[J[k]] = 1);
    for (const s of ['N', 'F']) if (legMode[s] !== 'stance' || mode !== 'stance') for (const j of LEGJ[s]) servoMask[j] = 1;
    const both = legMode.N === 'stance' && legMode.F === 'stance' && mode === 'stance';
    const wN = mode !== 'stance' ? 0 : both ? clamp((F.com.x - cop('F')) / (cop('N') - cop('F') || 1e-6), 0, 1) : legMode.N === 'stance' ? 1 : 0;
    const wF = mode !== 'stance' ? 0 : 1 - wN;
    const stance = { N: { w: wN, cop: copOf(F, 'N'), fy: wN * M * GRAV }, F: { w: wF, cop: copOf(F, 'F'), fy: wF * M * GRAV } };
    servoStep(R, st, F, tgt, servoMask, mode === 'stance' ? stance : null, dt, effMax);
    const prevQ = Float64Array.from(st.q);
    if (mode === 'stance') {
      const sup = ['N', 'F'].filter(s => legMode[s] === 'stance');
      const targetX = sup.length === 2 ? lerp(cop('F'), cop('N'), curPar.wf) : cop(sup[0] || 'F');
      if (sup.length) balancedLegs(R, st, standH() - curPar.cr * H, targetX, sup.map(s => LEG[s]));
      for (const s of ['N', 'F']) if (blend[s] > 0) { const k = sstep(1 - blend[s] / .08); for (const j of LEGJ[s]) st.q[j] = lerp(qBlend[s][j], st.q[j], k); blend[s] -= dt; }
      for (const s of sup) for (const j of LEGJ[s]) st.w[j] = (st.q[j] - prevQ[j]) / dt;
      F = fk(R, st);
      for (const s of sup) for (const j of LEGJ[s]) staticEffort(R, F, st, j, stance);
      if (comStand === null) comStand = F.com.y;
    } else if (mode === 'air') {
      comB.vy -= GRAV * dt; comB.y += comB.vy * dt; comB.x += comB.vx * dt; airT += dt;
      F = fk(R, st); st.x += comB.x - F.com.x; st.y += comB.y - F.com.y; F = fk(R, st);
      maxCom = Math.max(maxCom, comB.y);
      if (comB.vy < 0 && el > (ph.minT || .03)) {
        if (ph.ground) { const lo = bodyContactLow(R, F); if (lo <= 0) { st.y -= lo; F = fk(R, st); pi++; tp = t; if (pi < phases.length) startPhase(pi); continue; } }
        else {
          const touch = ['N', 'F'].filter(s => minY(F.feet[s]) <= 0);
          if (touch.length) {
            const lo = Math.min(minY(F.feet.N), minY(F.feet.F)); st.y -= lo;
            const F1 = fk(R, st);
            let sides = ['N', 'F'].filter(s => minY(F1.feet[s]) < .03 * H);
            if (sides.length === 2 && Math.abs(F1.feet.N.ball.x - F1.feet.F.ball.x) > .22 * H) sides = [minY(F1.feet.N) <= minY(F1.feet.F) ? 'N' : 'F'];
            toStance(sides);
            const ref = anchors[sides[0]].x;
            for (const s of ['N', 'F']) if (!sides.includes(s)) { legMode[s] = 'plant'; const F2 = fk(R, st); plantFrom[s] = { x: F2.feet[s].ball.x, y: F2.feet[s].ball.y }; anchors[s] = { x: ref + (s === 'N' ? .11 : -.11) * H, y: 0 }; }
            if (ph.land) { pi++; tp = t; if (pi < phases.length) startPhase(pi); continue; }
          }
        }
      }
    } else if (mode === 'roll') {
      const da = st.tilt - (roll.prev ?? st.tilt); roll.prev = st.tilt;
      F = fk(R, st);
      st.x += 0.7 * Math.max(0, F.com.y) * da;
      F = fk(R, st); st.y -= bodyContactLow(R, F); F = fk(R, st);
    }
    // strike metrics
    if (sc.hit) {
      const g = F.S[SI[sc.hit]]; const tip = { x: g.ex, y: g.ey };
      if (prevHit && ph.strike) { const v = Math.hypot(tip.x - prevHit.x, tip.y - prevHit.y) / dt; peakV = Math.max(peakV, v); reach = Math.max(reach, tip.x - st.x); }
      prevHit = tip;
    }
    if (recT0 !== null && t >= recT0 + nextRec - 1e-9) {
      const grf = []; for (const s of ['N', 'F']) if (stance[s].w > 0.01) grf.push({ x: copOf(F, s), f: stance[s].fy });
      frames.push(record(R, st, F, t - recT0, { grf, phase: ph.n, yaw: curPar.yaw * D2R, flash: t < flashUntil, weapon: sc.weapon || null, tilt: st.tilt + tiltOff }));
      nextRec += recDt;
    }
    t += dt;
    let done = t - tp >= ph.d;
    if (ph.until && t - tp > .04) { let ok = true; for (const k of ph.until) if (Math.abs(st.q[J[k]] - ph.tg[k] * D2R) > 7 * D2R) ok = false; if (ok) { done = true; reachedAt = t; } }
    if ((ph.land || ph.ground) && mode === 'air') done = t - tp >= ph.d + 1.5;
    if (done) { if (ph.strike && !(phases[pi + 1] || {}).strike) strikeT = t - strikeStart; pi++; tp = t; if (pi < phases.length) startPhase(pi); }
  }
  // travel moves are rendered in place around a smoothed centre-of-mass track (root motion goes in the metadata)
  if (sc.travel) {
    const n = frames.length, sm = frames.map((f, i) => { let a = 0, c = 0; for (let k = Math.max(0, i - 12); k <= Math.min(n - 1, i + 12); k++) { a += frames[k].com.x; c++; } return a / c; });
    frames.forEach((f, i) => { f.root = sm[i] - sm[0]; f.dx = f.x - f.root; });
  }
  const peak = peakEffort(frames);
  const metrics = [];
  if (sc.hit) metrics.push([`Peak ${sc.hit.startsWith('hand') ? 'hand' : sc.hit.startsWith('thigh') ? 'knee' : 'foot'} speed`, peakV.toFixed(1) + ' m/s'], ['Strike time', (strikeT * 1000).toFixed(0) + ' ms'], ['Reach from hip', (reach * 100).toFixed(0) + ' cm']);
  if (airT > 0) metrics.push(['Airtime', airT.toFixed(2) + ' s']);
  if (sc.travel && frames.length) metrics.push(['Distance travelled', (frames[frames.length - 1].root * 100).toFixed(0) + ' cm']);
  if (id === 'fire') metrics.push(['Weapon', p.weapon], ['Shots', String(Math.round(p.shots || 3))]);
  metrics.push(['Length', (frames.length * recDt).toFixed(2) + ' s'], ['Peak effort', peak.label]);
  const warn = effortWarn(peak);
  if (sc.phases.some(x => x.until) && !reachedAt) warn.push('The strike never reached full extension before the phase timed out: too weak or too heavy a limb for this effort.');
  return { name: id, frames, duration: frames.length * recDt, loop: !!sc.loop, travel: !!sc.travel, anchorX: sc.anchorX, metrics, warn };
}
const simAttack = (R, p) => simScript(R, p, p.atkType || 'punch');

/* running jump: take off from the run cycle at near-foot toe-off, then a scripted leap */
function simRunJump(R, p) {
  const run = simGait(R, p, 'run'), T = run.duration;
  const lead = run.frames.filter(f => f.ph <= .3);
  const a = run.frames[Math.round(.3 * T * 120)], b = run.frames[Math.round(.3 * T * 120) + 1];
  const init = { q: Float64Array.from(a.q), w: Float64Array.from(a.q.map((v, j) => (b.q[j] - v) * 120)), x: a.dx, y: a.y, tilt: a.tilt };
  const sp = run.speed;
  const script = { phases: [
    { n: 'take-off', d: .4, launch: { vx: sp, vy: 2.1 }, land: 1, minT: .1, tg: { hipN: -4, kneeN: 70, ankleN: -30, hipF: 75, kneeF: 70, ankleF: -10, shoulderN: 70, elbowN: 70, shoulderF: -40, elbowF: 50, lumbar: 4, thoracic: 2 }, lean: 10 },
    { n: 'reach', d: .4, land: 1, tg: { hipN: 45, kneeN: 40, ankleN: -10, hipF: 60, kneeF: 25, ankleF: -5, shoulderN: 40, elbowN: 80, shoulderF: 20, elbowF: 80 }, lean: 8 },
    { n: 'absorb', d: .26, tg: { shoulderN: 35, elbowN: 70, shoulderF: 30, elbowF: 70, lumbar: 10, thoracic: 6 }, cr: .14, lean: 22, wf: .5, legs: { N: 'stance', F: 'stance' } },
    { n: 'recover', d: .45, tg: STAND, cr: .02, lean: 3 },
  ], stance: { N: .05, F: -.05 }, anchorX: .5, travel: 1 };
  const res = simScript(R, p, 'runjump', init, script);
  // stitch the run-up in front
  const t0 = lead.length / 120;
  const runFrames = lead.map((f, i) => Object.assign({}, f, { t: i / 120, x: f.dx, com: { x: f.com.x - (f.x - f.dx), y: f.com.y }, phase: 'run-up', yaw: 0 }));
  for (const f of res.frames) f.t += t0;
  const all = [...runFrames, ...res.frames];
  // in-place: centre on a smoothed COM track across the whole thing
  const n = all.length, sm = all.map((f, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 12); k <= Math.min(n - 1, i + 12); k++) { s += all[k].com.x; c++; } return s / c; });
  all.forEach((f, i) => { f.root = sm[i] - sm[0]; f.dx = f.x - f.root; delete f.ph; });
  res.frames = all; res.duration = all.length / 120; res.name = 'runjump';
  res.metrics.unshift(['Run-up speed', sp.toFixed(2) + ' m/s']);
  return res;
}

function simMove(R, p, id) {
  if (id === 'walk' || id === 'run') return simGait(R, p, id);
  if (id === 'jump') return simJump(R, p);
  if (id === 'runjump') return simRunJump(R, p);
  return simScript(R, p, id);
}
function simulateAll(p) {
  const R = buildRig(p);
  return { R, walk: simWalk(R, p), jump: simJump(R, p), attack: simAttack(R, p) };
}
function frameAt(anim, t) { // linear interpolation between recorded frames
  const fr = anim.frames, n = fr.length, dt = 1 / 120;
  let x = t / dt; if (anim.loop) { x = ((x % n) + n) % n; } else x = clamp(x, 0, n - 1);
  const i = Math.floor(x), k = x - i, a = fr[i], b = fr[anim.loop ? (i + 1) % n : Math.min(i + 1, n - 1)];
  if (k < 1e-6) return a;
  const o = { t, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), tilt: lerp(a.tilt, b.tilt, k), q: new Float32Array(NJ), act: new Float32Array(NJ), eff: new Float32Array(NJ), tq: a.tq, com: { x: lerp(a.com.x, b.com.x, k), y: lerp(a.com.y, b.com.y, k) }, grf: a.grf, phase: a.phase, yaw: lerp(a.yaw || 0, b.yaw || 0, k), flash: a.flash, weapon: a.weapon, root: a.root !== undefined ? lerp(a.root, b.root, k) : undefined };
  if (a.dx !== undefined) o.dx = lerp(a.dx, b.dx, k);
  for (let j = 0; j < NJ; j++) { o.q[j] = lerp(a.q[j], b.q[j], k); o.act[j] = lerp(a.act[j], b.act[j], k); o.eff[j] = lerp(a.eff[j], b.eff[j], k); }
  return o;
}
/* ============================================================
   MARROW — anatomy + SDF pixel renderer
   Every bone, muscle belly, tendon and soft-tissue mass is a signed
   distance primitive attached to a skeleton segment. Skin is the smooth
   union of muscle + soft tissue, inflated by subcutaneous fat.
   ============================================================ */

/* point = [segment, u (fraction of segment length), v (fraction of height, + = anterior)] */
// [name, region, points, belly radius (×H), belly centre, joint actions [type, +1 if it drives + rotation], fat weight]
const MUSCLES = [
  ['Gluteus maximus', 'leg', [['pelvis', .72, -.05], ['thigh', .22, -.018]], .037, .45, [['hip', -1]], 1.5],
  ['Rectus femoris', 'leg', [['pelvis', .1, .034], ['thigh', .97, .024], ['shank', .04, .02]], .021, .5, [['hip', 1], ['knee', -1]], .9],
  ['Vastus lateralis', 'leg', [['thigh', .12, .006], ['thigh', .97, .022], ['shank', .04, .02]], .035, .6, [['knee', -1]], 1.1],
  ['Hamstrings', 'leg', [['pelvis', -.1, -.038], ['thigh', .9, -.02], ['shank', .07, -.014]], .027, .5, [['hip', -1], ['knee', 1]], 1],
  ['Gastrocnemius', 'leg', [['shank', .03, -.013], ['shank', .55, -.016], ['foot', -.5, -.012]], .03, .42, [['knee', 1], ['ankle', -1]], .5],
  ['Soleus', 'leg', [['shank', .25, -.008], ['shank', .78, -.012], ['foot', -.5, -.012]], .02, .55, [['ankle', -1]], .4],
  ['Tibialis anterior', 'leg', [['shank', .1, .012], ['shank', .8, .012], ['foot', .35, -.008]], .011, .4, [['ankle', 1]], .3],
  ['Deltoid (front)', 'arm', [['thorax', .97, .014], ['upperArm', .45, .012]], .021, .35, [['shoulder', 1]], .7],
  ['Deltoid (rear)', 'arm', [['thorax', .97, -.022], ['upperArm', .45, -.006]], .021, .35, [['shoulder', -1]], .7],
  ['Biceps', 'arm', [['upperArm', .12, .012], ['upperArm', .85, .014], ['forearm', .12, .008]], .016, .55, [['elbow', 1], ['shoulder', 1]], .8],
  ['Triceps', 'arm', [['upperArm', .1, -.012], ['upperArm', .92, -.014], ['forearm', -.04, -.008]], .019, .45, [['elbow', -1], ['shoulder', -1]], .9],
  ['Forearm flexors', 'arm', [['upperArm', .86, .006], ['forearm', .5, .009], ['hand', .05, .004]], .015, .3, [['wrist', 1], ['elbow', 1]], .5],
  ['Forearm extensors', 'arm', [['upperArm', .9, -.008], ['forearm', .5, -.008], ['hand', .05, -.004]], .014, .3, [['wrist', -1]], .5],
  ['Pectoralis major', 'arm', [['thorax', .62, .056], ['upperArm', .12, .008]], .023, .4, [['shoulder', 1]], 1.1],
  ['Latissimus dorsi', 'arm', [['abdomen', .4, -.045], ['upperArm', .14, -.004]], .022, .45, [['shoulder', -1]], .9],
  ['Rectus abdominis', 'core', [['pelvis', .4, .044], ['thorax', .3, .058]], .01, .5, [['lumbar', 1]], 0],
  ['External oblique', 'core', [['thorax', .25, .014], ['pelvis', .85, .02]], .03, .5, [['lumbar', 1]], 1.0],
  ['Erector spinae', 'core', [['pelvis', .5, -.044], ['thorax', .68, -.05]], .018, .4, [['lumbar', -1], ['thoracic', -1]], .9],
  ['Trapezius', 'core', [['thorax', .5, -.052], ['neck', .78, -.018]], .02, .35, [['neck', -1]], .8],
  ['Sternocleidomastoid', 'core', [['thorax', 1.0, .03], ['head', .25, -.012]], .008, .5, [['neck', 1]], .4],
];
// [region, kind ('cap'|'ell'), a, b | null, r0, r1, fat weight, muscle-mode look ('deep'|'bone'|'none'), extra]
const SOFT = [
  ['leg', 'cap', ['thigh', .05, -.005], ['thigh', .95, .0], .033, .022, 1.15, 'deep'],
  ['leg', 'cap', ['thigh', 1.0, .004], null, .021, .021, .3, 'none'],
  ['leg', 'cap', ['shank', .05, 0], ['shank', .92, 0], .02, .013, .6, 'none'],
  ['leg', 'cap', ['shank', .96, 0], ['foot', .08, -.01], .017, .017, .3, 'none'],
  ['leg', 'cap', ['foot', -.45, -.022], ['foot', -.28, -.02], .017, .017, .3, 'bone'],
  ['leg', 'cap', ['foot', -.3, -.018], ['foot', .95, -.027], .019, .012, .3, 'bone'],
  ['leg', 'cap', ['toes', .1, .009], ['toes', .9, .006], .009, .007, .2, 'bone'],
  ['leg', 'cap', ['pelvis', .3, -.04], null, .034, .034, 1.5, 'none'],
  ['arm', 'cap', ['upperArm', .05, 0], ['upperArm', .95, 0], .02, .016, .95, 'deep'],
  ['arm', 'cap', ['forearm', 0, 0], ['forearm', .95, 0], .018, .012, .5, 'deep'],
  ['arm', 'cap', ['upperArm', 1.0, -.004], null, .014, .014, .3, 'none'],
  ['arm', 'cap', ['hand', .1, 0], ['hand', .78, .004], .0145, .013, .25, 'bone'],
  ['core', 'cap', ['pelvis', -.3, -.004], ['pelvis', .95, 0], .05, .05, 1.2, 'deep'],
  ['core', 'cap', ['abdomen', 0, .004], ['abdomen', 1.0, .004], .043, .045, 1.8, 'deep', 'belly'],
  ['core', 'cap', ['thorax', .05, .004], ['thorax', .72, 0], .056, .058, .9, 'deep', 'chest'],
  ['core', 'cap', ['thorax', .86, -.02], null, .044, .044, .8, 'deep'],
  ['core', 'cap', ['neck', -.1, 0], ['neck', 1.0, .003], .027, .025, .6, 'deep'],
  ['core', 'ell', ['head', .46, .012], null, .066, .056, .15, 'bone', 'head'],
  ['core', 'cap', ['head', .2, .026], ['head', .07, .05], .019, .016, .35, 'bone', 'head'],
  ['core', 'cap', ['head', .42, .062], null, .008, .008, .1, 'none', 'head'],
];
// bones: [region, kind ('cap'|'ell'|'ring'), a, b|null, r0, r1, landmark (shows through skin)]
const BONES = [
  ['leg', 'cap', ['thigh', .03, -.004], ['thigh', .97, 0], .0085, .0085],
  ['leg', 'cap', ['thigh', 0, 0], null, .0125, .0125],
  ['leg', 'cap', ['thigh', .97, -.002], null, .0155, .0155],
  ['leg', 'cap', ['thigh', 1.02, .017], null, .0085, .0085, 1],
  ['leg', 'cap', ['shank', .03, .004], ['shank', .98, .002], .0085, .0085],
  ['leg', 'cap', ['shank', .02, .002], null, .014, .014],
  ['leg', 'cap', ['shank', .06, -.008], ['shank', .97, -.008], .0045, .0045],
  ['leg', 'cap', ['shank', 1.0, 0], null, .0105, .0105, 1],
  ['leg', 'cap', ['foot', -.48, -.025], ['foot', -.05, -.012], .0105, .0105],
  ['leg', 'cap', ['foot', -.05, -.012], ['foot', .3, -.018], .011, .011],
  ['leg', 'cap', ['foot', .3, -.02], ['foot', .98, -.031], .0065, .0055],
  ['leg', 'cap', ['toes', .1, .006], ['toes', .9, .005], .0045, .0045],
  ['arm', 'cap', ['upperArm', .03, 0], ['upperArm', .96, 0], .0075, .0075],
  ['arm', 'cap', ['upperArm', .01, .002], null, .0125, .0125],
  ['arm', 'cap', ['upperArm', .98, 0], null, .0105, .0105],
  ['arm', 'cap', ['forearm', .02, .004], ['forearm', .98, .004], .0055, .0055],
  ['arm', 'cap', ['forearm', -.03, -.006], ['forearm', .97, -.003], .0055, .0055],
  ['arm', 'cap', ['forearm', -.04, -.007], null, .0075, .0075, 1],
  ['arm', 'cap', ['hand', .05, 0], ['hand', .3, 0], .0075, .0075],
  ['arm', 'cap', ['hand', .3, .002], ['hand', .75, .004], .0065, .0065],
  ['arm', 'cap', ['thorax', .86, -.045], ['thorax', .55, -.05], .009, .006],
  ['arm', 'cap', ['thorax', .98, -.012], ['thorax', .96, .045], .0055, .0055, 1],
  ['core', 'ring', ['pelvis', .55, -.003], null, .05, .055, 0, .0075],
  ['core', 'cap', ['pelvis', .15, .035], ['pelvis', -.15, .028], .007, .007],
  ['core', 'cap', ['pelvis', .25, -.022], ['pelvis', -.25, -.032], .009, .009],
  ['core', 'cap', ['pelvis', .95, -.04], ['pelvis', .3, -.05], .011, .009],
  ['core', 'ring', ['thorax', .5, .008], null, .072, .058, 0, .0045],
  ['core', 'cap', ['thorax', .2, .06], ['thorax', .88, .056], .0045, .0045],
  ['core', 'ell', ['head', .52, .004], null, .062, .053],
  ['core', 'cap', ['head', .22, 0], ['head', .08, .045], .011, .011],
  ['core', 'cap', ['head', .32, .045], null, .012, .012],
];
(function addSpine() {
  for (let i = 0; i < 5; i++) BONES.push(['core', 'cap', ['abdomen', .1 + .2 * i, -.032 + .004 * Math.sin(Math.PI * (.1 + .2 * i))], null, .0085, .0085]);
  for (let i = 0; i < 12; i++) { const u = .04 + i * .08; BONES.push(['core', 'cap', ['thorax', u, -.04 - .008 * Math.sin(Math.PI * u)], null, .007, .007]); }
  for (let i = 0; i < 7; i++) BONES.push(['core', 'cap', ['neck', i * .14, -.006], null, .0055, .0055]);
  for (let i = 0; i < 9; i++) { const u = .15 + .08 * i; BONES.push(['core', 'cap', ['thorax', u, -.04], ['thorax', u - .16, .052], .0035, .0035]); }
})();
const LIMB = new Set(['thigh', 'shank', 'foot', 'toes', 'upperArm', 'forearm', 'hand']);
const GROUP = { F: { arm: 0, leg: 1 }, N: { leg: 3, arm: 4 } };

function segOf(F, name, side) { return F.S[SI[LIMB.has(name) ? name + side : name]]; }
function locate(F, R, pt, side) {
  const g = segOf(F, pt[0], side), H = R.H;
  const nx = g.ant > 0 ? -g.dy : g.dy, ny = g.ant > 0 ? g.dx : -g.dx;
  return { x: g.ox + g.dx * pt[1] * g.len + nx * pt[2] * H, y: g.oy + g.dy * pt[1] * g.len + ny * pt[2] * H, a: g.a };
}
function restLengths(R) {
  if (R._rest) return R._rest;
  const st = { x: 0, y: 1, tilt: 0, q: new Float64Array(NJ) }; const F = fk(R, st); const out = {};
  for (const m of MUSCLES) for (const s of (m[1] === 'core' ? ['C'] : ['N', 'F'])) {
    const a = locate(F, R, m[2][0], s === 'C' ? 'N' : s), b = locate(F, R, m[2][1], s === 'C' ? 'N' : s);
    out[m[0] + s] = Math.hypot(b.x - a.x, b.y - a.y);
  }
  return R._rest = out;
}

/* build all primitives for one pose */
function buildPrims(R, fr) {
  const F = fk(R, fr), H = R.H, p = R.p, rest = restLengths(R), prims = [];
  const ab = p.armBulk || 1, hr = p.headRound || 0;
  const regR = { leg: R.muscleR.lower, arm: R.muscleR.upper * ab, core: R.muscleR.core };
  const LAT = { arm: .1 * H * p.chest, leg: .05 * H, core: 0 };
  let cur = { sd: 0, lat: 0 };
  const add = o => { prims.push(Object.assign(o, cur)); return o; };
  const cap = (g, A, B, r0, r1, mat, fat, extra) => add(Object.assign({ g, k: 0, ax: A.x, ay: A.y, bx: B.x, by: B.y, r0, r1, mat, fat }, extra));
  const sides = reg => reg === 'core' ? [['N', 2]] : [['F', GROUP.F[reg]], ['N', GROUP.N[reg]]];
  const setSide = (reg, side) => { cur = reg === 'core' ? { sd: 0, lat: 0, core: true } : { sd: side === 'N' ? 1 : -1, lat: LAT[reg] }; };
  const actOf = (acts, side) => { let a = 0; for (const [type, sg] of acts) { const id = JT[type].reg === 'core' || type === 'neck' || type === 'head' ? type : type + side; const v = fr.act[J[id]] * sg; if (v > a) a = v; } return Math.min(1, a); };
  for (const m of MUSCLES) {
    const [name, reg, pts, rb, bc, acts, fatW] = m;
    for (const [side, g] of sides(reg)) {
      setSide(reg, side);
      const P = pts.map(pt => locate(F, R, pt, side));
      const L0 = rest[name + (reg === 'core' ? 'C' : side)], L = Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y);
      const act = actOf(acts, side);
      const r = rb * H * regR[reg] * Math.min(1.45, Math.max(.75, 1 / Math.sqrt(L / L0))) * (1 + .1 * act);
      add({ g, k: 1, ax: P[0].x, ay: P[0].y, bx: P[1].x, by: P[1].y, r0: .004 * H, r1: .004 * H, rb: r, bc, mat: 1, fat: fatW, act, name });
      if (P[2]) cap(g, P[1], P[2], .0045 * H, .0035 * H, 2, fatW * .3, { act, name: name + ' tendon' });
    }
  }
  for (const s of SOFT) {
    const [reg, kind, A, B, r0, r1, fatW, mm, tag] = s;
    let k0 = 1;
    if (tag === 'belly') k0 = p.belly; else if (tag === 'chest') k0 = p.chest; else if (tag === 'head') k0 = p.headL;
    if (A[0] === 'hand') k0 *= p.handSize || 1;
    else if (reg === 'arm') k0 *= Math.sqrt(ab);
    const hp = A[0] === 'head' || (B && B[0] === 'head');
    let rr1 = r1;
    if (kind === 'ell' && tag === 'head') rr1 = lerp(r1, r0 * 1.02, hr);
    if (tag === 'head' && kind === 'cap' && r0 > .015) k0 *= 1 - .45 * hr;
    for (const [side, g] of sides(reg)) {
      setSide(reg, side);
      const a = locate(F, R, A, side);
      if (kind === 'ell') add({ g, k: 2, cx: a.x, cy: a.y, rx: r0 * H * k0, ry: rr1 * H * k0, cs: Math.cos(a.a), sn: Math.sin(a.a), mat: 0, fat: fatW, mm, headPart: hp });
      else { const b = B ? locate(F, R, B, side) : a; cap(g, a, b, r0 * H * k0, r1 * H * k0, 0, fatW, { mm, headPart: hp }); }
    }
  }
  const bk = .85 + .15 * p.bone;
  for (const b of BONES) {
    const [reg, kind, A, B, r0, r1, lm, th] = b;
    const k0 = A[0] === 'head' ? p.headL : A[0] === 'hand' ? (p.handSize || 1) : 1;
    for (const [side, g] of sides(reg)) {
      setSide(reg, side);
      const a = locate(F, R, A, side);
      if (kind === 'cap') { const e = B ? locate(F, R, B, side) : a; cap(g, a, e, r0 * H * bk * k0, r1 * H * bk * k0, 3, lm ? .1 : 0, { lm: !!lm, headPart: A[0] === 'head' }); }
      else add({ g, k: kind === 'ring' ? 3 : 2, cx: a.x, cy: a.y, rx: r0 * H * k0, ry: r1 * H * k0, th: (th || 0) * H * bk, cs: Math.cos(a.a), sn: Math.sin(a.a), mat: 3, fat: 0, headPart: A[0] === 'head' });
    }
  }
  // character features: jowls, brow ridge, snout, tusks
  setSide('core', 'N'); cur.headPart = true;
  const hk = p.headL, Lc = pt => locate(F, R, pt, 'N');
  if (p.jowl > 0) {
    cap(2, Lc(['head', .17, .028]), Lc(['head', .05, .058]), .02 * (1 + 1.5 * p.jowl) * H * hk, .017 * (1 + 1.2 * p.jowl) * H * hk, 0, 1.1, { mm: 'deep' });
    cap(2, Lc(['head', .09, .072]), Lc(['head', .09, .072]), .012 * p.jowl * H * hk, .012 * p.jowl * H * hk, 0, .3, { mm: 'bone' });
    if (p.jowl > .45) cap(2, Lc(['head', .1, .082]), Lc(['head', .22, .096]), .0055 * H * hk, .003 * H * hk, 3, 0, { lm: true, tusk: true });
  }
  if (p.brow > 0) cap(2, Lc(['head', .6, .055]), Lc(['head', .64, .036]), .009 * (1 + 1.4 * p.brow) * H * hk, .007 * (1 + p.brow) * H * hk, 0, .2, { mm: 'bone' });
  if (p.snout > 0) cap(2, Lc(['head', .36, .05]), Lc(['head', .34, .06 + .06 * p.snout]), .016 * (1 + .5 * p.snout) * H * hk, .012 * (1 + .3 * p.snout) * H * hk, 0, .3, { mm: 'bone' });
  cur.headPart = false;
  // weapon held in the near hand
  const over = [];
  if (fr.weapon) {
    cur = { sd: 1, lat: LAT.arm };
    const hN = F.S[SI.handN], fN = locate(F, R, ['hand', .45, 0], 'N');
    let mz;
    if (fr.weapon === 'rifle') {
      const fF = locate(F, R, ['hand', .45, 0], 'F'); let dx = fF.x - fN.x, dy = fF.y - fN.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const P = k => ({ x: fN.x + dx * k * H, y: fN.y + dy * k * H }), nx = -dy, ny = dx, off = (k, v) => ({ x: fN.x + dx * k * H + nx * v * H, y: fN.y + dy * k * H + ny * v * H });
      cap(4, off(-.22, .01), off(-.02, .016), .02 * H, .012 * H, 7, 0);
      cap(4, off(-.02, .016), off(l / H + .05, .016), .012 * H, .011 * H, 7, 0);
      cap(4, off(l / H + .05, .018), off(l / H + .3, .018), .0055 * H, .005 * H, 7, 0);
      cap(4, off(.06, .0), off(.08, -.045), .009 * H, .008 * H, 7, 0);
      mz = off(l / H + .32, .018);
    } else {
      const g = hN, nx = -g.dy, ny = g.dx, off = (u, v) => ({ x: g.ox + g.dx * u * g.len + nx * v * H, y: g.oy + g.dy * u * g.len + ny * v * H });
      cap(4, off(.25, .02), off(1.75, .02), .0095 * H, .0085 * H, 7, 0);
      cap(4, off(.55, .015), off(.72, -.022), .0085 * H, .008 * H, 7, 0);
      mz = off(1.85, .02);
    }
    if (fr.flash) {
      const d = fr.weapon === 'rifle' ? [locate(F, R, ['hand', .45, 0], 'F').x - fN.x, locate(F, R, ['hand', .45, 0], 'F').y - fN.y] : [hN.dx, hN.dy];
      const l = Math.hypot(d[0], d[1]) || 1, ux = d[0] / l, uy = d[1] / l;
      over.push({ g: 4, k: 0, ax: mz.x, ay: mz.y, bx: mz.x + ux * .09 * H, by: mz.y + uy * .09 * H, r0: .028 * H, r1: .008 * H, mat: 11, top: 1, sd: 1, lat: LAT.arm });
      over.push({ g: 4, k: 0, ax: mz.x, ay: mz.y, bx: mz.x + ux * .045 * H, by: mz.y + uy * .045 * H, r0: .016 * H, r1: .005 * H, mat: 10, top: 1, sd: 1, lat: LAT.arm });
    }
  }
  // eyes (skin) and orbits (skeleton); large eyes get a white and a highlight
  const big = (p.eyes || 1) > 1.3, es = (p.eyes || 1) * hk;
  for (const [sd, lat] of [[1, .024], [-1, .024]]) {
    const e = Lc(['head', big ? .37 : .47, (big ? .056 : .046) * hk]), orb = Lc(['head', .5, .038 * hk]);
    const base = { g: 2, k: 0, sd, lat: lat * H * hk, eye: sd };
    const dot = (pt, r, mat, dx = 0, dy = 0) => over.push(Object.assign({}, base, { ax: pt.x + dx, ay: pt.y + dy, bx: pt.x + dx, by: pt.y + dy, r0: r, r1: r, mat }));
    if (big) { dot(e, .0068 * es * H, 8); dot(e, .0054 * es * H, 4, .0016 * es * H, -.0006 * es * H); dot(e, .0018 * es * H, 9, .0024 * es * H, .0022 * es * H); }
    else dot(e, .0055 * H * hk * Math.max(.6, es / hk), 4);
    dot(orb, .012 * H * hk, 5);
  }
  // body turn (yaw): forward offsets fold by cos, sides separate by sin, near/far swap past 90°
  const yaw = fr.yaw || 0;
  if (Math.abs(yaw) > 1e-4) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = fr.x, wide = 1 + .28 * Math.abs(sy);
    const tx = (x, q) => cx + (x - cx) * cy + (q.sd || 0) * (q.lat || 0) * sy;
    for (const q of [...prims, ...over]) {
      if (q.k <= 1) { q.ax = tx(q.ax, q); q.bx = tx(q.bx, q); } else { q.cx = tx(q.cx, q); const a = Math.atan2(q.sn, q.cs * cy); q.cs = Math.cos(a); q.sn = Math.sin(a); }
      if (cy < 0 && q.g !== 2) q.g = 4 - q.g;
      if (q.core && q.mat !== 3) { if (q.k <= 1) { q.r0 *= wide; q.r1 *= wide; if (q.rb) q.rb *= wide; } }
    }
    for (const q of over) if (q.eye) q.vis = q.eye > 0 ? (cy > -.3 || sy > .5) : (cy < .3 || sy > .5);
  }
  return { prims, over, F };
}

function sdfPrim(o, x, y, infl) {
  if (o.k === 0 || o.k === 1) {
    const bax = o.bx - o.ax, bay = o.by - o.ay, pax = x - o.ax, pay = y - o.ay, l2 = bax * bax + bay * bay;
    const h = l2 > 1e-12 ? Math.max(0, Math.min(1, (pax * bax + pay * bay) / l2)) : 0;
    const dx = pax - bax * h, dy = pay - bay * h;
    let r = o.r0 + (o.r1 - o.r0) * h;
    if (o.k === 1) { const s = h < o.bc ? .5 * h / o.bc : .5 + .5 * (h - o.bc) / (1 - o.bc); r += o.rb * Math.pow(Math.sin(Math.PI * s), .7); }
    return Math.sqrt(dx * dx + dy * dy) - r - infl;
  }
  const lx = (x - o.cx) * o.cs + (y - o.cy) * o.sn, ly = -(x - o.cx) * o.sn + (y - o.cy) * o.cs;
  const rx = o.rx + infl, ry = o.ry + infl;
  const d = (Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2) - 1) * Math.min(rx, ry);
  return o.k === 3 ? Math.abs(d) - o.th : d;
}
function primBox(o, infl) {
  if (o.k <= 1) { const r = Math.max(o.r0, o.r1) + (o.rb || 0) + infl; return [Math.min(o.ax, o.bx) - r, Math.min(o.ay, o.by) - r, Math.max(o.ax, o.bx) + r, Math.max(o.ay, o.by) + r]; }
  const r = Math.max(o.rx, o.ry) + infl + (o.th || 0); return [o.cx - r, o.cy - r, o.cx + r, o.cy + r];
}

/* ---------- colour ---------- */
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function hslRgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return s === 0 ? [l * 255, l * 255, l * 255].map(Math.round) : [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255)); }
function ramp(hex, n) { // hue-shifted ramp, dark → light
  const [h, s, l] = rgbHsl(hexRgb(hex)), out = [];
  for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1); out.push(hslRgb(h + (t - .55) * 22, Math.min(1, s * (1.12 - .25 * t)), Math.min(.95, Math.max(.05, l * (.5 + .72 * t) + .04 * t)))); }
  return out;
}
const PAL = { muscle: ['#8e2f2b', '#b8443a', '#df6a4b'], tendon: '#d9cdb4', bone: '#e4d8bb', deep: '#6e2a2c', metal: '#4d535c', ghost: [120, 150, 170], eye: [24, 20, 26], socket: [46, 36, 34], white: [246, 244, 238], glint: [255, 255, 255], flash: [255, 246, 196], flash2: [255, 168, 52] };

/* ---------- raster ---------- */
function sdfQuad(o, x, y) { // convex quad, max of edge distances
  const p = o.pts; let d = -1e9;
  for (let e = 0; e < 4; e++) {
    const ax = p[e * 2], ay = p[e * 2 + 1], bx = p[((e + 1) % 4) * 2], by = p[((e + 1) % 4) * 2 + 1];
    const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1e-9;
    const v = ((x - ax) * ey - (y - ay) * ex) / l * o.sg; if (v > d) d = v;
  }
  return d;
}
function renderSprite(R, fr, o) {
  const W = o.W, Hh = o.H, ppm = o.ppm, ox = o.ox, oy = o.oy, mode = o.mode || 'skin', N = o.levels || 4, H = R.H, p = R.p;
  const { prims, over, F } = buildPrims(R, fr);
  const px = 1 / ppm, fatT = R.fatT, kS = (.005 + .022 * Math.min(1, p.fat / 40)) * H;
  const wear = mode === 'skin' && o.wear ? o.wear : null, ww = wear ? wear.w : null;
  const gar = wear ? shellGarments(ww, H) : [];
  const yaw = fr.yaw || 0, cyw = Math.cos(yaw), syw = Math.sin(yaw), cxw = fr.x, flip = cyw < 0;
  const use = q => q.mat === 7 || (mode === 'skin' ? (q.mat <= 2 || (q.mat === 3 && q.lm)) : mode === 'muscle' ? (q.mat === 1 || q.mat === 2 || q.mat === 3 || (q.mat === 0 && q.mm !== 'none')) : q.mat === 3);
  const infl = q => mode === 'skin' ? q.fat * fatT : 0;
  const NPX = W * Hh;
  // ----- body coordinates for garment coverage -----
  const TX = (x, sd, lat) => cxw + (x - cxw) * cyw + sd * lat * syw;
  const segLists = [], latA = .1 * H * p.chest, latL = .05 * H;
  const sideOf = g => { const s = g < 2 ? 'F' : 'N'; return flip ? (s === 'N' ? 'F' : 'N') : s; };
  for (let g = 0; g < 5; g++) {
    const names = g === 2 ? ['pelvis', 'abdomen', 'thorax', 'neck', 'head'] : (g === 1 || g === 3) ? ['thigh', 'shank', 'foot', 'toes'] : ['upperArm', 'forearm', 'hand'];
    const side = sideOf(g), sd = g === 2 ? 0 : side === 'N' ? 1 : -1, lat = (g === 1 || g === 3) ? latL : latA;
    segLists[g] = names.map(n => { const s = F.S[SI[g === 2 ? n : n + side]]; return { n, ax: TX(s.ox, sd, lat), ay: s.oy, bx: TX(s.ex, sd, lat), by: s.ey }; });
  }
  let hg = null;
  if (gar.length) { const h0 = headGeom(R, F, ww); hg = Object.assign({}, h0, { cx: TX(h0.cx, 0, 0), ax: h0.ax * cyw, bx: h0.bx * cyw }); const la = Math.hypot(hg.ax, hg.ay) || 1, lb = Math.hypot(hg.bx, hg.by) || 1; hg.ax /= la; hg.ay /= la; hg.bx /= lb; hg.by /= lb; }
  const coordAt = (g, x, y) => {
    let best = 1e9, bn = null, bu = 0;
    for (const s of segLists[g]) {
      const bx = s.bx - s.ax, by = s.by - s.ay, l2 = bx * bx + by * by, t = l2 > 1e-12 ? clamp(((x - s.ax) * bx + (y - s.ay) * by) / l2, 0, 1) : 0;
      const d = Math.hypot(x - s.ax - bx * t, y - s.ay - by * t); if (d < best) { best = d; bn = s.n; bu = t; }
    }
    const c = { seg: bn, u: bu, core: g === 2 };
    if (SEG_S[bn]) c.s = SEG_S[bn](bu); else c.a = SEG_A[bn](bu);
    if (bn === 'head' && hg) { const r = hg.rx, dx = x - hg.cx, dy = y - hg.cy; c.l = (dx * hg.ax + dy * hg.ay) / r; c.b = (dx * hg.bx + dy * hg.by) / r; }
    return c;
  };
  const covering = c => { let k = -1; for (let i = 0; i < gar.length; i++) if (gar[i].cov(c)) k = i; return k; };
  // ----- layers -----
  const layers = [];
  const groups = [[], [], [], [], []];
  const faceOn = !!(o.face && o.face.M);
  const headList = [];
  for (const q of prims) if (use(q)) { if (faceOn && q.headPart) headList.push(q); else groups[q.g].push(q); }
  if (faceOn && gar.length) groups.push(headList); // carries hoods, masks, hair caps over the 3D face
  if (gar.length) for (let g = 0; g < groups.length; g++) for (const q of groups[g]) {
    const mx = q.k <= 1 ? (q.ax + q.bx) / 2 : q.cx, my = q.k <= 1 ? (q.ay + q.by) / 2 : q.cy, c = coordAt(Math.min(g, 2), mx, my);
    let off = 0; for (const G of gar) if (G.cov(c) || (G.hair && c.seg === 'head')) off = Math.max(off, c.a !== undefined && G.offA !== undefined ? G.offA : G.off);
    if (c.s !== undefined && c.s > 3.85 && c.s < 5) off = Math.min(off, .012 * H); // collars stay close to the neck
    q.cOff = q.mat === 7 ? 0 : off;
  }
  const evalList = (list, smooth, L, inf, cloth) => {
    if (!list.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const boxes = list.map(q => { const b = q.k === 4 ? q.box : primBox(q, inf(q) + (q.cOff || 0) + (smooth ? kS : 0)); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); return b; });
    const pxa = Math.max(0, Math.floor(ox + x0 * ppm) - 2), pxb = Math.min(W - 1, Math.ceil(ox + x1 * ppm) + 2);
    const pya = Math.max(0, Math.floor(oy - y1 * ppm) - 2), pyb = Math.min(Hh - 1, Math.ceil(oy - y0 * ppm) + 2);
    const infs = list.map(inf), coff = list.map(q => q.cOff || 0);
    for (let py = pya; py <= pyb; py++) {
      const wy = (oy - (py + .5)) / ppm;
      for (let pxx = pxa; pxx <= pxb; pxx++) {
        const wx = (pxx + .5 - ox) / ppm;
        let d = 1e9, dc = 1e9, best = 1e9, bi = -1;
        for (let i = 0; i < list.length; i++) {
          const b = boxes[i];
          const ex = Math.max(b[0] - wx, 0, wx - b[2]), ey = Math.max(b[1] - wy, 0, wy - b[3]);
          if ((ex > 0 || ey > 0) && Math.sqrt(ex * ex + ey * ey) > (smooth ? Math.min(d, dc) + kS : d)) continue;
          const q = list[i], d0 = q.k === 4 ? sdfQuad(q, wx, wy) : sdfPrim(q, wx, wy, 0), di = d0 - infs[i];
          if (di < best) { best = di; bi = i; }
          if (smooth) { const h = Math.max(kS - Math.abs(d - di), 0) / kS; d = Math.min(d, di) - h * h * kS * .25; }
          else if (di < d) d = di;
          if (cloth) { const dj = di - coff[i]; const h = Math.max(kS - Math.abs(dc - dj), 0) / kS; dc = Math.min(dc, dj) - h * h * kS * .25; }
        }
        const idx = py * W + pxx;
        if (d < L.sd[idx]) { L.sd[idx] = d; L.win[idx] = bi; }
        if (cloth && dc < L.sdC[idx]) L.sdC[idx] = dc;
      }
    }
  };
  for (let g0 = 0; g0 < groups.length; g0++) {
    const top = g0 === 5, g = top ? 2 : g0;
    const L = { z: top ? 2.32 : g, body: true, g, top, list: groups[g0], sd: new Float32Array(NPX).fill(1e9), win: new Int16Array(NPX).fill(-1) };
    if (gar.length) { L.sdC = new Float32Array(NPX).fill(1e9); L.gi = new Int8Array(NPX).fill(-1); L.pat = new Int8Array(NPX); }
    evalList(groups[g0], mode === 'skin', L, infl, !!gar.length);
    if (gar.length) for (let i = 0; i < NPX; i++) if (L.sdC[i] < 0) {
      const x = ((i % W) + .5 - ox) / ppm, y = (oy - (Math.floor(i / W) + .5)) / ppm, c = coordAt(g, x, y);
      if (top && c.seg !== 'head') continue;
      const k = covering(c);
      if (k >= 0) { L.gi[i] = k; const G = gar[k];
        if (G.pattern === 'stripes') L.pat[i] = Math.floor((c.s !== undefined ? c.s : c.a) * 5) & 1;
        else if (G.pattern === 'trim') L.pat[i] = (c.s !== undefined ? (c.s - G.hem < .14 || c.s > 3.95) : (G.sleeve - c.a < .12)) ? 1 : 0; }
    }
    layers.push(L);
  }
  let ghost = null;
  if (mode === 'bone') { ghost = new Float32Array(NPX).fill(1e9); const G = { sd: ghost, win: new Int16Array(NPX) }; for (let g = 0; g < 5; g++) evalList(prims.filter(q => q.g === g && q.mat <= 2 && !(faceOn && q.headPart)), true, G, q => q.fat * fatT, false); }
  // strands (hair, cloth) and rigid accessories
  if (wear) {
    const S = wear.spec.strands, pos = wear.pos, offs = wear.offsets, byZ = new Map();
    const shift = o.shiftX || 0;
    const P = (k, i) => { const j = (offs[k] + i) * 2; return [TX(pos[j] - shift, 0, 0) + (S[k].z || 0) * syw, pos[j + 1]]; };
    const zOf = s => (s.mirror && flip) ? 4 - s.layer : s.layer;
    const push = (z, q) => { if (!byZ.has(z)) byZ.set(z, []); byZ.get(z).push(q); };
    for (let k = 0; k < S.length; k++) {
      const s = S[k], z = zOf(s);
      for (let i = 0; i < s.n - 1; i++) {
        const a = P(k, i), b = P(k, i + 1);
        let r0 = lerp(s.r0, s.r1, i / (s.n - 1)) * H, r1 = lerp(s.r0, s.r1, (i + 1) / (s.n - 1)) * H;
        if (s.braid) { r0 *= i % 2 ? .7 : 1.15; r1 *= i % 2 ? 1.15 : .7; }
        push(z, { k: 0, ax: a[0], ay: a[1], bx: b[0], by: b[1], r0, r1, ck: s.ck, fold: false });
      }
    }
    for (const f of wear.spec.fills) {
      const z = (f.mirror && flip) ? 4 - f.layer : f.layer, ids = f.ids, m = ids.length;
      if (f.ribbon) { // the sheet's visible width, swept toward the back/down side of its centre line
        const k0 = ids[0], n = S[k0].n, face = flip ? -1 : 1;
        const Pc = [], Qc = [];
        for (let i = 0; i < n; i++) {
          const a = P(k0, Math.max(0, i - 1)), b = P(k0, Math.min(n - 1, i + 1)), c = P(k0, i);
          let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          let nx = -dy, ny = dx; if (-nx * face * .7 - ny * .3 < 0) { nx = -nx; ny = -ny; }
          const wd = f.ribbon * (.2 + .8 * Math.pow(i / (n - 1), .8));
          Pc.push(c); Qc.push([c[0] + nx * wd, c[1] + ny * wd]);
        }
        for (let i = 0; i < n - 1; i++) {
          const pts = [Pc[i][0], Pc[i][1], Pc[i + 1][0], Pc[i + 1][1], Qc[i + 1][0], Qc[i + 1][1], Qc[i][0], Qc[i][1]];
          let area = 0; for (let e = 0; e < 4; e++) area += pts[e * 2] * pts[((e + 1) % 4) * 2 + 1] - pts[((e + 1) % 4) * 2] * pts[e * 2 + 1];
          if (Math.abs(area) < 1e-10) continue;
          const box = [Math.min(pts[0], pts[2], pts[4], pts[6]), Math.min(pts[1], pts[3], pts[5], pts[7]), Math.max(pts[0], pts[2], pts[4], pts[6]), Math.max(pts[1], pts[3], pts[5], pts[7])];
          push(z, { k: 4, pts, sg: area > 0 ? 1 : -1, box, ck: f.ck, fold: i % 3 === 1 });
          push(z, { k: 0, ax: Qc[i][0], ay: Qc[i][1], bx: Qc[i + 1][0], by: Qc[i + 1][1], r0: .004 * H, r1: .004 * H, ck: f.ck, fold: false });
        }
      }
      for (let a = 0; a < m - (f.closed ? 0 : 1); a++) {
        const ka = ids[a], kb = ids[(a + 1) % m], nn = Math.min(S[ka].n, S[kb].n);
        for (let i = 0; i < nn - 1; i++) {
          const p1 = P(ka, i), p2 = P(ka, i + 1), p3 = P(kb, i + 1), p4 = P(kb, i);
          const pts = [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]];
          let area = 0; for (let e = 0; e < 4; e++) area += pts[e * 2] * pts[((e + 1) % 4) * 2 + 1] - pts[((e + 1) % 4) * 2] * pts[e * 2 + 1];
          if (Math.abs(area) < 1e-10) continue;
          // reject self-crossing quads (strands swapped sides): split into two triangles instead
          const box = [Math.min(pts[0], pts[2], pts[4], pts[6]), Math.min(pts[1], pts[3], pts[5], pts[7]), Math.max(pts[0], pts[2], pts[4], pts[6]), Math.max(pts[1], pts[3], pts[5], pts[7])];
          push(z, { k: 4, pts, sg: area > 0 ? 1 : -1, box, ck: f.ck, fold: !!(S[kb].fold) });
        }
      }
    }
    if (ww.pauldronOn) for (const side of ['N', 'F']) {
      const ua = F.S[SI['upperArm' + side]], sd = side === 'N' ? 1 : -1, z = flip ? (side === 'N' ? .6 : 4.6) : (side === 'N' ? 4.6 : .6);
      const ax = TX(ua.ox - ua.dx * .02 * H, sd, latA), ay = ua.oy - ua.dy * .02 * H, bx = TX(ua.ox + ua.dx * .2 * ua.len, sd, latA), by = ua.oy + ua.dy * .2 * ua.len;
      push(z, { k: 0, ax, ay, bx, by, r0: .042 * H * p.chest * (p.armBulk || 1) ** .5, r1: .036 * H * (p.armBulk || 1) ** .5, ck: 'pauldron', fold: false });
    }
    for (const [z, list] of byZ) {
      const L = { z, body: false, list, sd: new Float32Array(NPX).fill(1e9), win: new Int16Array(NPX).fill(-1) };
      evalList(list, false, L, () => 0, false);
      layers.push(L);
    }
  }
  if (faceOn) {
    // the muscle-driven 3D head from the Face tab, placed on the head segment and turned with the body
    const g = F.S[SI.head], s = g.len, nX = g.dy, nY = -g.dx, yc = .02, zc = -.02, cs = Math.cos(yaw), sn = Math.sin(yaw);
    // a little extra turn of the face toward the viewer (classic sprite cheat) so both eyes read
    const tq = (p.faceTurn === undefined ? 18 : p.faceTurn) * Math.PI / 180 * Math.abs(cs), ct = Math.cos(tq), st = Math.sin(tq);
    const view = {
      V: (x0, y, z0) => { const x = x0 * ct - z0 * st, z = x0 * st + z0 * ct, u = (z - zc) * s, v = (y - yc) * s, bx = g.ox + g.dx * v + nX * u, by = g.oy + g.dy * v + nY * u, f = bx - cxw, X = cxw + f * cs - x * s * sn, D = -f * sn - x * s * cs; return [ox + X * ppm, oy - by * ppm, D]; },
      N: (nx0, ny, nz0) => { const nx = nx0 * ct - nz0 * st, nz = nx0 * st + nz0 * ct, Nx = g.dx * ny + nX * nz, Ny = g.dy * ny + nY * nz; return [Nx * cs - nx * sn, Ny, -Nx * sn - nx * cs]; },
    };
    const fs = o.face, fmode = mode === 'bone' ? 'skull' : mode === 'muscle' ? 'muscle' : 'skin';
    const rgba = faceRender(fs.M, { X: fs.X, act: fs.act, gaze: fs.gaze, head: { yaw: 0, pitch: 0, roll: 0 } }, fs.ctrl || {}, { W, H: Hh, view, mode: fmode, levels: Math.max(2, Math.min(6, N)), skin: o.skin, iris: p.irisColor, outline: 'none', cutNeck: true, eyeDots: s * ppm < 26, depthScale: s });
    layers.push({ z: 2.3, raster: true, rgba, sd: new Float32Array(0) });
  }
  layers.sort((a, b) => a.z - b.z);
  const NL = layers.length, coreL = layers.findIndex(L => L.body && L.g === 2);
  // palettes
  const levels = Math.max(2, Math.min(6, N));
  const R_skin = ramp(o.skin || '#c98e6b', levels), R_mus = PAL.muscle.map(c => ramp(c, levels)), R_ten = ramp(PAL.tendon, levels), R_bone = ramp(PAL.bone, levels), R_deep = ramp(PAL.deep, levels), R_metal = ramp(PAL.metal, levels);
  const rcache = {}; const rampHex = hex => rcache[hex] || (rcache[hex] = ramp(hex, levels));
  const CK = ww ? { hair: ww.hairColor, tie: '#2a2228', cape: ww.capeColor, skirt: ww.skirtColor, scarf: ww.scarfColor, band: ww.bandColor, top: ww.topColor, pauldron: ww.pauldronColor } : {};
  const rampAt = (li, i) => {
    const L = layers[li];
    if (L.raster) return [[L.rgba[i * 4], L.rgba[i * 4 + 1], L.rgba[i * 4 + 2]]];
    if (!L.body) { const q = L.list[L.win[i]]; return q ? rampHex(CK[q.ck] || '#888888') : R_skin; }
    if (L.gi && L.gi[i] >= 0) { const G = gar[L.gi[i]]; return rampHex(L.pat[i] && G.trim ? G.trim : G.color); }
    const wi = L.win[i]; if (wi < 0) return R_skin;
    const q = L.list[wi];
    if (q.mat === 7) return R_metal;
    if (q.tusk) return R_bone;
    if (mode === 'skin') return R_skin;
    if (q.mat === 1) return R_mus[q.act > .6 ? 2 : q.act > .25 ? 1 : 0];
    if (q.mat === 2) return R_ten;
    if (q.mat === 3) return R_bone;
    return q.mm === 'bone' ? R_bone : R_deep;
  };
  const inside = (L, i) => L.raster ? L.rgba[i * 4 + 3] > 0 : L.top ? L.gi[i] >= 0 : L.body ? (L.sd[i] < 0 || (L.gi && L.gi[i] >= 0)) : L.sd[i] < 0;
  const field = (L, i) => (L.gi && L.gi[i] >= 0) ? L.sdC : L.sd;
  const out = new Uint8ClampedArray(NPX * 4);
  const owner = new Int8Array(NPX).fill(-1);
  for (let i = 0; i < NPX; i++) for (let li = NL - 1; li >= 0; li--) if (inside(layers[li], i)) { owner[i] = li; break; }
  if (o.shadow) {
    const lift = Math.max(0, Math.min(minY(F.feet.N), minY(F.feet.F)));
    const k = Math.max(0, 1 - lift / (.6 * H)), rx = .2 * H * (.4 + .6 * k), ry = .028 * H * (.5 + .5 * k), cx = F.com.x;
    for (let py = Math.floor(oy - ry * ppm) - 1; py <= Math.ceil(oy + ry * ppm) + 1; py++) for (let pxx = Math.floor(ox + (cx - rx) * ppm); pxx <= Math.ceil(ox + (cx + rx) * ppm); pxx++) {
      if (py < 0 || py >= Hh || pxx < 0 || pxx >= W) continue;
      const wx = (pxx + .5 - ox) / ppm - cx, wy = (oy - (py + .5)) / ppm;
      if ((wx / rx) ** 2 + (wy / ry) ** 2 <= 1) { const i4 = (py * W + pxx) * 4; out[i4 + 3] = Math.round(70 * (.5 + .5 * k)); }
    }
  }
  const Lx = -.5, Ly = .68, Lz = .55, Ln = Math.hypot(Lx, Ly, Lz), Rref = .03 * H;
  for (let py = 0; py < Hh; py++) for (let pxx = 0; pxx < W; pxx++) {
    const i = py * W + pxx, li = owner[i], i4 = i * 4;
    if (li < 0) { if (ghost && ghost[i] < 0) { out[i4] = PAL.ghost[0]; out[i4 + 1] = PAL.ghost[1]; out[i4 + 2] = PAL.ghost[2]; out[i4 + 3] = 70; } continue; }
    if (layers[li].raster) {
      const R4 = layers[li].rgba; let dk = 1;
      for (const n of [i - 1, i + 1, i - W, i + W]) if (n >= 0 && n < NPX && owner[n] >= 0 && owner[n] < li) dk = .62;
      out[i4] = R4[i4] * dk; out[i4 + 1] = R4[i4 + 1] * dk; out[i4 + 2] = R4[i4 + 2] * dk; out[i4 + 3] = 255; continue;
    }
    const L = layers[li], A = field(L, i), d = A[i];
    const at = (j) => { const v = A[j]; return v > 1e8 ? d + px : v; };
    const dl = pxx > 0 ? at(i - 1) : d + px, dr = pxx < W - 1 ? at(i + 1) : d + px, du = py > 0 ? at(i - W) : d + px, dd = py < Hh - 1 ? at(i + W) : d + px;
    let gx = dr - dl, gy = du - dd; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    const rr = L.body ? Rref : .018 * H, t = Math.min(1, Math.max(0, -d / rr)), s = 1 - t;
    let nx = gx * s, ny = gy * s, nz = Math.sqrt(Math.max(0, 1 - s * s)) + .15; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const lam = Math.max(0, (nx * Lx + ny * Ly + nz * Lz) / Ln);
    let lv = Math.min(levels - 1, Math.floor((.1 + .9 * lam) * levels));
    if (L.z < 2 && L.z >= 0) lv = Math.max(0, lv - 1);
    if (L.z < 0) lv = Math.max(0, lv - 1);
    if (!L.body && ppm > 45) { const q = L.list[L.win[i]]; if (q && q.fold) lv = Math.max(0, lv - 1); }
    if (mode === 'muscle' && L.body && L.win[i] >= 0 && L.list[L.win[i]].mat === 1) {
      const wv = L.win[i];
      if ((pxx < W - 1 && owner[i + 1] === li && L.win[i + 1] !== wv && L.win[i + 1] >= 0 && L.list[L.win[i + 1]].mat === 1) || (py < Hh - 1 && owner[i + W] === li && L.win[i + W] !== wv && L.win[i + W] >= 0 && L.list[L.win[i + W]].mat === 1)) lv = Math.max(0, lv - 2);
    }
    // contour where this part overlaps something behind it, and between garments and skin
    let edge = false;
    for (const n of [i - 1, i + 1, i - W, i + W]) if (n >= 0 && n < NPX && owner[n] >= 0 && owner[n] < li && d > -1.1 * px) edge = true;
    if (!edge && L.gi) { const g0 = L.gi[i]; for (const n of [i - 1, i + 1, i - W, i + W]) if (n >= 0 && n < NPX && owner[n] === li && L.gi[n] !== g0 && (g0 > L.gi[n])) edge = true; }
    if (edge) lv = 0;
    const c = rampAt(li, i)[lv]; out[i4] = c[0]; out[i4 + 1] = c[1]; out[i4 + 2] = c[2]; out[i4 + 3] = 255;
  }
  for (const q of over) {
    if (q.vis === false) continue;
    if ((q.mat === 4 || q.mat === 8 || q.mat === 9) && mode !== 'skin') continue;
    if (faceOn && q.mat !== 10 && q.mat !== 11) continue;
    if (q.mat === 5 && mode === 'skin') continue;
    const b = primBox(q, px);
    const col = { 4: PAL.eye, 5: PAL.socket, 8: PAL.white, 9: PAL.glint, 10: PAL.flash, 11: PAL.flash2 }[q.mat];
    for (let py = Math.max(0, Math.floor(oy - b[3] * ppm)); py <= Math.min(Hh - 1, Math.ceil(oy - b[1] * ppm)); py++) for (let pxx = Math.max(0, Math.floor(ox + b[0] * ppm)); pxx <= Math.min(W - 1, Math.ceil(ox + b[2] * ppm)); pxx++) {
      const i = py * W + pxx; if (!q.top && (owner[i] !== coreL || (layers[coreL].gi && layers[coreL].gi[i] >= 0))) continue;
      const wx = (pxx + .5 - ox) / ppm, wy = (oy - (py + .5)) / ppm;
      const d = q.top ? sdfPrim(q, wx, wy, 0) : Math.hypot(wx - q.ax, wy - q.ay) - Math.max(q.r0, .45 * px);
      if (d <= (q.top ? .35 * px : 0)) { out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = 255; if (q.top) owner[i] = NL - 1; }
    }
  }
  if (o.outline && o.outline !== 'none') {
    const src = new Int8Array(owner);
    for (let py = 0; py < Hh; py++) for (let pxx = 0; pxx < W; pxx++) {
      const i = py * W + pxx; if (src[i] >= 0) continue;
      let nb = -1; for (const n of [pxx > 0 ? i - 1 : -1, pxx < W - 1 ? i + 1 : -1, py > 0 ? i - W : -1, py < Hh - 1 ? i + W : -1]) if (n >= 0 && src[n] >= 0) { nb = n; break; }
      if (nb < 0) continue;
      const i4 = i * 4;
      const c = o.outline === 'black' ? [16, 14, 18] : rampAt(src[nb], nb)[0].map(v => Math.round(v * .55));
      out[i4] = c[0]; out[i4 + 1] = c[1]; out[i4 + 2] = c[2]; out[i4 + 3] = 255;
    }
  }
  return { data: out, F, prims };
}
/* ============================================================
   MARROW — clothing, hair and cloth physics
   Two kinds of wearables:
   1. Shells: garments that follow the body (shirt, trousers, boots,
      gloves, belt, scarf wrap, hair cap, beard). Each covers an interval
      of a body coordinate and inflates the skin surface by its
      thickness + looseness.
   2. Strands: anything that hangs or flows (hair, ponytails, braids,
      skirts and robes, capes, scarf and headband tails, fringe). Each is
      a chain of point masses integrated with Verlet: gravity, quadratic
      air drag against wind, inextensible links, bending stiffness toward
      a rest shape, cloth cohesion between neighbouring strands, and
      collision with the moving body and the floor.
   ============================================================ */
const WEAR_DEFAULTS = {
  outfit: 'Traveller',
  topOn: true, topSleeve: 1.6, topLen: .9, topLoose: .25, topColor: '#5d6f4a', topPattern: 'solid', topTrim: '#c9a85c',
  pantsOn: true, pantsLen: 1, pantsLoose: .3, pantsColor: '#4a4036',
  skirtOn: false, skirtLen: .35, skirtFlare: .25, skirtColor: '#5d6f4a', skirtPleats: 1,
  bootsOn: true, bootHeight: .45, bootColor: '#3b2a20',
  glovesOn: false, gloveLen: .15, gloveColor: '#3b2a20',
  beltOn: true, beltColor: '#7a4f2a',
  capeOn: false, capeLen: .5, capeWidth: .7, capeColor: '#8c2f2b',
  scarfOn: false, scarfLen: .3, scarfColor: '#d9a441',
  bandOn: false, bandTail: .25, bandColor: '#b3261e',
  fringe: 'none', fringeLen: .5,
  pauldronOn: false, pauldronColor: '#8c97a6',
  wind: 0, clothWeight: 1,
  hairStyle: 'short', hairLen: 1, hairVolume: 1, hairStiff: .5, hairColor: '#3a2a20', beard: 'none',
};
const HAIR_STYLES = [['bald', 'Bald'], ['buzz', 'Buzz cut'], ['short', 'Short'], ['bob', 'Bob'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['pigtails', 'Pigtails'], ['braid', 'Braid'], ['topknot', 'Top knot'], ['bun', 'Bun'], ['mohawk', 'Mohawk'], ['spiky', 'Spiky (anime)'], ['afro', 'Afro']];
const HAIR_COLORS = ['#141114', '#3a2a20', '#6b4423', '#a8743a', '#d8b46a', '#b8b2a8', '#8f2d1f', '#3d6fd6', '#e05a9c', '#58c26b'];
const OUTFITS = {
  'Nothing': { topOn: false, pantsOn: false, skirtOn: false, bootsOn: false, glovesOn: false, beltOn: false, capeOn: false, scarfOn: false, bandOn: false, fringe: 'none', pauldronOn: false },
  'Traveller': {},
  'Street': { topOn: true, topSleeve: .45, topLen: .8, topLoose: .2, topColor: '#d8d4cc', topPattern: 'solid', pantsLen: 1, pantsLoose: .15, pantsColor: '#36507a', bootsOn: true, bootHeight: .08, bootColor: '#e9e6df', beltOn: false },
  'Ninja': { topOn: true, topSleeve: 2, topLen: 1, topLoose: .08, topColor: '#202228', topPattern: 'solid', pantsLoose: .1, pantsColor: '#202228', bootsOn: true, bootHeight: .5, bootColor: '#3a3d45', glovesOn: true, gloveLen: .45, gloveColor: '#3a3d45', beltOn: true, beltColor: '#8a1f1f', bandOn: true, bandColor: '#8a1f1f', bandTail: .3, scarfOn: false, capeOn: false, skirtOn: false, fringe: 'none', pauldronOn: false },
  'Monk robe': { topOn: true, topSleeve: 1.9, topLen: 1, topLoose: .7, topColor: '#c86a1e', topPattern: 'trim', topTrim: '#7a2e12', pantsOn: true, pantsLoose: .6, pantsColor: '#c86a1e', skirtOn: true, skirtLen: .95, skirtFlare: .2, skirtColor: '#c86a1e', bootsOn: true, bootHeight: .05, bootColor: '#5b3a1e', beltOn: true, beltColor: '#7a2e12', capeOn: false, scarfOn: false, glovesOn: false, bandOn: false, fringe: 'none', pauldronOn: false },
  'Wizard': { topOn: true, topSleeve: 1.95, topLen: 1, topLoose: .85, topColor: '#3b3f8f', topPattern: 'trim', topTrim: '#d9b44a', skirtOn: true, skirtLen: 1, skirtFlare: .35, skirtColor: '#3b3f8f', pantsOn: false, bootsOn: true, bootHeight: .1, bootColor: '#2a2030', capeOn: true, capeLen: .62, capeWidth: .8, capeColor: '#6a2a7a', beltOn: true, beltColor: '#d9b44a', scarfOn: false, glovesOn: false, bandOn: false, fringe: 'none', pauldronOn: false },
  'Caped hero': { topOn: true, topSleeve: 2, topLen: 1, topLoose: 0, topColor: '#2d4fbf', topPattern: 'solid', pantsOn: true, pantsLoose: 0, pantsColor: '#2d4fbf', bootsOn: true, bootHeight: .75, bootColor: '#b3261e', glovesOn: true, gloveLen: .35, gloveColor: '#b3261e', beltOn: true, beltColor: '#e2b531', capeOn: true, capeLen: .58, capeWidth: .85, capeColor: '#b3261e', skirtOn: false, scarfOn: false, bandOn: false, fringe: 'none', pauldronOn: false },
  'Frontier': { topOn: true, topSleeve: 1.95, topLen: .85, topLoose: .3, topColor: '#9b6b3e', topPattern: 'solid', pantsOn: true, pantsLoose: .25, pantsColor: '#3e4a5c', bootsOn: true, bootHeight: .6, bootColor: '#5a3a24', beltOn: true, beltColor: '#2e2016', fringe: 'both', fringeLen: .6, scarfOn: true, scarfLen: .18, scarfColor: '#a8322c', capeOn: false, skirtOn: false, glovesOn: false, bandOn: false, pauldronOn: false },
  'Knight': { topOn: true, topSleeve: 1.9, topLen: 1, topLoose: .35, topColor: '#9aa3ad', topPattern: 'solid', skirtOn: true, skirtLen: .42, skirtFlare: .15, skirtColor: '#7a1f2b', pantsOn: true, pantsLoose: .15, pantsColor: '#6c737c', bootsOn: true, bootHeight: .8, bootColor: '#8c97a6', glovesOn: true, gloveLen: .5, gloveColor: '#8c97a6', beltOn: true, beltColor: '#3a2a20', pauldronOn: true, pauldronColor: '#b9c2cc', capeOn: true, capeLen: .5, capeWidth: .7, capeColor: '#7a1f2b', scarfOn: false, bandOn: false, fringe: 'none' },
  'Barbarian': { topOn: false, pantsOn: false, skirtOn: true, skirtLen: .3, skirtFlare: .2, skirtColor: '#6b4a2e', skirtPleats: 0, bootsOn: true, bootHeight: .55, bootColor: '#6b4a2e', beltOn: true, beltColor: '#3a2a20', glovesOn: true, gloveLen: .35, gloveColor: '#5a3a24', pauldronOn: true, pauldronColor: '#7a5a3a', fringe: 'none', capeOn: false, scarfOn: false, bandOn: false },
  'School uniform': { topOn: true, topSleeve: 1.9, topLen: .7, topLoose: .2, topColor: '#f1efe9', topPattern: 'trim', topTrim: '#24305e', skirtOn: true, skirtLen: .32, skirtFlare: .35, skirtColor: '#24305e', skirtPleats: 1, pantsOn: false, bootsOn: true, bootHeight: .1, bootColor: '#2a2420', scarfOn: true, scarfLen: .14, scarfColor: '#c42f3a', beltOn: false, capeOn: false, glovesOn: false, bandOn: false, fringe: 'none', pauldronOn: false },
};

/* ---------- body coordinates ----------
   s runs along the trunk and legs: foot -1.1 · ankle -1 · knee 0 · hip 1 · waist 2 · chest 3 · neck 4 · head 5
   a runs along the arm: shoulder 0 · elbow 1 · wrist 2 · fingertips 3 */
const SEG_S = { pelvis: u => 1 + u, abdomen: u => 2 + u, thorax: u => 3 + u, neck: u => 4 + u, head: u => 5 + u, thigh: u => 1 - u, shank: u => -u, foot: () => -1.1, toes: () => -1.2 };
const SEG_A = { upperArm: u => u, forearm: u => 1 + u, hand: u => 2 + u };

/* shell garments, innermost first. cov(c) gets {seg, u, s, a, l, b} (l, b = head-local, units of head radius) */
function shellGarments(w, H) {
  const out = [];
  const hemS = 2.55 - 1.5 * w.topLen, pantsEnd = .6 - 1.55 * w.pantsLen, bootTop = -.97 + .95 * w.bootHeight, gloveA = 2 - w.gloveLen * 1.1;
  if (w.pantsOn) out.push({ id: 'pants', off: (.006 + .04 * w.pantsLoose) * H, color: w.pantsColor, cov: c => c.s !== undefined && c.s >= pantsEnd && c.s <= 2.25 });
  if (w.topOn) out.push({ id: 'top', off: (.007 + .05 * w.topLoose) * H, offA: (.006 + .026 * w.topLoose) * H, color: w.topColor, trim: w.topTrim, pattern: w.topPattern, hem: hemS, sleeve: w.topSleeve,
    cov: c => c.s !== undefined ? (c.s >= hemS && c.s <= 4.12) : (c.a !== undefined && w.topSleeve > .02 && c.a <= w.topSleeve) });
  if (w.bootsOn) out.push({ id: 'boots', off: .011 * H, color: w.bootColor, cov: c => c.s !== undefined && c.s <= bootTop });
  if (w.glovesOn) out.push({ id: 'gloves', off: .006 * H, color: w.gloveColor, cov: c => c.a !== undefined && c.a >= gloveA });
  if (w.beltOn) out.push({ id: 'belt', off: (.016 + .05 * Math.max(w.topOn ? w.topLoose : 0, w.pantsOn ? w.pantsLoose * .8 : 0)) * H, color: w.beltColor, core: true, cov: c => c.s !== undefined && c.s >= 2.02 && c.s <= 2.2 && c.core });
  if (w.scarfOn) out.push({ id: 'scarf', off: .022 * H, color: w.scarfColor, cov: c => c.s !== undefined && c.s >= 3.96 && c.s <= 4.6 });
  if (w.bandOn) out.push({ id: 'band', off: .01 * H, color: w.bandColor, cov: c => c.l !== undefined && c.l > .5 - .35 * c.b && c.l < .8 - .35 * c.b });
  const hs = w.hairStyle;
  if (hs !== 'bald') {
    const cap = { buzz: .004, short: .013, bob: .016, long: .014, ponytail: .008, pigtails: .009, braid: .008, topknot: .008, bun: .009, mohawk: .003, spiky: .018, afro: .055 }[hs] * H * (hs === 'buzz' || hs === 'mohawk' ? 1 : w.hairVolume);
    const line = hs === 'afro' ? -.1 : hs === 'buzz' ? .3 : .2;
    out.push({ id: 'hair', off: cap, color: w.hairColor, hair: true, cov: c => c.l !== undefined && c.l > line - .55 * c.b && !(c.b < -.35 && c.l < .05) });
  }
  if (w.beard !== 'none') {
    const off = { stubble: .002, short: .011, long: .013 }[w.beard] * H;
    out.push({ id: 'beard', off, color: w.hairColor, hair: true, beard: w.beard, cov: c => c.l !== undefined && c.l < -.12 && c.b < .3 && c.l > -1.4 && !(c.l > -.45 && c.b > -.05) });
  }
  return out;
}

/* ---------- strand specification ---------- */
const DEG = Math.PI / 180;
function headGeom(R, F, w) { // head ellipse in world: centre, axis, back unit, radii
  const g = F.S[SI.head], H = R.H, p = R.p, hk = p.headL;
  const nx = g.dy, ny = -g.dx; // anterior for core segments
  const cx = g.ox + g.dx * .46 * g.len + nx * .012 * H, cy = g.oy + g.dy * .46 * g.len + ny * .012 * H;
  const rx = .066 * H * hk, ry = lerp(.056, .066 * 1.02, p.headRound || 0) * H * hk;
  return { cx, cy, ax: g.dx, ay: g.dy, bx: -nx, by: -ny, rx, ry, a: g.a };
}
function strandSpec(R, w) {
  const H = R.H, p = R.p, hk = p.headL, S = [], fills = [];
  const hl = w.hairLen, vol = w.hairVolume, st = w.hairStiff;
  const add = o => { o.id = S.length; S.push(Object.assign({ n: 8, z: 0, curl: 0, r0: .01, r1: .005, stiff: .1, drag: .5, layer: 2.5, ck: 'hair', body: true, legs: 'z' }, o)); return o.id; };
  const capOff = { bald: 0, buzz: .004, short: .013, bob: .016, long: .014, ponytail: .008, pigtails: .009, braid: .008, topknot: .008, bun: .009, mohawk: .003, spiky: .018, afro: .055 }[w.hairStyle] * H * vol;
  const hair = (th, phi, len, o) => add(Object.assign({ at: { head: th * DEG, off: capOff * .6 }, phi: phi * DEG, len: len * H * hl }, o));
  const hs = w.hairStyle;
  if (hs === 'short') {
    for (const th of [-58, -44, -30]) hair(th, th - 150, .045, { n: 4, stiff: .55 + .4 * st, r0: .011 * vol, r1: .004, z: (th + 44) * .0006 * H });
    for (const th of [95, 115, 130]) hair(th, 168, .035, { n: 3, stiff: .6 + .3 * st, r0: .01 * vol, r1: .005 });
  } else if (hs === 'bob' || hs === 'long') {
    const L = hs === 'bob' ? .12 : .4, ids = [];
    const ths = hs === 'bob' ? [-55, -30, 0, 30, 60, 90, 118, 140] : [-45, -15, 15, 45, 75, 100, 122, 142];
    ths.forEach((th, k) => { const id = hair(th, th < 10 ? 186 : 176, L * (th < -20 ? .8 : 1), { n: hs === 'bob' ? 6 : 10, stiff: (.08 + .25 * st) * (hs === 'bob' ? 1.6 : 1), r0: .012 * vol, r1: .008 * vol, drag: .45, z: (th < 10 ? (k % 2 ? 1 : -1) * .072 * hk : Math.sin(k * 2.1) * .025) * H, fold: true }); if (th >= 10) ids.push(id); });
    fills.push({ ids, layer: 2.5, ck: 'hair' });
    if (hs === 'long') for (const th of [-55, -42]) hair(th, th - 140, .06, { n: 4, stiff: .5 + .3 * st, r0: .01 * vol, r1: .004 });
  } else if (hs === 'ponytail' || hs === 'braid') {
    const ids = [];
    for (let k = 0; k < (hs === 'braid' ? 1 : 4); k++) ids.push(hair(105, 150, hs === 'braid' ? .42 : .32, { n: 10, stiff: .05 + .12 * st, r0: (hs === 'braid' ? .016 : .015) * vol, r1: (hs === 'braid' ? .008 : .005) * vol, drag: .4, z: (k - 1.5) * .006 * H, braid: hs === 'braid', fold: true }));
    if (ids.length > 1) fills.push({ ids, layer: 2.5, ck: 'hair' });
    hair(105, 150, .012, { n: 2, stiff: 1, r0: .015 * vol, r1: .014 * vol, ck: 'tie' });
  } else if (hs === 'pigtails') {
    for (const z of [.055, -.055]) { const ids = []; for (let k = 0; k < 3; k++) ids.push(hair(78, 160, .26, { n: 8, stiff: .06 + .12 * st, r0: .014 * vol, r1: .005 * vol, z: z * H * hk + (k - 1) * .005 * H, layer: z > 0 ? 2.6 : 1.4 })); fills.push({ ids, layer: z > 0 ? 2.6 : 1.4, ck: 'hair' }); }
  } else if (hs === 'topknot' || hs === 'bun') {
    const th = hs === 'topknot' ? 8 : 70;
    hair(th, th, .03, { n: 2, stiff: 1, r0: .026 * vol, r1: .024 * vol, rigid: true });
    if (hs === 'topknot') hair(th, th + 120, .11, { n: 6, stiff: .25 + .4 * st, r0: .008 * vol, r1: .003 });
  } else if (hs === 'mohawk') {
    for (let k = 0; k < 8; k++) { const th = -45 + k * 22; hair(th, th + 8, .075, { n: 3, stiff: .75 + .24 * st, r0: .011 * vol, r1: .003, z: 0 }); }
  } else if (hs === 'spiky') {
    [-55, -35, -15, 10, 35, 60, 85, 110, 132].forEach((th, k) => hair(th, th + 30 + (th < -20 ? -70 : 0), .1 * (th < -20 ? .8 : 1), { n: 4, stiff: .82 + .17 * st, r0: .02 * vol, r1: .002, z: (k % 2 ? .025 : -.02) * H }));
  }
  if (w.beard === 'long') {
    const ids = []; for (const th of [-150, -138, -126]) ids.push(add({ at: { head: th * DEG, off: .01 * H }, phi: 182 * DEG, len: .16 * H * hl, n: 6, stiff: .12 + .2 * st, r0: .012, r1: .005, layer: 2.7, ck: 'hair', fold: true }));
    fills.push({ ids, layer: 2.7, ck: 'hair' });
  }
  // capes: hang from the upper back, spread across the shoulders
  const cw = .1 * H * p.chest * w.capeWidth;
  if (w.capeOn) {
    // seen from the side a cape reads as a sheet: anchors run down the upper back, hems line up
    const ids = [], K = 4;
    for (let k = 0; k < K; k++) {
      const f = k / (K - 1), u = .95 - f * .3, drop = (.95 - u) * .125 * H * p.torsoL;
      ids.push(add({ at: { seg: 'thorax', u, v: -.062 * p.chest - .004 * f }, phi: (176 - 6 * f) * DEG, len: Math.max(.05 * H, w.capeLen * H - drop), n: 10, stiff: .03, r0: .007, r1: .006, drag: 1.3 / w.clothWeight, layer: -1, ck: 'cape', z: 0, fold: k % 2 === 1, legs: 'flat' }));
    }
    fills.push({ ids, layer: -1, ck: 'cape', cohesion: true, mirror: true, ribbon: .2 * H * w.capeWidth * p.chest });
  }
  // skirts and robes: a ring of strands around the waist; legs push the hem out
  if (w.skirtOn) {
    const ids = [], K = 10, ring = .06 * H * Math.max(1, p.belly * .95), half = .09 * H;
    const hemLen = Math.max(.06, w.skirtLen * .5) * H;
    for (let k = 0; k < K; k++) {
      const ph = k / K * 2 * Math.PI, c = Math.cos(ph), loose = (w.topOn ? .05 * w.topLoose : 0) * H;
      ids.push(add({ at: { seg: 'pelvis', u: .95 - (w.topOn ? .15 : 0), v: (c * (ring + loose)) / H }, phi: (180 + c * (6 + 40 * w.skirtFlare)) * DEG, len: hemLen, n: Math.max(4, Math.round(4 + 6 * w.skirtLen)), stiff: .03 + .08 * (1 - w.skirtLen), r0: .006, r1: .006, drag: 1.1 / w.clothWeight, layer: 3.5, ck: 'skirt', z: Math.sin(ph) * half, legs: 'flat', fold: w.skirtPleats > 0 && k % 2 === 1 }));
    }
    fills.push({ ids, layer: 3.5, ck: 'skirt', closed: true, cohesion: true });
  }
  if (w.scarfOn) {
    const ids = []; for (const z of [.012, -.012]) ids.push(add({ at: { seg: 'neck', u: .35, v: -.03 }, phi: 165 * DEG, len: w.scarfLen * H, n: 7, stiff: .02, r0: .012, r1: .011, drag: 1.2 / w.clothWeight, layer: 2.62, ck: 'scarf', z: z * H }));
    fills.push({ ids, layer: 2.62, ck: 'scarf', cohesion: true });
  }
  if (w.bandOn) {
    const ids = []; for (const z of [.008, -.008]) ids.push(add({ at: { head: 100 * DEG, off: .012 * H }, phi: 150 * DEG, len: w.bandTail * H, n: 7, stiff: .015, r0: .006, r1: .005, drag: 1.3 / w.clothWeight, layer: 2.64, ck: 'band', z: z * H }));
    fills.push({ ids, layer: 2.64, ck: 'band', cohesion: true });
  }
  // fringe: short leather strips along the sleeve underside and around the hem
  const fl = .045 * H * w.fringeLen;
  if ((w.fringe === 'sleeves' || w.fringe === 'both') && w.topOn) for (const side of ['N', 'F']) for (let k = 0; k < 9; k++) {
    const a = k / 8 * Math.min(1.95, w.topSleeve), seg = a < 1 ? 'upperArm' : 'forearm', u = a < 1 ? a : a - 1;
    add({ at: { seg: seg + side, u, v: -.022 - .04 * w.topLoose }, phi: 0, down: true, len: fl, n: 3, stiff: 0, r0: .003, r1: .0025, drag: 1.5, layer: side === 'N' ? 4.5 : .5, ck: 'top', z: (side === 'N' ? 1 : -1) * .12 * H, mirror: true, body: false });
  }
  if ((w.fringe === 'hem' || w.fringe === 'both') && w.topOn) for (let k = 0; k < 10; k++) {
    const ph = k / 10 * 2 * Math.PI, hemS = 2.55 - 1.5 * w.topLen, segU = hemS >= 2 ? ['abdomen', hemS - 2] : ['pelvis', Math.max(0, hemS - 1)];
    add({ at: { seg: segU[0], u: segU[1], v: Math.cos(ph) * (.065 + .045 * w.topLoose) }, phi: 0, down: true, len: fl * 1.2, n: 3, stiff: 0, r0: .003, r1: .0025, drag: 1.5, layer: 3.55, ck: 'top', z: Math.sin(ph) * .09 * H, legs: 'flat' });
  }
  return { strands: S, fills, capOff };
}
function strandAnchor(R, F, s, hg) {
  if (s.at.head !== undefined) {
    const th = s.at.head, rx = hg.rx + s.at.off, ry = hg.ry + s.at.off;
    return { x: hg.cx + hg.ax * Math.cos(th) * rx + hg.bx * Math.sin(th) * ry, y: hg.cy + hg.ay * Math.cos(th) * rx + hg.by * Math.sin(th) * ry, a: hg.a };
  }
  const g = F.S[SI[s.at.seg]], H = R.H;
  const nx = g.ant > 0 ? -g.dy : g.dy, ny = g.ant > 0 ? g.dx : -g.dx;
  return { x: g.ox + g.dx * s.at.u * g.len + nx * s.at.v * H, y: g.oy + g.dy * s.at.u * g.len + ny * s.at.v * H, a: g.a };
}
/* simplified collision bodies: capsules with a lateral (z) extent */
function collisionBodies(R, F, hg, capOff) {
  const H = R.H, p = R.p, out = [];
  const capS = (s, r, zc, zw, leg) => { const g = F.S[SI[s]]; out.push({ ax: g.ox, ay: g.oy, bx: g.ex, by: g.ey, r, zc, zw, leg }); };
  out.push({ ax: hg.cx, ay: hg.cy, bx: hg.cx, by: hg.cy, r: (hg.rx + hg.ry) / 2 + capOff * .8, zc: 0, zw: .075 * H * p.headL });
  { const a = F.S[SI.pelvis], b = F.S[SI.thorax]; out.push({ ax: a.ox, ay: a.oy, bx: b.ex - b.dx * .25 * b.len, by: b.ey - b.dy * .25 * b.len, r: .058 * H * p.chest, zc: 0, zw: .15 * H }); }
  capS('neck', .028 * H, 0, .03 * H);
  const ab = p.armBulk || 1;
  for (const s of ['N', 'F']) {
    const zc = (s === 'N' ? 1 : -1) * .12 * H * p.chest;
    capS('upperArm' + s, .028 * H * ab, zc, .035 * H * ab); capS('forearm' + s, .022 * H * ab, zc, .03 * H * ab);
    const zl = (s === 'N' ? 1 : -1) * .05 * H;
    capS('thigh' + s, .05 * H, zl, .055 * H, true); capS('shank' + s, .036 * H, zl, .04 * H, true);
  }
  return out;
}

/* ---------- cloth / hair physics over an animation ---------- */
function simWear(R, anim, w) {
  const spec = strandSpec(R, w), S = spec.strands, NS = S.length;
  if (!NS) return { spec, frames: anim.frames.map(() => new Float32Array(0)) };
  const H = R.H, frames = anim.frames, n = frames.length, sub = 4, h = 1 / 120 / sub;
  const off = []; let np = 0; for (const s of S) { off.push(np); np += s.n; }
  const P = new Float64Array(np * 2), Q = new Float64Array(np * 2);
  const segLen = S.map(s => s.len / (s.n - 1));
  // per-frame anchors and colliders
  const geo = frames.map(f => { const F = fk(R, f), hg = headGeom(R, F, w); return { anc: S.map(s => strandAnchor(R, F, s, hg)), bod: collisionBodies(R, F, hg, spec.capOff) }; });
  const D = anim.loop && n > 1 ? (frames[n - 1].x - frames[0].x) * n / (n - 1) : 0;
  const restDir = (s, A) => s.down ? -Math.PI / 2 : A.a + s.phi;
  const init = (A, xo) => {
    for (let k = 0; k < NS; k++) { const s = S[k], a0 = A.anc[k]; let x = a0.x + xo, y = a0.y, ang = restDir(s, a0);
      for (let i = 0; i < s.n; i++) { const j = (off[k] + i) * 2; P[j] = Q[j] = x; P[j + 1] = Q[j + 1] = y; x += Math.cos(ang) * segLen[k]; y += Math.sin(ang) * segLen[k]; ang += s.curl; } }
  };
  init(geo[0], 0);
  const wind = w.wind;
  // cohesion rest distances between neighbouring strands (from the rest pose)
  const coh = [];
  for (const f of spec.fills) if (f.cohesion) for (let m = 0; m < f.ids.length - (f.closed ? 0 : 1); m++) {
    const a = f.ids[m], b = f.ids[(m + 1) % f.ids.length], nn = Math.min(S[a].n, S[b].n);
    for (let i = 1; i < nn; i++) { const ja = (off[a] + i) * 2, jb = (off[b] + i) * 2; coh.push([ja, jb, Math.hypot(P[ja] - P[jb], P[ja + 1] - P[jb + 1]) * 1.08 + .004 * H]); }
  }
  const step = (A, B, al, xo) => {
    for (let k = 0; k < NS; k++) {
      const s = S[k], a = A.anc[k], b = B.anc[k], rx = lerp(a.x, b.x, al) + xo, ry = lerp(a.y, b.y, al), base = off[k] * 2;
      P[base] = rx; P[base + 1] = ry; Q[base] = rx; Q[base + 1] = ry;
      const cd = s.drag;
      for (let i = 1; i < s.n; i++) {
        const j = base + i * 2;
        const vx = (P[j] - Q[j]) / h, vy = (P[j + 1] - Q[j + 1]) / h;
        const ux = vx - wind, uy = vy, um = Math.hypot(ux, uy);
        const axx = -cd * um * ux * .5 - .4 * ux, ayy = -GRAV - cd * um * uy * .5 - .4 * uy;
        Q[j] = P[j]; Q[j + 1] = P[j + 1];
        P[j] += vx * h * .998 + axx * h * h; P[j + 1] += vy * h * .998 + ayy * h * h;
      }
    }
    const bod = A.bod;
    for (let it = 0; it < 3; it++) {
      for (let k = 0; k < NS; k++) {
        const s = S[k], base = off[k] * 2, L = segLen[k], anc = (al < .5 ? A : B).anc[k];
        for (let i = 1; i < s.n; i++) {
          const j = base + i * 2, jp = j - 2;
          // bending toward the rest shape (stiffer at the root)
          // stiffness is the fraction of rest-shape error removed per 1/60 s, applied once per substep
          const kb = it > 0 ? 0 : s.rigid ? 1 : 1 - Math.pow(1 - Math.min(.999, s.stiff * Math.pow(1 - (i - 1) / s.n, 1.4)), h * 60);
          if (kb > 0) {
            const want = i === 1 ? restDir(s, anc) : Math.atan2(P[jp + 1] - P[jp - 1], P[jp] - P[jp - 2]) + s.curl;
            const cur = Math.atan2(P[j + 1] - P[jp + 1], P[j] - P[jp]);
            const da = wrapA(want - cur) * kb, c = Math.cos(da), sn = Math.sin(da), dx = P[j] - P[jp], dy = P[j + 1] - P[jp + 1];
            P[j] = P[jp] + dx * c - dy * sn; P[j + 1] = P[jp + 1] + dx * sn + dy * c;
          }
          // inextensible link
          const dx = P[j] - P[jp], dy = P[j + 1] - P[jp + 1], d = Math.hypot(dx, dy) || 1e-9, e = (d - L) / d;
          if (i === 1) { P[j] -= dx * e; P[j + 1] -= dy * e; }
          else { P[j] -= dx * e * .6; P[j + 1] -= dy * e * .6; P[jp] += dx * e * .4; P[jp + 1] += dy * e * .4; }
        }
      }
      for (const [ja, jb, r] of coh) { const dx = P[jb] - P[ja], dy = P[jb + 1] - P[ja + 1], d = Math.hypot(dx, dy); if (d > r) { const e = (d - r) / d * .5; P[ja] += dx * e; P[ja + 1] += dy * e; P[jb] -= dx * e; P[jb + 1] -= dy * e; } }
      // collisions with the body and the floor
      for (let k = 0; k < NS; k++) {
        const s = S[k]; if (s.body === false) { for (let i = 1; i < s.n; i++) { const j = (off[k] + i) * 2; if (P[j + 1] < .002 * H) P[j + 1] = .002 * H; } continue; }
        for (let i = 1; i < s.n; i++) {
          const j = (off[k] + i) * 2, rad = lerp(s.r0, s.r1, i / (s.n - 1)) * H * .5;
          for (const c of bod) {
            if (c.leg && s.legs === 'none') continue;
            let r = c.r;
            if (!(c.leg && s.legs === 'flat')) { const zz = (s.z - c.zc) / c.zw; if (zz * zz >= 1) continue; r *= Math.sqrt(1 - zz * zz); }
            r += rad;
            const bx = c.bx - c.ax + 0, by = c.by - c.ay, px0 = P[j] - xo - c.ax, py0 = P[j + 1] - c.ay, l2 = bx * bx + by * by;
            const t = l2 > 1e-12 ? clamp((px0 * bx + py0 * by) / l2, 0, 1) : 0;
            const dx = px0 - bx * t, dy = py0 - by * t, d = Math.hypot(dx, dy);
            if (d < r && d > 1e-9) { const e = (r - d) / d; P[j] += dx * e; P[j + 1] += dy * e; Q[j] += dx * e * .3; Q[j + 1] += dy * e * .3; }
          }
          if (P[j + 1] < rad) { P[j + 1] = rad; Q[j] = lerp(Q[j], P[j], .5); }
        }
      }
    }
  };
  const out = new Array(n);
  const passes = anim.loop ? 3 : 1;
  // settle on the first pose before the clip starts
  for (let k = 0; k < 120 * (anim.loop ? .3 : .8); k++) for (let ss = 0; ss < sub; ss++) step(geo[0], geo[0], 0, 0);
  for (let pass = 0; pass < passes; pass++) {
    const xo = D * pass;
    for (let i = 0; i < n; i++) {
      const A = geo[i], B = geo[anim.loop ? (i + 1) % n : Math.min(i + 1, n - 1)];
      const wrapJump = anim.loop && i === n - 1 ? D : 0;
      if (pass === passes - 1) { const a = new Float32Array(np * 2); for (let m = 0; m < np; m++) { a[m * 2] = P[m * 2] - xo; a[m * 2 + 1] = P[m * 2 + 1]; } out[i] = a; }
      for (let ss = 0; ss < sub; ss++) {
        const al = ss / sub;
        if (wrapJump) { // next frame is the first of the next cycle, one stride ahead
          const B2 = { anc: B.anc.map(v => ({ x: v.x + D, y: v.y, a: v.a })), bod: B.bod };
          step(A, B2, al, xo);
        } else step(A, B, al, xo);
      }
    }
  }
  return { spec, frames: out, offsets: off };
}
function wearAt(anim, wr, t) {
  const fr = wr.frames, n = fr.length, dt = 1 / 120;
  let x = t / dt; if (anim.loop) x = ((x % n) + n) % n; else x = clamp(x, 0, n - 1);
  const i = Math.floor(x), k = x - i, a = fr[i], b = fr[anim.loop ? (i + 1) % n : Math.min(i + 1, n - 1)];
  if (k < 1e-6 || !a.length) return a;
  const o = new Float32Array(a.length);
  const D = anim.loop && i === n - 1 && anim.frames.length > 1 ? (anim.frames[n - 1].x - anim.frames[0].x) * n / (n - 1) : 0;
  for (let m = 0; m < a.length; m += 2) { o[m] = lerp(a[m], b[m] + D, k); o[m + 1] = lerp(a[m + 1], b[m + 1], k); }
  return o;
}
if (typeof DEFAULTS !== 'undefined') Object.assign(DEFAULTS, WEAR_DEFAULTS);
/* ============================================================
   MARROW — FACE
   A 3D head mesh (cylindrical grid, ~10k vertices) sculpted from
   anthropometric profile curves, deformed every frame by:
     · 30 facial muscles (Waters' linear / sphincter muscle model:
       each pulls its skin insertion zone toward its bony origin,
       with bulging of the bunched tissue),
     · the mandible rotating about the temporomandibular joint,
     · eyelids wrapped over the eyeballs (levator / orbicularis),
     · soft-tissue dynamics: every vertex is a damped spring toward
       its muscle-driven target, softer in cheeks, jowls, lips and
       beard, and feels the inertia of head motion.
   Eyes are spheres turned by six extraocular muscles with saccade
   dynamics; teeth sit on two dental arches; the tongue is a muscular
   hydrostat driven by intrinsic and extrinsic tongue muscles.
   Units: head height (chin to vertex) = 1.
   ============================================================ */
const FACE_DEFAULTS = {
  faceTurn: 18,
  noseStyle: 'straight', noseLen: 1, noseProj: 1, noseWidth: 1, noseHump: 0, noseTip: 0,
  lipFull: 1, mouthW: 1, eyeSize: 1, eyeSpacing: 1, eyeTilt: 0, lashes: 1, irisColor: '#5b7a3c',
  cheekbone: 1, jawW: 1, chinSize: 1, earSize: 1, earPoint: 0,
  browStyle: 'natural', browThick: 1, mustache: 'none', beardStyle: 'none', beardLen: .25, stubble: 0,
  teeth: 'normal', facePower: 1,
};
const NOSE_STYLES = {
  straight: { name: 'Straight', L: 1, tp: .115, hump: 0, rot: 0, aw: 1, tr: 1, dn: .02 },
  roman: { name: 'Roman', L: 1.05, tp: .13, hump: .022, rot: -.08, aw: 1.02, tr: .95, dn: .03 },
  aquiline: { name: 'Aquiline (hooked)', L: 1.1, tp: .125, hump: .032, rot: -.32, aw: .95, tr: .85, dn: .03 },
  snub: { name: 'Snub', L: .85, tp: .085, hump: -.014, rot: .45, aw: 1.02, tr: 1.1, dn: .012 },
  button: { name: 'Button', L: .8, tp: .07, hump: -.006, rot: .25, aw: .92, tr: 1.45, dn: .01 },
  wide: { name: 'Wide / flat', L: .9, tp: .075, hump: -.004, rot: .12, aw: 1.5, tr: 1.35, dn: .006 },
  bulbous: { name: 'Bulbous', L: 1, tp: .135, hump: .006, rot: -.05, aw: 1.1, tr: 1.9, dn: .02 },
  pointed: { name: 'Long & pointed', L: 1.3, tp: .19, hump: .012, rot: -.15, aw: .85, tr: .5, dn: .03 },
  boxer: { name: 'Broken (boxer)', L: .95, tp: .09, hump: .018, rot: 0, aw: 1.35, tr: 1.4, dn: .008, crook: .018 },
  anime: { name: 'Anime', L: .55, tp: .035, hump: 0, rot: .1, aw: .55, tr: .6, dn: 0 },
  snout: { name: 'Snout', L: 1.25, tp: .26, hump: .01, rot: .15, aw: 1.55, tr: 1.6, dn: .06 },
};
const BROW_STYLES = [['none', 'None'], ['thin', 'Thin'], ['natural', 'Natural'], ['arched', 'Arched'], ['straight', 'Straight & thick'], ['bushy', 'Bushy'], ['unibrow', 'Unibrow']];
const MUSTACHES = [['none', 'None'], ['pencil', 'Pencil'], ['chevron', 'Chevron'], ['handlebar', 'Handlebar'], ['walrus', 'Walrus'], ['horseshoe', 'Horseshoe']];
const BEARDS = [['none', 'None'], ['goatee', 'Goatee'], ['soul', 'Soul patch'], ['chinstrap', 'Chin strap'], ['chops', 'Mutton chops'], ['full', 'Full beard'], ['long', 'Long beard (simulated)']];
const TEETH_STYLES = [['normal', 'Normal'], ['fangs', 'Vampire fangs'], ['tusks', 'Tusks'], ['sharp', 'Sharp (shark)'], ['buck', 'Buck teeth'], ['gap', 'Gap'], ['missing', 'Missing tooth']];

/* Facial muscles. side 'B' = bilateral pair. o = origin, i = insertion centre, as [θ deg, y] on the head
   surface (depth pulls the origin under the skin); s = insertion radius; k = pull; b = bulge. AU = FACS. */
const FMUSCLES = [
  { id: 'frontalisM', name: 'Frontalis (medial)', au: 'AU1', o: [9, 1.02], i: [9, .64], s: .07, k: .032, b: 0 },
  { id: 'frontalisL', name: 'Frontalis (lateral)', au: 'AU2', o: [34, 1.0], i: [33, .62], s: .07, k: .034, b: 0 },
  { id: 'corrugator', name: 'Corrugator supercilii', au: 'AU4', o: [3, .555], i: [20, .615], s: .05, k: .026, b: .006 },
  { id: 'procerus', name: 'Procerus', au: 'AU4', o: [0, .44], i: [2, .58], s: .035, k: .02, b: .004 },
  { id: 'orbOculi', name: 'Orbicularis oculi (orbital)', au: 'AU6', o: 'eye', i: [32, .4], s: .065, k: .03, b: .012 },
  { id: 'llsan', name: 'Levator labii sup. alaeque nasi', au: 'AU9', o: [5, .5], i: [8, .33], s: .035, k: .026, b: .004 },
  { id: 'lls', name: 'Levator labii superioris', au: 'AU10', o: [20, .42], i: [9, .245], s: .034, k: .028, b: .004 },
  { id: 'zygMinor', name: 'Zygomaticus minor', au: 'AU11', o: [42, .43], i: [13, .25], s: .028, k: .02, b: .003 },
  { id: 'zygMajor', name: 'Zygomaticus major', au: 'AU12', o: [66, .43], i: 'corner', s: .048, k: .06, b: .014 },
  { id: 'levAnguli', name: 'Levator anguli oris', au: 'AU13', o: [24, .35], i: 'corner', s: .03, k: .026, b: .006 },
  { id: 'buccinator', name: 'Buccinator', au: 'AU14', o: [74, .2], i: 'corner', s: .032, k: .028, b: -.004 },
  { id: 'dao', name: 'Depressor anguli oris', au: 'AU15', o: [30, .03], i: 'corner', s: .036, k: .038, b: .002, jaw: 1 },
  { id: 'dli', name: 'Depressor labii inferioris', au: 'AU16', o: [12, .04], i: [8, -1], s: .03, k: .032, b: 0, jaw: 1 },
  { id: 'mentalis', name: 'Mentalis', au: 'AU17', o: [5, -.02], i: [5, .1], s: .035, k: .022, b: .012, jaw: 1, push: 1 },
  { id: 'risorius', name: 'Risorius', au: 'AU20', o: [74, .26], i: 'corner', s: .036, k: .05, b: .002 },
  { id: 'platysma', name: 'Platysma', au: 'AU21', o: [42, -.38], i: [26, .1], s: .09, k: .026, b: .004, jaw: 1 },
  { id: 'masseter', name: 'Masseter / temporalis', au: 'AU31', o: [80, .15], i: [80, .18], s: .07, k: 0, b: .014, clench: 1 },
  { id: 'nasalisD', name: 'Nasalis (dilator)', au: 'AU38', o: [30, .3], i: [8, .3], s: .02, k: .016, b: 0 },
];
/* sphincter / special actions and jaw */
const FACTIONS = [
  { id: 'lidRaise', name: 'Levator palpebrae (lid raise)', au: 'AU5' },
  { id: 'lidTight', name: 'Orbicularis oculi (lid tighten)', au: 'AU7' },
  { id: 'blink', name: 'Blink / eyes closed', au: 'AU43' },
  { id: 'pucker', name: 'Orbicularis oris (pucker)', au: 'AU18' },
  { id: 'funnel', name: 'Orbicularis oris (funnel)', au: 'AU22' },
  { id: 'tighten', name: 'Orbicularis oris (tighten)', au: 'AU23' },
  { id: 'press', name: 'Orbicularis oris (press)', au: 'AU24' },
  { id: 'part', name: 'Lips part', au: 'AU25' },
  { id: 'tuck', name: 'Lower lip under teeth', au: 'AU28' },
  { id: 'puff', name: 'Cheek puff (air)', au: 'AU34' },
  { id: 'jawOpen', name: 'Jaw open (digastric, lat. pterygoid)', au: 'AU26/27' },
  { id: 'jawFwd', name: 'Jaw thrust', au: 'AU29' },
  { id: 'jawSide', name: 'Jaw sideways', au: 'AU30' },
];
const TONGUE = [
  { id: 'tgProtrude', name: 'Genioglossus (protrude)' }, { id: 'tgRetract', name: 'Styloglossus (retract, raise back)' },
  { id: 'tgTip', name: 'Superior longitudinal (tip up)' }, { id: 'tgTipDown', name: 'Inferior longitudinal (tip down)' },
  { id: 'tgWide', name: 'Verticalis (flatten, widen)' }, { id: 'tgCurl', name: 'Transversus (curl, narrow)' }, { id: 'tgSide', name: 'Lateral (tip to side)' },
];
const EXPRESSIONS = {
  Neutral: {},
  Happy: { orbOculi: .65, zygMajor: .85, part: .25, jawOpen: .08, levAnguli: .2 },
  Laugh: { orbOculi: .9, zygMajor: 1, lls: .45, part: 1, jawOpen: .55, levAnguli: .3, lidTight: .3 },
  Sad: { frontalisM: .8, corrugator: .45, dao: .75, mentalis: .35, gazeY: -.25, lidRaise: -.2 },
  Surprise: { frontalisM: 1, frontalisL: 1, lidRaise: .9, jawOpen: .45, part: .8 },
  Fear: { frontalisM: .9, frontalisL: .6, corrugator: .5, lidRaise: 1, risorius: .8, part: .6, jawOpen: .22, platysma: .5 },
  Anger: { corrugator: 1, procerus: .7, lidRaise: .5, lidTight: .8, tighten: .8, press: .4, llsan: .2, masseter: .8 },
  Rage: { corrugator: 1, procerus: .8, lidTight: .6, llsan: .55, lls: .9, risorius: .4, part: 1, jawOpen: .75, platysma: .8 },
  Disgust: { llsan: 1, lls: .65, dao: .45, dli: .3, mentalis: .35, corrugator: .4 },
  Contempt: { zygMajorR: .55, buccinatorR: .75 },
  Smirk: { zygMajorL: .7, orbOculiL: .3, buccinatorL: .3 },
  Wink: { blinkL: 1, orbOculiL: .6, zygMajorL: .45 },
  Pain: { corrugator: .9, orbOculi: .7, lidTight: .9, llsan: .6, lls: .7, risorius: .5, blink: .55, jawOpen: .15, part: .6 },
  Kiss: { pucker: 1, funnel: .4 },
  'Tongue out': { jawOpen: .35, part: 1, tgProtrude: 1, tgTipDown: .3, orbOculi: .3, zygMajor: .3 },
  Snarl: { llsan: 1, lls: 1, corrugator: .9, procerus: .6, part: 1, jawOpen: .28, lidTight: .5, risorius: .3 },
  Sleepy: { blink: .62, frontalisM: .15, jawOpen: .05, part: .1 },
  'Puffed cheeks': { puff: 1, press: .5 },
};

/* ---------- small math helpers ---------- */
function ccurve(keys) { // clamped Catmull-Rom through [x, y] keys
  return x => {
    if (x <= keys[0][0]) return keys[0][1];
    const n = keys.length; if (x >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (keys[i + 1][0] < x) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
    const t = (x - p1[0]) / (p2[0] - p1[0]), sp = p2[0] - p1[0];
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * sp, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * sp;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}
const gs = (v, m, s) => Math.exp(-((v - m) * (v - m)) / (2 * s * s));
const ss = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const Y_M = .205, Y_E = .5;

/* ---------- the rest head ---------- */
function faceShape(p, f) {
  const hr = p.headRound || 0, jw = f.jawW * (1 - .22 * hr) + .14 * (p.jowl || 0), ch = f.chinSize * (1 - .3 * hr);
  const F = ccurve([[-.45, .21], [-.2, .21], [-.09, .22], [-.03, .26], [.015, .335 + .02 * ch], [.06, .385 + .015 * ch], [.12, .385], [.2, .395], [.3, .4], [.42, .392], [.5, .372], [.58, .4], [.7, .398 + .02 * hr], [.8, .37 + .03 * hr], [.9, .285 + .04 * hr], [.96, .17 + .04 * hr], [1, 0]]);
  const W = ccurve([[-.45, .25], [-.2, .245], [-.06, .25], [.02, .17 * ch + .05], [.08, .23 * jw], [.15, .305 * jw], [.22, .335 * Math.sqrt(jw)], [.32, .355], [.42, .37], [.5, .375 + .02 * hr], [.6, .372 + .035 * hr], [.7, .362 + .04 * hr], [.8, .33 + .04 * hr], [.9, .25 + .04 * hr], [.96, .15 + .03 * hr], [1, 0]]);
  const B = ccurve([[-.45, .25], [-.1, .24], [.1, .27], [.2, .31], [.3, .42], [.45, .5], [.6, .52 + .02 * hr], [.7, .5 + .03 * hr], [.8, .44 + .03 * hr], [.9, .33 + .03 * hr], [.96, .2], [1, 0]]);
  const ns = Object.assign({}, NOSE_STYLES[(p.snout || 0) > .5 ? 'snout' : f.noseStyle] || NOSE_STYLES.straight);
  ns.L *= f.noseLen; ns.tp *= f.noseProj * (1 + .8 * (p.snout || 0)); ns.aw *= f.noseWidth; ns.hump += f.noseHump * .03; ns.rot += f.noseTip * .4;
  const es = (f.eyeSize || 1) * (1 + .28 * Math.max(0, (p.eyes || 1) - 1));
  const geo = {
    F, W, B, ns, mw: .105 * f.mouthW, re: .051 * es, ex: .133 * f.eyeSpacing * (1 + .12 * Math.max(0, (p.eyes || 1) - 1)), yN: .515, hr,
    yB: 0, ears: f.earSize, earPoint: f.earPoint, brow: p.brow || 0, jowl: p.jowl || 0,
  };
  geo.yB = geo.yN - .2 * ns.L; // nose base (subnasale)
  return geo;
}
function basePoint(geo, th, y) { // superellipse slice
  const n = 2.45, e = 2 / n, s = Math.sin(th), c = Math.cos(th);
  const x = geo.W(y) * Math.sign(s) * Math.pow(Math.abs(s), e);
  const z = (c >= 0 ? geo.F(y) : -geo.B(y)) * Math.pow(Math.abs(c), e);
  return [x, y, z];
}
function noseDz(geo, x, y) {
  const ns = geo.ns, yN = geo.yN, yB = geo.yB, span = yN - yB;
  if (y < yB - .03 || y > yN + .04) return 0;
  const ny = (y - yB) / span, tipY = .14 + ns.rot * .1;
  let P;
  if (ny >= tipY) { const s2 = Math.min(1, (ny - tipY) / (1 - tipY)); P = ns.tp * (1 - s2) + ns.dn * s2 + ns.hump * Math.sin(Math.PI * Math.min(1, s2 * 1.15)) * (s2 < 1 ? 1 : 0); if (ny > 1) P = ns.dn * (1 - ss((ny - 1) / .2)); }
  else P = lerp(ns.tp * .3, ns.tp, ss(Math.max(0, ny) / tipY)) * (ny < 0 ? ss(1 + ny / .15) : 1);
  P += ns.tp * .12 * (ns.tr - 1) * gs(ny, tipY, .1);
  const width = lerp(.028 + .012 * ns.tr, .022, ss((ny - tipY) / (1 - tipY))) * (ny < tipY ? lerp(1.5 * ns.aw, 1, ny / tipY) : 1);
  const cx = (ns.crook || 0) * Math.sin(Math.PI * Math.min(1, Math.max(0, ny))) ;
  let d = P * gs(x - cx, 0, width);
  // alae (nostril wings)
  for (const sx of [-1, 1]) d += .035 * ns.aw * gs(x, sx * .045 * ns.aw, .02) * gs(ny, .08, .09) * Math.min(1, ns.tp / .06);
  return d;
}
function lipDz(geo, f, x, y) {
  const mw = geo.mw, u = Math.min(1, Math.abs(x) / mw), shape = Math.sqrt(Math.max(0, 1 - u * u));
  const bow = 1 + .35 * gs(Math.abs(x), .022, .012) - .25 * gs(x, 0, .01);
  let d = .017 * f.lipFull * gs(y, Y_M + .016 * bow, .011) * shape + .021 * f.lipFull * gs(y, Y_M - .02, .013) * shape;
  d -= .012 * gs(Math.abs(x), mw, .016) * gs(y, Y_M, .02); // commissures
  d += .004 * gs(x, 0, .012) * gs(y, Y_M + .045, .02) * (1 - gs(x, 0, .004)); // philtrum columns
  return d;
}
/* eyes: centres from the rest surface */
function eyeCentres(geo, f) {
  const out = [];
  for (const sx of [1, -1]) {
    const x = sx * geo.ex; const th = Math.asin(Math.max(-1, Math.min(1, x / geo.W(Y_E)))) * 1;
    const p0 = basePoint(geo, th, Y_E);
    out.push({ sx, x, y: Y_E, z: p0[2] - geo.re * .72 - .004 });
  }
  return out;
}

/* ---------- build the mesh ---------- */
function buildFace(p, f, w, lod) {
  lod = lod || 1;
  const geo = faceShape(p, f);
  // columns: dense over the face
  const pos = []; for (let a = 0; a < 179;) { pos.push(a); a += (a < 48 ? 2 : a < 112 ? 3.5 : 8) * lod; }
  const TH = [...pos.slice(1).reverse().map(a => -a), ...pos, 180].map(a => a * DEG); TH.sort((a, b) => a - b);
  const NC = TH.length;
  const Ys = [];
  const seg = (a, b, st) => { for (let y = a; y < b - 1e-9; y += st * lod) Ys.push(+y.toFixed(5)); };
  seg(-.42, 0, .03); seg(0, .12, .011); seg(.12, .32, .0055); seg(.32, .43, .009); seg(.43, .58, .0045); seg(.58, .82, .011); seg(.82, 1.0001, .018);
  Ys.push(Y_M, Y_M, Y_E, Y_E, 1);
  Ys.sort((a, b) => a - b);
  const rows = []; // dedupe except the margin pairs
  for (const y of Ys) { const last = rows[rows.length - 1]; if (last !== undefined && Math.abs(last.y - y) < 1e-6 && !(Math.abs(y - Y_M) < 1e-9 || Math.abs(y - Y_E) < 1e-9)) continue; if (last && Math.abs(last.y - y) < .0015 && Math.abs(y - Y_M) > 1e-9 && Math.abs(y - Y_E) > 1e-9 && Math.abs(last.y - Y_M) > 1e-9 && Math.abs(last.y - Y_E) > 1e-9) continue; rows.push({ y }); }
  for (let r = 0; r < rows.length; r++) {
    if (Math.abs(rows[r].y - Y_M) < 1e-9) { if (rows[r + 1] && Math.abs(rows[r + 1].y - Y_M) < 1e-9) { rows[r].mouth = 'L'; rows[r + 1].mouth = 'U'; r++; } }
    else if (Math.abs(rows[r].y - Y_E) < 1e-9) { if (rows[r + 1] && Math.abs(rows[r + 1].y - Y_E) < 1e-9) { rows[r].eye = 'L'; rows[r + 1].eye = 'U'; r++; } }
  }
  const NR = rows.length, NV = NR * NC;
  const rest = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), out = new Float32Array(NV * 3);
  const eyes = eyeCentres(geo, f);
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const v = r * NC + c, th = TH[c], y = rows[r].y;
    let [x, yy, z] = basePoint(geo, th, y);
    const front = Math.max(0, Math.cos(th));
    const fr = Math.pow(front, 1.2);
    // brow ridge, cheekbones, chin, socket
    z += (.01 + .022 * geo.brow + .006 * (1 - geo.hr)) * gs(y, .585, .03) * (gs(x, geo.ex * .95, .07) + gs(x, -geo.ex * .95, .07)) * fr;
    const ck = .02 * f.cheekbone * gs(y, .43, .05) * (gs(th, 48 * DEG, 15 * DEG) + gs(th, -48 * DEG, 15 * DEG));
    const rl = Math.hypot(x, z) || 1; x += x / rl * ck; z += z / rl * ck;
    z += .012 * f.chinSize * gs(y, .06, .035) * gs(x, 0, .07) * fr;
    z -= .016 * gs(y, Y_E + .01, .05) * (gs(x, geo.ex, .055) + gs(x, -geo.ex, .055)) * fr;
    // jowls (monster) sag outward at the jaw line
    if (geo.jowl > 0) { const jj = .05 * geo.jowl * gs(y, .1, .07) * (gs(th, 55 * DEG, 25 * DEG) + gs(th, -55 * DEG, 25 * DEG)); const r2 = Math.hypot(x, z) || 1; x += x / r2 * jj; z += z / r2 * jj; }
    z += noseDz(geo, x, y) * fr;
    if (rows[r].mouth === undefined || true) z += lipDz(geo, f, x, y) * fr;
    if (rows[r].mouth) z -= .006 * (Math.abs(x) < geo.mw ? 1 : 0) * fr;
    // ears
    for (const sx of [1, -1]) {
      const tc = sx * 94 * DEG, dth = (th - tc), ey = .45, top = .56 + .02 * (geo.ears - 1) + .1 * geo.earPoint, bot = .33 - .02 * (geo.ears - 1);
      if (Math.abs(dth) < 16 * DEG * geo.ears && y > bot - .02 && y < top + .02) {
        const vy = y > ey ? (y - ey) / (top - ey) : (ey - y) / (ey - bot), vt = Math.abs(dth) / (11 * DEG * geo.ears * (1 - .5 * geo.earPoint * Math.max(0, vy)));
        const inside = 1 - Math.min(1, Math.hypot(vy, vt));
        if (inside > 0) { const rim = Math.pow(ss(inside / .25), 1) * (1 - .55 * ss((inside - .3) / .35)), prof = .045 * geo.ears * rim * (.65 + .35 * ss((y - bot) / (top - bot))), r2 = Math.hypot(x, z) || 1; x += x / r2 * prof; z += z / r2 * prof - .025 * ss(inside / .5); }
      }
    }
    rest[v * 3] = x; rest[v * 3 + 1] = yy; rest[v * 3 + 2] = z;
    uv[v * 2] = th; uv[v * 2 + 1] = y;
  }
  // triangles
  const tris = [], band = [];
  for (let r = 0; r < NR - 1; r++) for (let c = 0; c < NC; c++) {
    const a = r * NC + c, b = r * NC + (c + 1) % NC, cc = (r + 1) * NC + (c + 1) % NC, d = (r + 1) * NC + c;
    const isBand = (rows[r].mouth === 'L' && rows[r + 1].mouth === 'U') ? 'm' : (rows[r].eye === 'L' && rows[r + 1].eye === 'U') ? 'e' : '';
    tris.push(a, cc, b, a, d, cc); band.push(isBand, isBand);
  }
  const M = { lod, geo, f, p, w, TH, rows, NC, NR, NV, rest, uv, tris: new Uint32Array(tris), band, eyes };
  // per-vertex masks and weights
  buildMasks(M);
  buildMuscleWeights(M);
  buildParts(M);
  return M;
}
const rowOf = (M, v) => Math.floor(v / M.NC);

/* materials: 0 skin 1 crease 2 lip 3 brow 4 lash 5 hair 6 beard 7 nostril 8 eye 9 teeth 10 gum 11 tongue 12 cavity 13 muscle 14 bone 15 socket 16 stubble 17 inner ear */
function buildMasks(M) {
  const { NV, rest, uv, geo, f, p, w } = M;
  M.mat = new Uint8Array(NV); M.jaw = new Float32Array(NV); M.stiff = new Float32Array(NV); M.hairOff = new Float32Array(NV); M.beardDrop = new Float32Array(NV);
  M.lid = new Int8Array(NV); // 1 = within eyelid region
  const mw = geo.mw, hairOn = w && w.hairStyle && w.hairStyle !== 'bald';
  const cap = w ? ({ bald: 0, buzz: .006, short: .03, bob: .045, long: .04, ponytail: .022, pigtails: .025, braid: .022, topknot: .022, bun: .025, mohawk: .006, spiky: .06, afro: .14 }[w.hairStyle] || 0) * (w.hairStyle === 'buzz' ? 1 : w.hairVolume) : 0;
  for (let v = 0; v < NV; v++) {
    const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2], th = uv[v * 2], ath = Math.abs(th), r = rowOf(M, v), row = M.rows[r];
    const front = Math.cos(th) > .1;
    let m = 0;
    // jaw membership
    let jw = 0;
    if (y < Y_M - .002 || row.mouth === 'L') jw = 1;
    if (row.mouth === 'L') jw = 1 - .5 * ss((Math.abs(x) / mw - .55) / .45);
    if (row.mouth === 'U') jw = .5 * ss((Math.abs(x) / mw - .55) / .45);
    if (!row.mouth && y >= Y_M - .002 && y < Y_M + .01 && Math.abs(x) > mw * .9) jw = .3;
    jw *= 1 - ss((ath - 40 * DEG) / (55 * DEG));
    if (y < .02) jw *= ss((y + .2) / .22);
    if (y < Y_M && y > Y_M - .03 && Math.abs(x) > mw) jw *= .7;
    M.jaw[v] = jw;
    // lips
    if (front && Math.abs(x) < mw * 1.02) { const u = Math.abs(x) / mw; const top = Y_M + .03 * (1 - u * u * .6) * f.lipFull, bot = Y_M - .042 * (1 - u * u * .5) * f.lipFull; if (y <= top && y >= bot) m = 2; }
    // nostrils: underside of the nose base
    const ns = geo.ns; if (front && y > geo.yB - .005 && y < geo.yB + .022 * ns.L && Math.abs(x) > .009 && Math.abs(x) < .038 * ns.aw && ns.tp > .05) { const nz = noseDz(geo, x, y); if (nz > .02) m = 7; }
    // inner ear
    if (ath > 84 * DEG && ath < 104 * DEG && y > .38 && y < .5 && Math.hypot(x, z) > geo.W(y) + .008 && Math.hypot(x, z) < geo.W(y) + .03 * geo.ears) m = 17;
    // brows
    const bs = f.browStyle;
    if (bs !== 'none' && front) for (const sx of [1, -1]) {
      const hx = (x - sx * geo.ex) * sx / (geo.re * 1.9);
      const arch = bs === 'arched' ? .022 : bs === 'straight' ? .004 : .013, th0 = ({ thin: .007, natural: .012, arched: .011, straight: .016, bushy: .022, unibrow: .016 })[bs] * f.browThick;
      const cy = Y_E + .085 + arch * (1 - Math.pow(Math.min(1, Math.abs(hx - .1)), 2)) - .01 * Math.max(0, hx);
      const span = bs === 'unibrow' ? (hx > -1.4 && hx < 1.05) : (hx > -.85 && hx < 1.08);
      if (span && Math.abs(y - cy) < th0 * (1 - .4 * Math.max(0, hx))) m = 3;
    }
    // head hair cap
    const hairLine = .8 - .26 * ss((ath - 40 * DEG) / (60 * DEG)) - .26 * ss((ath - 110 * DEG) / (60 * DEG));
    if (hairOn && y > hairLine && !(ath > 82 * DEG && ath < 106 * DEG && y < .6)) { m = 5; M.hairOff[v] = cap * ss((y - hairLine) / .06); }
    if (hairOn && w.hairStyle !== 'buzz' && ['long', 'bob', 'pigtails'].includes(w.hairStyle) && ath > 100 * DEG && y > (w.hairStyle === 'bob' ? .05 : -.35)) { m = 5; M.hairOff[v] = Math.max(M.hairOff[v], .035 * w.hairVolume); }
    // facial hair
    const mu = f.mustache, bd = f.beardStyle;
    const upperLipZone = front && y > Y_M + .006 && y < geo.yB - .004 && Math.abs(x) < mw * 1.15;
    if (mu !== 'none' && front) {
      const ax = Math.abs(x) / mw;
      if (mu === 'pencil' && upperLipZone && y < Y_M + .02 && ax < .95) m = 6;
      if ((mu === 'chevron' || mu === 'walrus' || mu === 'horseshoe') && upperLipZone) m = 6;
      if (mu === 'walrus' && y > Y_M - .025 && y <= Y_M + .006 && ax < 1.1 && !row.mouth) { m = 6; M.hairOff[v] = .012; }
      if (mu === 'handlebar' && (upperLipZone && ax < 1.25 || (ax > .95 && ax < 1.6 && Math.abs(y - (Y_M + .03 + .03 * (ax - 1.2))) < .008))) { m = 6; M.hairOff[v] = .006; }
      if (mu === 'horseshoe' && ax > .95 && ax < 1.3 && y > .04 && y < Y_M + .03) m = 6;
      if (m === 6) M.hairOff[v] = Math.max(M.hairOff[v], mu === 'walrus' ? .014 : .007);
    }
    const lowerFace = front || ath < 115 * DEG;
    const jawLine = y < .32 - .14 * ss((ath - 20 * DEG) / (50 * DEG)) + .12 * ss((ath - 70 * DEG) / (30 * DEG));
    if (bd !== 'none' && lowerFace && m !== 2) {
      let on = false;
      if (bd === 'goatee') on = front && Math.abs(x) < mw * 1.05 && y < Y_M - .03 && y > -.02;
      if (bd === 'soul') on = front && Math.abs(x) < .018 && y < Y_M - .035 && y > Y_M - .07;
      if (bd === 'chinstrap') on = jawLine && (y < .06 + .25 * ss((ath - 40 * DEG) / (50 * DEG))) && y > -.06 && !(front && y > .02 && Math.abs(x) < mw);
      if (bd === 'chops') on = ath > 40 * DEG && ath < 100 * DEG && y < .5 && y > .05;
      if (bd === 'full' || bd === 'long') on = (jawLine && y > -.15 && ath < 100 * DEG) && !(y > Y_M + .02 && ath < 26 * DEG && Math.abs(x) < mw * 1.1 && y < geo.yB);
      if (on) { m = 6; M.hairOff[v] = Math.max(M.hairOff[v], (bd === 'full' || bd === 'long' ? .018 + .03 * f.beardLen : .01)); if (bd === 'long' && y < .12) M.beardDrop[v] = f.beardLen * .35 * ss((.12 - y) / .12) * (1 - ss((ath - 60 * DEG) / (40 * DEG))); }
    }
    if (m === 0 && f.stubble > 0 && lowerFace && jawLine && y > -.1 && ath < 100 * DEG && !(front && Math.abs(x) < mw && y > Y_M - .045 && y < Y_M + .03)) m = 16;
    M.mat[v] = m;
    // tissue stiffness (spring constant, 1/s²)
    let k = 2600;
    if (y < .38 && y > -.1 && ath < 100 * DEG) k = 900 - 450 * geo.jowl;
    if (m === 2) k = 1300;
    if (M.beardDrop[v] > 0) k = 140;
    if (y > .55 || ath > 110 * DEG) k = 3500;
    M.stiff[v] = k;
    // eyelid region
    for (const e of M.eyes) if (Math.abs(x - e.x) < geo.re * 1.75 && Math.abs(y - Y_E) < geo.re * 1.95 && z > e.z) M.lid[v] = e.sx;
  }
  // soft tissue under the long beard hangs further
}
function buildMuscleWeights(M) {
  const { NV, rest, geo } = M;
  const corner = sx => { const y = Y_M, x = sx * geo.mw; const th = Math.asin(Math.max(-1, Math.min(1, x / geo.W(y)))); const p0 = basePoint(geo, th, y); return [x, y, p0[2] + lipDz(geo, M.f, x, y) * .5]; };
  const at = (thd, y, sx, depth) => { const th = sx * thd * DEG; const p0 = basePoint(geo, th, y); const n = Math.hypot(p0[0], p0[2]) || 1; return [p0[0] - p0[0] / n * (depth || 0), p0[1], p0[2] - p0[2] / n * (depth || 0) + (Math.abs(thd) < 30 ? noseDz(geo, p0[0], y) * .3 : 0)]; };
  M.musc = [];
  for (const m of FMUSCLES) for (const sx of [1, -1]) {
    const O = m.o === 'eye' ? (() => { const e = M.eyes.find(e => e.sx === sx); return [e.x, e.y, e.z]; })() : at(m.o[0], m.o[1], sx, .03);
    const I = m.i === 'corner' ? corner(sx) : m.i[1] < 0 ? [sx * .045, Y_M - .028, geo.F(Y_M - .03) + .015] : at(m.i[0], m.i[1], sx, 0);
    const idx = [], wt = [];
    const s2 = 2 * m.s * m.s;
    for (let v = 0; v < NV; v++) {
      const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
      if (x * sx < -.012) continue;
      let wv = Math.exp(-((x - I[0]) ** 2 + (y - I[1]) ** 2 + (z - I[2]) ** 2) / s2);
      if (Math.abs(x) < .02) wv *= .5 + .5 * Math.abs(x) / .02 * (x * sx > 0 ? 1 : 0) + .5 * (x * sx > 0 ? 0 : 1) * 0;
      if (m.i === 'corner' && M.rows[rowOf(M, v)].mouth) wv = Math.max(wv, .0);
      if (wv > .03) { idx.push(v); wt.push(wv); }
    }
    M.musc.push({ def: m, sx, key: m.id + (sx > 0 ? 'L' : 'R'), O, I, idx: Uint32Array.from(idx), wt: Float32Array.from(wt) });
  }
  // dominant muscle per vertex (for the écorché view)
  M.mId = new Int16Array(NV).fill(-1); const best = new Float32Array(NV);
  M.musc.forEach((mu, k) => { for (let j = 0; j < mu.idx.length; j++) { const v = mu.idx[j]; if (mu.wt[j] > best[v] && mu.wt[j] > .3) { best[v] = mu.wt[j]; M.mId[v] = k; } } });
  // fibre coordinate across each muscle's line of action (for striations)
  M.fib = new Float32Array(NV);
  for (let v = 0; v < NV; v++) {
    const k = M.mId[v], x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
    if (k < 0) { // orbicularis rings around the mouth and eyes
      const dm = Math.hypot(x / 1.6, y - Y_M); M.fib[v] = dm * 160; continue; }
    const mu = M.musc[k]; let dx = mu.O[0] - mu.I[0], dy = mu.O[1] - mu.I[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    M.fib[v] = (x * -dy + y * dx) * 190;
  }
}

/* ---------- eyes, teeth, tongue, mouth cavity ---------- */
function sphereMesh(nu, nv) { const P = [], T = []; for (let i = 0; i <= nv; i++) for (let j = 0; j < nu; j++) { const a = i / nv * Math.PI, b = j / nu * 2 * Math.PI; P.push(Math.sin(a) * Math.sin(b), Math.cos(a), Math.sin(a) * Math.cos(b)); } for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) { const a = i * nu + j, b = i * nu + (j + 1) % nu, c = (i + 1) * nu + (j + 1) % nu, d = (i + 1) * nu + j; T.push(a, b, c, a, c, d); } return { P: Float32Array.from(P), T: Uint32Array.from(T) }; }
const SPHERE = sphereMesh(28, 18), SPHERE_LO = sphereMesh(14, 9);
function buildParts(M) {
  const g = M.geo, f = M.f;
  const zf = g.F(Y_M) + .003; // front of the upper lip
  // dental arches: half-arch lengths of incisor, lateral, canine, premolars, molars (head units)
  const W8 = [.037, .029, .033, .03, .03, .043, .04, .038];
  const teeth = [];
  const style = f.teeth || 'normal', tusky = (M.p.jowl || 0) > .45;
  for (const jaw of ['U', 'L']) {
    const A = jaw === 'U' ? .21 : .19, z0 = zf - .03 - (jaw === 'L' ? .008 : 0), depth = .27;
    let s = 0;
    for (let i = 0; i < 8; i++) {
      if (style === 'missing' && jaw === 'U' && i === 1) { s += W8[i]; continue; }
      for (const sx of [1, -1]) {
        const wdt = W8[i] * (jaw === 'L' && i < 2 ? .78 : 1);
        let sc = s + (style === 'gap' && jaw === 'U' ? .008 : 0) + wdt / 2;
        const t = sc / .23, x = sx * A * Math.sin(Math.min(1.25, t * 1.25)) * 1.0, z = z0 - depth * t * t;
        const dx = sx * A * 1.25 * Math.cos(Math.min(1.25, t * 1.25)) / .23, dz = -2 * depth * t / .23, l = Math.hypot(dx, dz);
        let h = i < 2 ? .046 : i === 2 ? .05 : i < 5 ? .04 : .035, pt = i === 2 ? .7 : i < 2 ? .15 : .3, fwd = 0;
        if (style === 'fangs' && i === 2 && jaw === 'U') { h *= 1.75; pt = .95; }
        if (style === 'sharp') pt = .92;
        if (style === 'buck' && jaw === 'U' && i === 0) { h *= 1.3; fwd = .012; }
        if ((style === 'tusks' || tusky) && i === 2 && jaw === 'L') { h *= 2.4 + 1.6 * (M.p.jowl || 0); pt = .85; fwd = .045; }
        teeth.push({ jaw, x, y: jaw === 'U' ? Y_M + .016 : Y_M - .02, z: z + fwd, tx: dx / l, tz: dz / l, w: wdt * .92, d: i < 3 ? .022 : .034, h, pt, molar: i >= 3 });
      }
      s += W8[i] * (jaw === 'L' && i < 2 ? .78 : 1);
    }
  }
  M.teeth = teeth;
  M.cavity = { x: 0, y: Y_M - .02, z: zf - .13, rx: .14, ry: .1, rz: .14 };
  M.tongueBase = { y: Y_M - .045, z: zf - .19, len: .2, w: .1, h: .045 };
}

/* ---------- per-frame deformation ---------- */
function rotX(px, py, pz, cx, cy, cz, a) { const c = Math.cos(a), s = Math.sin(a), y = py - cy, z = pz - cz; return [px, cy + y * c - z * s, cz + y * s + z * c]; }
function jawXform(M, A) { // returns function mapping a point by the mandible pose
  const open = (A.jawOpen || 0) * 30 * DEG + (A.part || 0) * 1.5 * DEG, fwd = (A.jawFwd || 0) * .025, side = (A.jawSide || 0) * .025;
  const piv = [0, .43, -.045];
  return (x, y, z) => { const r = rotX(x, y, z, piv[0], piv[1], piv[2], open); return [r[0] + side, r[1], r[2] + fwd]; };
}
function faceTargets(M, A, gaze) {
  const { NV, rest, geo } = M, T = new Float32Array(NV * 3);
  const J = jawXform(M, A);
  for (let v = 0; v < NV; v++) {
    let x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
    const jw = M.jaw[v];
    if (jw > 0) { const q = J(x, y, z); x += (q[0] - x) * jw; y += (q[1] - y) * jw; z += (q[2] - z) * jw; }
    T[v * 3] = x; T[v * 3 + 1] = y; T[v * 3 + 2] = z;
  }
  // linear muscles
  for (const mu of M.musc) {
    const a = A[mu.key] !== undefined ? A[mu.key] : (A[mu.def.id] || 0);
    if (Math.abs(a) < 1e-3) continue;
    const d = mu.def; let O = mu.O; if (d.jaw) O = J(O[0], O[1], O[2]);
    for (let j = 0; j < mu.idx.length; j++) {
      const v = mu.idx[j], w = mu.wt[j] * a, px = T[v * 3], py = T[v * 3 + 1], pz = T[v * 3 + 2];
      let dx = O[0] - px, dy = O[1] - py, dz = O[2] - pz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      if (d.push) { dx = 0; dy = 1; dz = .3; }
      const n = Math.hypot(rest[v * 3], rest[v * 3 + 2]) || 1;
      const K = d.k * (M.f.facePower || 1) * 1.3, Bu = d.b * 1.3;
      T[v * 3] += dx * K * w + rest[v * 3] / n * Bu * w; T[v * 3 + 1] += dy * K * w; T[v * 3 + 2] += dz * K * w + rest[v * 3 + 2] / n * Bu * w;
    }
  }
  // sphincters and special actions on the lips and cheeks
  const pk = (A.pucker || 0), fn = (A.funnel || 0), tg = (A.tighten || 0), pr = (A.press || 0), part = (A.part || 0), tuck = (A.tuck || 0), puff = (A.puff || 0);
  const mw = geo.mw;
  for (let v = 0; v < NV; v++) {
    const rx = rest[v * 3], ry = rest[v * 3 + 1], rz = rest[v * 3 + 2], row = M.rows[rowOf(M, v)];
    const near = gs(ry, Y_M, .045) * gs(rx, 0, mw * 1.25) * (rz > .2 ? 1 : 0);
    if (near > .02) {
      T[v * 3] -= rx * (.45 * pk + .2 * fn) * near;
      T[v * 3 + 2] += (.028 * pk + .02 * fn) * near * gs(rx, 0, mw * .8);
      const above = ry > Y_M || row.mouth === 'U';
      const lipGap = (.016 * fn + .012 * part) * (above ? 1 : -1) * gs(rx, 0, mw * .6) * gs(ry, Y_M, .02);
      T[v * 3 + 1] += lipGap;
      T[v * 3 + 1] -= (ry - Y_M) * (.4 * tg + .5 * pr) * gs(ry, Y_M, .04);
      T[v * 3 + 2] -= (.006 * tg + .004 * pr) * near;
      if (!above && tuck > 0) { T[v * 3 + 1] += .016 * tuck * gs(ry, Y_M - .012, .02) * gs(rx, 0, mw * .7); T[v * 3 + 2] -= .022 * tuck * gs(ry, Y_M - .015, .022) * gs(rx, 0, mw * .8); }
    }
    if (puff > 0) { const cw = puff * .045 * gs(ry, .23, .08) * (gs(Math.abs(uvTh(M, v)), 45 * DEG, 18 * DEG)); const n = Math.hypot(rx, rz) || 1; T[v * 3] += rx / n * cw; T[v * 3 + 2] += rz / n * cw; }
  }
  // nostril flare
  if (A.nasalisD || A.nasalisDL || A.nasalisDR) {}
  // eyelids wrapped over the eyeballs
  for (const e of M.eyes) {
    const side = e.sx > 0 ? 'L' : 'R';
    const lidRaise = A['lidRaise' + side] ?? A.lidRaise ?? 0, lidTight = A['lidTight' + side] ?? A.lidTight ?? 0, blink = Math.min(1, (A['blink' + side] ?? A.blink ?? 0) + (gaze.blink || 0)), cheek = A['orbOculi' + side] ?? A.orbOculi ?? 0;
    const gp = gaze.pitch || 0;
    const anime = (M.p.eyes || 1) > 1.3;
    let openU = (anime ? 38 : 27) * DEG * (1 + .45 * lidRaise) - 6 * DEG * lidTight + .75 * gp;
    let openL = (anime ? 30 : 25) * DEG * (1 - .55 * cheek - .45 * lidTight + .25 * Math.max(0, lidRaise)) - .45 * gp;
    const meet = -openL * .35;
    openU = lerp(openU, meet, blink); openL = lerp(openL, -meet, blink * .85);
    const R = geo.re + .0065, tilt = (M.f.eyeTilt || 0) * 9 * DEG;
    for (let v = 0; v < NV; v++) {
      if (M.lid[v] !== e.sx) continue;
      const rx = rest[v * 3], ry = rest[v * 3 + 1], row = M.rows[rowOf(M, v)];
      const h = (rx - e.x) / (geo.re * 1.12), hs = h * e.sx;
      let vv = (ry - Y_E) / (geo.re * 1.75);
      if (row.eye === 'U') vv = 1e-4; else if (row.eye === 'L') vv = -1e-4;
      const hc = Math.min(1, Math.abs(hs)), arc = Math.pow(Math.max(0, 1 - hc * hc), .55);
      const mU = openU * arc + tilt * hs, mL = -openL * Math.pow(Math.max(0, 1 - hc * hc), .65) + tilt * hs + 2 * DEG * hs;
      let el;
      if (vv >= 0) el = mU + (72 * DEG - mU) * Math.pow(Math.min(1, vv), .85);
      else el = mL + (-64 * DEG - mL) * Math.pow(Math.min(1, -vv), .85);
      const az = h * 64 * DEG;
      const rr = R + (Math.abs(vv) < .06 ? .0025 : 0);
      const lx = e.x + rr * Math.sin(az) * Math.cos(el), ly = e.y + rr * Math.sin(el), lz = e.z + rr * Math.cos(az) * Math.cos(el);
      const wb = Math.max(ss((Math.abs(hs) - .9) / .55), ss((Math.abs(vv) - .72) / .3));
      T[v * 3] = lerp(lx, T[v * 3], wb); T[v * 3 + 1] = lerp(ly, T[v * 3 + 1], wb); T[v * 3 + 2] = lerp(lz, T[v * 3 + 2], wb);
    }
  }
  // facial and head hair volume, long beard drop
  for (let v = 0; v < NV; v++) {
    const ho = M.hairOff[v]; if (ho <= 0 && M.beardDrop[v] <= 0) continue;
    const rx = rest[v * 3], ry = rest[v * 3 + 1], rz = rest[v * 3 + 2], n = Math.hypot(rx, (ry - .45) * .6, rz) || 1;
    T[v * 3] += rx / n * ho; T[v * 3 + 1] += (ry - .45) * .6 / n * ho - M.beardDrop[v]; T[v * 3 + 2] += rz / n * ho + M.beardDrop[v] * .25;
  }
  return T;
}
const uvTh = (M, v) => M.uv[v * 2];

/* ---------- face animation state ---------- */
function newFaceState(M) {
  const n = M.NV * 3, X = Float32Array.from(M.rest), V = new Float32Array(n);
  return { X, V, act: {}, gaze: { yaw: 0, pitch: 0, vy: 0, vp: 0, blink: 0 }, head: { yaw: 0, pitch: 0, roll: 0, w: [0, 0, 0] }, t: 0 };
}
/* one physics step: muscles (activation dynamics) → targets → tissue springs */
function faceStep(M, S, ctrl, dt) {
  const act = S.act;
  const keys = new Set([...Object.keys(ctrl.au || {}), ...Object.keys(act)]);
  for (const k of keys) {
    const u = (ctrl.au || {})[k] || 0, a = act[k] || 0, tau = Math.abs(u) > Math.abs(a) ? .045 : .09;
    act[k] = a + (u - a) * Math.min(1, dt / tau);
  }
  // gaze: saccades limited by the main sequence, vergence ignored at portrait distance
  const g = S.gaze, ty = (ctrl.gazeX || 0) * 32 * DEG, tp = (ctrl.gazeY || 0) * 24 * DEG;
  for (const [ax, tgt, vk] of [['yaw', ty, 'vy'], ['pitch', tp, 'vp']]) {
    const err = tgt - g[ax], amp = Math.abs(err), vmax = (600 * (1 - Math.exp(-amp / (14 * DEG))) + 30) * DEG;
    const want = Math.sign(err) * Math.min(vmax, amp / dt * .5, Math.sqrt(2 * 30000 * DEG * amp));
    g[vk] += clamp(want - g[vk], -60000 * DEG * dt, 60000 * DEG * dt); g[ax] += g[vk] * dt;
  }
  g.blink = lerp(g.blink, ctrl.blink || 0, Math.min(1, dt / ((ctrl.blink || 0) > g.blink ? .03 : .06)));
  // head pose and its angular motion (inertia of soft tissue)
  const h = S.head, ny = ctrl.headYaw || 0, np = ctrl.headPitch || 0, nr = ctrl.headRoll || 0;
  const w0 = h.w.slice(); h.w = [(np - h.pitch) / dt, (ny - h.yaw) / dt, (nr - h.roll) / dt];
  const al = [(h.w[0] - w0[0]) / dt, (h.w[1] - w0[1]) / dt, (h.w[2] - w0[2]) / dt];
  h.pitch = np; h.yaw = ny; h.roll = nr;
  const A = Object.assign({}, act, { tg: undefined });
  const T = faceTargets(M, A, { pitch: g.pitch, blink: g.blink });
  const X = S.X, V = S.V, cen = [0, .45, 0];
  for (let v = 0; v < M.NV; v++) {
    const k = M.stiff[v], c = 2 * Math.sqrt(k) * (k < 1000 ? .45 : .8), j = v * 3;
    if (M.lid[v] || k > 3000) { X[j] = T[j]; X[j + 1] = T[j + 1]; X[j + 2] = T[j + 2]; V[j] = V[j + 1] = V[j + 2] = 0; continue; }
    const rx = X[j] - cen[0], ry = X[j + 1] - cen[1], rz = X[j + 2] - cen[2];
    // inertial acceleration in the head frame: -(α × r) (pitch about x, yaw about y, roll about z)
    const ax = -(al[1] * rz - al[2] * ry), ay = -(al[2] * rx - al[0] * rz), az = -(al[0] * ry - al[1] * rx);
    const gy = -42 * (k < 1000 ? .02 : 0) * (M.beardDrop[v] > 0 ? 6 : 1), la = ctrl.headAcc;
    for (let d = 0; d < 3; d++) {
      let acc = k * (T[j + d] - X[j + d]) - c * V[j + d] + (d === 0 ? ax : d === 1 ? ay + gy : az) * (k < 1000 ? .6 : .15);
      if (la && k < 1000) acc -= (d === 1 ? la[1] : d === 2 ? la[0] : 0) * .5;
      V[j + d] += acc * dt; X[j + d] += V[j + d] * dt;
    }
  }
  S.t += dt;
}

/* ---------- rendering ---------- */
function hexRgbF(h) { return hexRgb(h); }
// the stub of neck behind the jaw angle: the body supplies its own neck there
const neckStub = (R, v) => { const y = R[v * 3 + 1], z = R[v * 3 + 2]; return z < .14 && y < .19 + Math.max(0, -z - .2) * .25; };
function faceRender(M, S, ctrl, o) {
  const W = o.W || o.size, Hh = o.H || o.size, mode = o.mode || 'skin', levels = o.levels || 5; M._act = S.act;
  const yaw = (o.yaw || 0) * DEG + (S.head.yaw || 0), pitch = (o.pitch || 0) * DEG + (S.head.pitch || 0), roll = S.head.roll || 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const sc = W * (o.zoom || .7), ox = W / 2, oy = Hh * .56, cen = .5;
  // view transform: head → screen. returns [X, Y, depth]
  const V = o.view ? o.view.V : (x, y, z) => {
    y -= cen;
    let x1 = x * cr - y * sr, y1 = x * sr + y * cr; // roll
    let y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp; // pitch (nod down = +)
    const X = x1 * cy + z2 * sy, Z = -x1 * sy + z2 * cy; // yaw
    return [ox + X * sc, oy - y2 * sc, Z];
  };
  const NPX = W * Hh, zb = new Float32Array(NPX).fill(-1e9), tri = new Int32Array(NPX).fill(-1), b1 = new Float32Array(NPX), b2 = new Float32Array(NPX);
  const objs = []; // {pts:Float32Array screen, tris, mat (per tri or fn), attr}
  // --- head ---
  const X = mode === 'skull' ? skullPositions(M, S, ctrl) : mode === 'muscle' ? musclePositions(M, S) : S.X;
  const NVh = M.NV, hp = new Float32Array(NVh * 3);
  for (let v = 0; v < NVh; v++) { const q = V(X[v * 3], X[v * 3 + 1], X[v * 3 + 2]); hp[v * 3] = q[0]; hp[v * 3 + 1] = q[1]; hp[v * 3 + 2] = q[2]; }
  const objList = [];
  objList.push({ kind: 'head', P: hp, W: X, T: M.tris, cull: true });
  // --- eyes ---
  const g = S.gaze, eyeObjs = [];
  if (mode !== 'skull') for (const e of M.eyes) {
    const P = SPHERE.P, n = P.length / 3, pts = new Float32Array(n * 3), wp = new Float32Array(n * 3), loc = new Float32Array(n * 3);
    const verg = -e.sx * 1.2 * DEG, gyw = g.yaw + verg, gpt = g.pitch;
    const cyw = Math.cos(gyw), syw = Math.sin(gyw), cpt = Math.cos(gpt), spt = Math.sin(gpt);
    for (let i = 0; i < n; i++) {
      const lx = P[i * 3], ly = P[i * 3 + 1], lz = P[i * 3 + 2];
      // eye-local (forward = +z) rotated by gaze: pitch then yaw
      const y1 = ly * cpt + lz * spt, z1 = -ly * spt + lz * cpt, x2 = lx * cyw + z1 * syw, z2 = -lx * syw + z1 * cyw;
      const r = M.geo.re, wx = e.x + x2 * r, wy = e.y + y1 * r, wz = e.z + z2 * r;
      const q = V(wx, wy, wz); pts[i * 3] = q[0]; pts[i * 3 + 1] = q[1]; pts[i * 3 + 2] = q[2]; wp[i * 3] = wx; wp[i * 3 + 1] = wy; wp[i * 3 + 2] = wz;
      loc[i * 3] = lx; loc[i * 3 + 1] = ly; loc[i * 3 + 2] = lz;
    }
    objList.push({ kind: 'eye', P: pts, W: wp, L: loc, T: SPHERE.T, cull: true, e });
  }
  // --- mouth parts: cavity, teeth, gums, tongue ---
  const J = jawXform(M, Object.assign({}, S.act));
  {
    const c = M.cavity, P = SPHERE_LO.P, n = P.length / 3, pts = new Float32Array(n * 3), wp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { let x = c.x + P[i * 3] * c.rx, y = c.y + P[i * 3 + 1] * c.ry, z = c.z + P[i * 3 + 2] * c.rz; if (y < c.y) { const q = J(x, y, z); x = q[0]; y = q[1]; z = q[2]; } wp[i * 3] = x; wp[i * 3 + 1] = y; wp[i * 3 + 2] = z; const s = V(x, y, z); pts[i * 3] = s[0]; pts[i * 3 + 1] = s[1]; pts[i * 3 + 2] = s[2]; }
    objList.push({ kind: 'cavity', P: pts, W: wp, T: SPHERE_LO.T, cull: 'inv' });
  }
  for (const t of M.teeth) objList.push(toothObj(M, t, t.jaw === 'L' ? J : null, V));
  for (const jaw of ['U', 'L']) objList.push(gumObj(M, jaw, jaw === 'L' ? J : null, V));
  if (mode !== 'skull') objList.push(tongueObj(M, S.act, J, V));
  // --- rasterize everything into one z-buffer (visibility buffer) ---
  const triRefs = []; // [obj, triIndex]
  let tid = 0;
  for (let oi = 0; oi < objList.length; oi++) {
    const ob = objList[oi], P = ob.P, T = ob.T;
    for (let t = 0; t < T.length; t += 3, tid++) {
      let hold = false; // cut-away neck: still occludes the mouth interior, but draws nothing
      if (ob.kind === 'head' && (mode === 'skull' || o.cutNeck) && M.uv[T[t] * 2 + 1] < (o.cutNeck ? -.012 : -.04) && M.uv[T[t + 1] * 2 + 1] < (o.cutNeck ? -.012 : -.04)) { if (!o.cutNeck) continue; hold = true; }
      if (ob.kind === 'head' && o.cutNeck && neckStub(M.rest, T[t]) && neckStub(M.rest, T[t + 1]) && neckStub(M.rest, T[t + 2])) hold = true;
      if (ob.kind === 'head' && M.band[t / 3]) { // eye fissures and the mouth opening
        const kind = M.band[t / 3], v0 = T[t];
        if (kind === 'm') { const x = Math.abs(M.rest[v0 * 3]); if (x < M.geo.mw * .995) continue; }
        else { const x = M.rest[v0 * 3]; if (M.eyes.some(e => Math.abs(x - e.x) < M.geo.re * 1.1)) continue; }
      }
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      const ax = P[a], ay = P[a + 1], bx = P[b], by = P[b + 1], cx = P[c], cy2 = P[c + 1];
      const area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      if (ob.cull === true && area < 0 && !hold) continue;
      if (ob.cull === 'inv' && area > 0) continue;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy2))), maxY = Math.min(Hh - 1, Math.ceil(Math.max(ay, by, cy2)));
      if (minX > maxX || minY > maxY) continue;
      const az = P[a + 2], bz = P[b + 2], cz = P[c + 2], inv = 1 / area;
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const qx = px + .5, qy = py + .5;
        const w0 = ((bx - qx) * (cy2 - qy) - (by - qy) * (cx - qx)) * inv, w1 = ((cx - qx) * (ay - qy) - (cy2 - qy) * (ax - qx)) * inv, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * az + w1 * bz + w2 * cz, i = py * W + px;
        if (z > zb[i]) { zb[i] = z; tri[i] = tid; b1[i] = w1; b2[i] = w2; }
      }
      triRefs[tid] = hold ? null : [oi, t];
    }
  }
  // --- normals for the head (per vertex) ---
  const hn = vertexNormals(X, M.tris, NVh);
  // --- shading ---
  const out = new Uint8ClampedArray(NPX * 4);
  const pal = facePalette(M, o, levels);
  const L = [-.45, .55, .7], Ln = Math.hypot(...L); L[0] /= Ln; L[1] /= Ln; L[2] /= Ln;
  const toView = o.view ? o.view.N : (nx, ny, nz) => { let x1 = nx * cr - ny * sr, y1 = nx * sr + ny * cr; const y2 = y1 * cp - nz * sp, z2 = y1 * sp + nz * cp; return [x1 * cy + z2 * sy, y2, -x1 * sy + z2 * cy]; };
  const matIdx = new Int8Array(NPX).fill(-1);
  for (let i = 0; i < NPX; i++) {
    const t = tri[i]; if (t < 0 || !triRefs[t]) continue;
    const [oi, ti] = triRefs[t], ob = objList[oi], T = ob.T, v0 = T[ti], v1 = T[ti + 1], v2 = T[ti + 2], w1 = b1[i], w2 = b2[i], w0 = 1 - w1 - w2;
    let nx, ny, nz, m, extra = 0;
    if (ob.kind === 'head') {
      nx = hn[v0 * 3] * w0 + hn[v1 * 3] * w1 + hn[v2 * 3] * w2; ny = hn[v0 * 3 + 1] * w0 + hn[v1 * 3 + 1] * w1 + hn[v2 * 3 + 1] * w2; nz = hn[v0 * 3 + 2] * w0 + hn[v1 * 3 + 2] * w1 + hn[v2 * 3 + 2] * w2;
      const mm = [M.mat[v0], M.mat[v1], M.mat[v2]]; m = (mm[0] === mm[1] || mm[0] === mm[2]) ? mm[0] : mm[1] === mm[2] ? mm[1] : mm[w0 > w1 && w0 > w2 ? 0 : w1 > w2 ? 1 : 2];
      if (mode === 'muscle') { const mid = [M.mId[v0], M.mId[v1], M.mId[v2]][w0 > w1 && w0 > w2 ? 0 : w1 > w2 ? 1 : 2]; m = mid >= 0 ? 100 + mid : (M.mat[v0] === 2 ? 100 + M.musc.length : 13); }
      if (mode === 'skull') m = skullMat(M, v0, v1, v2, w0, w1, w2);
      if (mode === 'skin') extra = wrinkle(M, S, X, v0, v1, v2, w0, w1, w2);
    } else if (ob.kind === 'eye') {
      const P = ob.W, e = ob.e; const wx = P[v0 * 3] * w0 + P[v1 * 3] * w1 + P[v2 * 3] * w2, wy = P[v0 * 3 + 1] * w0 + P[v1 * 3 + 1] * w1 + P[v2 * 3 + 1] * w2, wz = P[v0 * 3 + 2] * w0 + P[v1 * 3 + 2] * w1 + P[v2 * 3 + 2] * w2;
      nx = wx - e.x; ny = wy - e.y; nz = wz - e.z;
      const Lc = ob.L, lz = Lc[v0 * 3 + 2] * w0 + Lc[v1 * 3 + 2] * w1 + Lc[v2 * 3 + 2] * w2, lx = Lc[v0 * 3] * w0 + Lc[v1 * 3] * w1 + Lc[v2 * 3] * w2, ly = Lc[v0 * 3 + 1] * w0 + Lc[v1 * 3 + 1] * w1 + Lc[v2 * 3 + 1] * w2;
      const ll = Math.hypot(lx, ly, lz) || 1, psi = Math.acos(clamp(lz / ll, -1, 1)), phi = Math.atan2(ly, lx);
      const anime = (M.p.eyes || 1) > 1.3, irisA = (anime ? 40 : 27) * DEG, pupA = irisA * (ctrl.pupil !== undefined ? ctrl.pupil : .36);
      if (psi < pupA) m = 20; else if (psi < irisA) { m = 21; extra = (anime ? (ly / ll > .3 ? -1 : 0) : (Math.sin(phi * 23) * .5 + Math.sin(phi * 9 + psi * 30) * .5 > .35 ? 1 : 0) - (psi > irisA * .86 ? 1 : 0)); } else m = 22;
    } else {
      const P = ob.W; const ax = P[v0 * 3], ay = P[v0 * 3 + 1], az = P[v0 * 3 + 2], bx = P[v1 * 3] - ax, by = P[v1 * 3 + 1] - ay, bz = P[v1 * 3 + 2] - az, cx = P[v2 * 3] - ax, cyy = P[v2 * 3 + 1] - ay, cz = P[v2 * 3 + 2] - az;
      nx = by * cz - bz * cyy; ny = bz * cx - bx * cz; nz = bx * cyy - by * cx;
      if (ob.kind === 'cavity') { nx = -nx; ny = -ny; nz = -nz; }
      const sgn = ob.flip ? -1 : 1; nx *= sgn; ny *= sgn; nz *= sgn;
      m = ob.kind === 'cavity' ? 12 : ob.kind === 'tooth' ? 9 : ob.kind === 'gum' ? 10 : 11;
    }
    const nl = Math.hypot(nx, ny, nz) || 1; let [vx, vy, vz] = toView(nx / nl, ny / nl, nz / nl);
    if (vz < 0 && ob.kind !== 'cavity') { if (ob.kind === 'head' || ob.kind === 'eye') vz = Math.abs(vz) * .3; else { vx = -vx; vy = -vy; vz = -vz; } }
    let lam = Math.max(0, vx * L[0] + vy * L[1] + vz * L[2]);
    if (ob.kind === 'cavity') lam = .15;
    let lv = Math.min(levels - 1, Math.floor((.12 + .88 * lam) * levels));
    if (ob.kind === 'head' && (m === 5 || m === 6 || m === 3 || m === 16)) { const hsh = ((i * 2654435761) >>> 0) / 4294967296; lv = Math.max(0, Math.min(levels - 1, lv + (hsh < .22 ? -1 : hsh > .9 ? 1 : 0))); if (m === 16 && hsh < .55) m = 0; }
    lv = Math.max(0, Math.min(levels - 1, lv - (extra > 0 && ob.kind === 'head' ? 1 : 0)));
    if (mode === 'muscle' && ob.kind === 'head') { const fb = M.fib[v0] * w0 + M.fib[v1] * w1 + M.fib[v2] * w2; if (fb - Math.floor(fb) < .32) lv = Math.max(0, lv - 1); if (M.mId[v0] !== M.mId[v1] || M.mId[v1] !== M.mId[v2]) lv = 0; }
    if (ob.kind === 'eye') { lv = Math.max(0, Math.min(levels - 1, lv + (extra < 0 ? -1 : 0) + (extra > 0 ? 1 : 0))); const hv = 2 * (vx * L[0] + vy * L[1] + vz * L[2]) * vz - L[2]; if (hv > .985 && m !== 22) m = 23; else if (hv > .995) m = 23; }
    if ((ob.kind === 'tooth' || m === 2 || m === 11) && 2 * lam * vz - L[2] > .93) lv = levels - 1;
    const c = (pal[m] || pal[0])[lv]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    matIdx[i] = m >= 100 ? 13 : m;
  }
  if (o.eyeDots && mode !== 'skull') for (const ob of objList) if (ob.kind === 'eye') {
    // the pupil centre, so a three-pixel head still reads its gaze
    const e = ob.e, gyw = g.yaw - e.sx * 1.2 * DEG, gpt = g.pitch, r = M.geo.re;
    const px3 = e.x + Math.sin(gyw) * Math.cos(gpt) * r, py3 = e.y + Math.sin(gpt) * r, pz3 = e.z + Math.cos(gyw) * Math.cos(gpt) * r;
    const q = V(px3, py3, pz3), ix = Math.floor(q[0]), iy = Math.floor(q[1]);
    if (ix >= 0 && iy >= 0 && ix < W && iy < Hh) { const i = iy * W + ix, t = tri[i]; if (t >= 0 && triRefs[t] && (objList[triRefs[t][0]].kind === 'eye' || zb[i] < q[2] + .004 * (o.depthScale || 1))) { out[i * 4] = 22; out[i * 4 + 1] = 18; out[i * 4 + 2] = 22; out[i * 4 + 3] = 255; } }
  }
  // lash line along the upper lid margin, and an outline from depth / silhouette
  if (mode === 'skin') lashes(M, S, X, V, out, zb, W, Hh, pal);
  if (o.outline && o.outline !== 'none') {
    const src = Uint8ClampedArray.from(out);
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
      const i = py * W + px; let edge = false, nb = -1;
      if (tri[i] < 0 || !triRefs[tri[i]]) { for (const n of [px > 0 ? i - 1 : -1, px < W - 1 ? i + 1 : -1, py > 0 ? i - W : -1, py < Hh - 1 ? i + W : -1]) if (n >= 0 && tri[n] >= 0 && triRefs[tri[n]]) { nb = n; break; } if (nb < 0) continue; edge = true; }
      else { for (const n of [px > 0 ? i - 1 : -1, px < W - 1 ? i + 1 : -1, py > 0 ? i - W : -1, py < Hh - 1 ? i + W : -1]) if (n >= 0 && tri[n] >= 0 && zb[n] - zb[i] > .045) { edge = true; nb = n; break; } if (!edge) continue; nb = i; }
      const k = nb * 4, dk = o.outline === 'black' ? [16, 14, 18] : [src[k] * .5, src[k + 1] * .45, src[k + 2] * .5];
      out[i * 4] = dk[0]; out[i * 4 + 1] = dk[1]; out[i * 4 + 2] = dk[2]; out[i * 4 + 3] = 255;
    }
  }
  return out;
}
function vertexNormals(X, T, NV) {
  const N = new Float32Array(NV * 3);
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { N[k] -= nx; N[k + 1] -= ny; N[k + 2] -= nz; }
  }
  return N;
}
/* wrinkles: forehead lines, glabella, crow's feet, nasolabial fold, nose bridge, chin dimpling */
function wrinkle(M, S, X, v0, v1, v2, w0, w1, w2) {
  const A = S.act, R = M.rest, x = R[v0 * 3] * w0 + R[v1 * 3] * w1 + R[v2 * 3] * w2, y = R[v0 * 3 + 1] * w0 + R[v1 * 3 + 1] * w1 + R[v2 * 3 + 1] * w2, z = R[v0 * 3 + 2] * w0 + R[v1 * 3 + 2] * w1 + R[v2 * 3 + 2] * w2;
  if (z < .1) return 0;
  const g = M.geo, side = x >= 0 ? 'L' : 'R', a = k => A[k + side] ?? A[k] ?? 0;
  const fr = Math.max(a('frontalisM'), a('frontalisL'));
  if (fr > .25 && y > .66 && y < .86 && Math.sin(y * 165) > 1.15 - fr * .5) return 1;
  if (a('corrugator') > .35 && Math.abs(x) < .03 && Math.abs(x) > .006 && y > .55 && y < .64 && Math.abs(Math.abs(x) - .016) < .004) return 1;
  const sq = Math.max(a('orbOculi'), a('lidTight') * .7);
  if (sq > .3 && Math.abs(x) > g.ex + g.re * 1.1 && Math.abs(x) < g.ex + g.re * 2.2 && Math.abs(y - Y_E) < .05 && Math.sin(Math.atan2(y - Y_E, Math.abs(x) - g.ex) * 10) > 1.2 - sq * .6) return 1;
  const sm = Math.max(a('zygMajor'), a('lls'), a('llsan') * .8, a('levAnguli'));
  if (sm > .25) { const nxp = .045 * g.ns.aw, t = (y - Y_M) / (g.yB - Y_M); if (t > -.25 && t < 1.05) { const fx = lerp(g.mw * 1.15, nxp + .012, t) + .01 * sm; if (Math.abs(Math.abs(x) - fx) < .004 + .003 * sm) return 1; } }
  if (a('llsan') > .35 && Math.abs(x) < .03 && y > g.yN - .06 && y < g.yN + .01 && Math.sin(y * 260) > .6) return 1;
  if (a('mentalis') > .3 && Math.abs(x) < .05 && y > .03 && y < .1 && ((Math.sin(x * 300) + Math.sin(y * 280)) > 1.3)) return 1;
  return 0;
}
function lashes(M, S, X, V, out, zb, W, Hh, pal) {
  const n = M.NC, rU = M.rows.findIndex(r => r.eye === 'U'); if (rU < 0) return;
  const thick = Math.max(1, Math.round(W / 110 * (M.f.lashes || 1) * ((M.p.eyes || 1) > 1.3 ? 1.6 : 1)));
  for (const e of M.eyes) {
    let prev = null;
    for (let c = 0; c < n; c++) {
      const v = rU * n + c, x = M.rest[v * 3]; if (Math.abs(x - e.x) > M.geo.re * 1.12 || M.rest[v * 3 + 2] < 0) { prev = null; continue; }
      const q = V(X[v * 3], X[v * 3 + 1] + .002, X[v * 3 + 2] + .004);
      if (prev) { const steps = Math.ceil(Math.hypot(q[0] - prev[0], q[1] - prev[1])) + 1; for (let s = 0; s <= steps; s++) { const px = Math.round(lerp(prev[0], q[0], s / steps)), py = Math.round(lerp(prev[1], q[1], s / steps)); for (let t = 0; t < thick; t++) { const yy = py - t, i = yy * W + px; if (px < 0 || yy < 0 || px >= W || yy >= Hh) continue; if (zb[i] > q[2] + .02) continue; const c2 = pal[4][1]; out[i * 4] = c2[0]; out[i * 4 + 1] = c2[1]; out[i * 4 + 2] = c2[2]; out[i * 4 + 3] = 255; } } }
      prev = q;
    }
  }
}
function facePalette(M, o, n) {
  const skin = o.skin || '#c98e6b', hair = (M.w && M.w.hairColor) || '#3a2a20', [h, s, l] = rgbHsl(hexRgb(skin));
  const shift = (dh, ds, dl) => { const c = hslRgb(h + dh, Math.min(1, s * ds), Math.min(.95, Math.max(.05, l * dl))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
  const P = [];
  P[0] = ramp(skin, n); P[1] = ramp(shift(-6, 1.1, .72), n); P[2] = ramp(shift(-14, 1.35, .82), n); P[3] = ramp(hair, n); P[4] = ramp('#1a1416', n); P[5] = ramp(hair, n); P[6] = ramp(hair, n);
  P[7] = ramp(shift(-10, 1.1, .32), n); P[9] = ramp('#efe7d2', n); P[10] = ramp('#c76a72', n); P[11] = ramp('#c9575f', n); P[12] = ramp('#3d1418', n); P[13] = ramp('#7a2a2a', n); P[14] = ramp('#e4d8bb', n); P[15] = ramp('#2a2220', n); P[16] = ramp(shift(0, .7, .62), n); P[17] = ramp(shift(-8, 1.1, .78), n);
  P[20] = ramp('#0d0c10', n); P[21] = ramp(o.iris || M.f.irisColor || '#5b7a3c', n); P[22] = ramp('#f1ece6', n); P[23] = [[255, 255, 255]].concat(Array(n).fill([255, 255, 255]));
  const reds = ['#9c3a32', '#c0503f', '#7d2d2c', '#b04a3e', '#a13d3a', '#8c3a2f', '#c75f49'];
  M.musc.forEach((mu, k) => { const a = M._act ? (M._act[mu.key] ?? M._act[mu.def.id] ?? 0) : 0; P[100 + k] = ramp(a > .5 ? '#f08a5a' : a > .2 ? '#dc6a4c' : reds[Math.floor(k / 2) % reds.length], n); });
  P[100 + M.musc.length] = ramp('#a8443c', n);
  return P;
}
function musclePositions(M, S) { // skin pulled in by the subcutaneous layer
  const X = S.X, out = new Float32Array(X.length);
  for (let v = 0; v < M.NV; v++) { const rx = M.rest[v * 3], rz = M.rest[v * 3 + 2], n = Math.hypot(rx, rz) || 1, d = M.hairOff[v] + .006; out[v * 3] = X[v * 3] - rx / n * d; out[v * 3 + 1] = X[v * 3 + 1] + M.beardDrop[v]; out[v * 3 + 2] = X[v * 3 + 2] - rz / n * d; }
  return out;
}
function skullPositions(M, S, ctrl) {
  const g = M.geo, out = new Float32Array(M.NV * 3), J = jawXform(M, S.act);
  for (let v = 0; v < M.NV; v++) {
    const th = M.uv[v * 2], y = M.uv[v * 2 + 1];
    let [x, yy, z] = basePoint(g, th, y);
    const n = Math.hypot(x, z) || 1, front = Math.max(0, Math.cos(th));
    let t = .012 + .03 * gs(y, .25, .1) * front + .02 * gs(y, .4, .05) * gs(Math.abs(th), 50 * DEG, 20 * DEG);
    t += .045 * gs(y, Y_M, .05) * front * gs(x, 0, .12); // lips: teeth show
    for (const e of M.eyes) t += .05 * gs(x, e.x, .042) * gs(y, Y_E, .04) * front;
    t += .02 * gs(x, 0, .02) * gs(y, g.yB + .04, .03) * front;
    if (y < .15) t += .03 * front * (1 - ss((y + .05) / .2));
    x -= x / n * t; z -= z / n * t;
    if (M.jaw[v] > .5 || y < Y_M - .02) { const q = J(x, yy, z); x = q[0]; yy = q[1]; z = q[2]; }
    out[v * 3] = x; out[v * 3 + 1] = yy; out[v * 3 + 2] = z;
  }
  return out;
}
function skullMat(M, v0, v1, v2, w0, w1, w2) {
  const R = M.uv, th = R[v0 * 2] * w0 + R[v1 * 2] * w1 + R[v2 * 2] * w2, y = R[v0 * 2 + 1] * w0 + R[v1 * 2 + 1] * w1 + R[v2 * 2 + 1] * w2, g = M.geo;
  const x = Math.sin(th) * .37;
  for (const e of M.eyes) if (Math.cos(th) > .3 && Math.hypot((x - e.x) / .045, (y - Y_E) / .04) < 1) return 15;
  if (Math.cos(th) > .6 && Math.abs(x) < .028 * (1 - (y - g.yB) / .09) && y > g.yB - .005 && y < g.yB + .09) return 15;
  if (y < -.05) return 15;
  return 14;
}
function toothObj(M, t, J, V) {
  // a tapered box along the arch: tangent (tx,tz), outward normal (tz,-tx)
  const nx = t.tz, nz = -t.tx, hw = t.w / 2, hd = t.d / 2, up = t.jaw === 'U' ? 1 : -1, root = t.y + up * .02, tip = t.y - up * t.h + up * .02;
  const corners = [];
  for (const [sy, kk] of [[root, 1], [tip, 1 - t.pt]]) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = t.x + (t.tx * a * hw + nx * b * hd) * kk, z = t.z + (t.tz * a * hw + nz * b * hd) * kk;
    corners.push([x, sy, z]);
  }
  const W = new Float32Array(24), P = new Float32Array(24);
  corners.forEach((c, i) => { let p = c; if (J) p = J(c[0], c[1], c[2]); W.set(p, i * 3); P.set(V(p[0], p[1], p[2]), i * 3); });
  const T = Uint32Array.from([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7]);
  return { kind: 'tooth', P, W, T, cull: false };
}
function gumObj(M, jaw, J, V) {
  const pts = [], T = [];
  const A = jaw === 'U' ? .215 : .195, zf = M.geo.F(Y_M) + .003 - .03 - (jaw === 'L' ? .008 : 0), up = jaw === 'U' ? 1 : -1, y0 = (jaw === 'U' ? Y_M + .016 : Y_M - .02) + up * .012;
  const N = 16;
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * 2 - 1, at = Math.abs(t), x = Math.sign(t) * A * Math.sin(Math.min(1.25, at * 1.25)), z = zf - .27 * at * at;
    for (const [dy, dz] of [[0, .01], [up * .03, .004], [up * .03, -.02]]) pts.push([x, y0 + dy, z + dz]);
  }
  for (let k = 0; k < N; k++) for (let r = 0; r < 2; r++) { const a = k * 3 + r, b = (k + 1) * 3 + r; T.push(a, b, b + 1, a, b + 1, a + 1); }
  const W = new Float32Array(pts.length * 3), P = new Float32Array(pts.length * 3);
  pts.forEach((c, i) => { let p = c; if (J) p = J(c[0], c[1], c[2]); W.set(p, i * 3); P.set(V(p[0], p[1], p[2]), i * 3); });
  return { kind: 'gum', P, W, T: Uint32Array.from(T), cull: false };
}
/* tongue: a tube around a bending centre line; muscles set length, tip angle, width, curl */
function tongueObj(M, A, J, V) {
  const b = M.tongueBase, NU = 14, NA = 12, pts = [], T = [];
  const pro = (A.tgProtrude || 0) - .5 * (A.tgRetract || 0), tipUp = (A.tgTip || 0) - (A.tgTipDown || 0), wide = (A.tgWide || 0) - .6 * (A.tgCurl || 0), curl = A.tgCurl || 0, side = A.tgSide || 0;
  const len = b.len * (1 + .75 * Math.max(0, pro) + .25 * Math.min(0, pro)) * (1 - .15 * Math.max(0, tipUp)), back = (A.tgRetract || 0) * .02;
  let x = 0, y = b.y + back, z = b.z - (A.tgRetract || 0) * .03 + Math.max(0, pro) * .05, ang = 6 * DEG;
  const cl = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    cl.push([x, y, z, ang]);
    const bend = (u > .55 ? tipUp * 90 * DEG / (NU * .45) : 0) - (u < .3 ? (A.tgRetract || 0) * 25 * DEG / (NU * .3) : 0) + (pro > 0 ? -.6 * DEG : 0);
    ang += bend; const step = len / NU;
    z += Math.cos(ang) * step; y += Math.sin(ang) * step; x += side * .006 * u;
  }
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, [cx, cy, cz, a] = cl[i], wdt = b.w * (1 + .35 * wide) * Math.sqrt(Math.sin(Math.PI * Math.min(1, u * .55 + .45))) * (u > .85 ? Math.sqrt(1 - (u - .85) / .17) : 1) + .004, hgt = b.h * (1 - .4 * wide) * (u > .85 ? .7 : 1) + .003;
    for (let k = 0; k < NA; k++) {
      const t = k / NA * 2 * Math.PI, lx = Math.sin(t) * wdt / 2, ly0 = Math.cos(t) * hgt / 2 + curl * .02 * (Math.abs(Math.sin(t)) ** 2) * (Math.cos(t) > 0 ? 1 : .3);
      const nyy = Math.cos(a), nzz = -Math.sin(a);
      pts.push([cx + lx, cy + ly0 * nyy, cz + ly0 * nzz]);
    }
  }
  for (let i = 0; i < NU; i++) for (let k = 0; k < NA; k++) { const a = i * NA + k, b2 = i * NA + (k + 1) % NA, c = (i + 1) * NA + (k + 1) % NA, d = (i + 1) * NA + k; T.push(a, c, b2, a, d, c); }
  const W = new Float32Array(pts.length * 3), P = new Float32Array(pts.length * 3);
  pts.forEach((c, i) => { const p = J(c[0], c[1], c[2]); W.set(p, i * 3); P.set(V(p[0], p[1], p[2]), i * 3); });
  return { kind: 'tongue', P, W, T: Uint32Array.from(T), cull: false };
}

/* ---------- speech: letters to visemes ---------- */
const VISEMES = {
  a: { jawOpen: .5, part: 1 }, i: { jawOpen: .3, part: 1, risorius: .45 }, e: { jawOpen: .32, part: 1, risorius: .55, zygMajor: .15 }, o: { jawOpen: .4, part: 1, pucker: .55, funnel: .5 },
  u: { jawOpen: .15, part: .8, pucker: .95, funnel: .3 }, w: { jawOpen: .12, part: .5, pucker: .9 }, y: { jawOpen: .2, part: .8, risorius: .4, tgTip: .2 },
  m: { press: .8 }, b: { press: .75 }, p: { press: .9 }, f: { jawOpen: .08, part: .5, tuck: .9 }, v: { jawOpen: .08, part: .5, tuck: .85 },
  l: { jawOpen: .25, part: 1, tgTip: .9 }, t: { jawOpen: .14, part: .8, tgTip: .8 }, d: { jawOpen: .18, part: .8, tgTip: .8 }, n: { jawOpen: .16, part: .7, tgTip: .75 },
  s: { jawOpen: .05, part: .8, risorius: .35 }, z: { jawOpen: .05, part: .8, risorius: .3 }, c: { jawOpen: .2, part: .9 }, k: { jawOpen: .25, part: .9, tgRetract: .4 }, g: { jawOpen: .25, part: .9, tgRetract: .4 },
  h: { jawOpen: .3, part: .9 }, r: { jawOpen: .2, part: .8, pucker: .35, tgTip: .3 }, j: { jawOpen: .15, part: .8, pucker: .45 }, q: { jawOpen: .15, part: .7, pucker: .7 }, x: { jawOpen: .15, part: .8, risorius: .3 },
  th: { jawOpen: .14, part: 1, tgProtrude: .3 }, sh: { jawOpen: .12, part: .9, pucker: .5, funnel: .4 }, ch: { jawOpen: .12, part: .9, pucker: .45, funnel: .35 },
};
function textToVisemes(text) {
  const s = text.toLowerCase(), out = []; let t = .15;
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    let key = null, d = .085;
    if (VISEMES[two] && (two === 'th' || two === 'sh' || two === 'ch')) { key = two; i++; d = .11; }
    else if (VISEMES[s[i]]) { key = s[i]; if ('aeiou'.includes(s[i])) d = .12; }
    else if (/[.,!?;:]/.test(s[i])) { out.push({ t, d: .3, v: {} }); t += .3; continue; }
    else if (s[i] === ' ') { t += .04; continue; }
    if (!key) continue;
    out.push({ t, d, v: VISEMES[key] }); t += d;
  }
  out.push({ t, d: .3, v: {} });
  return { seq: out, dur: t + .3 };
}

/* ---------- clips: timelines of controls ---------- */
function expressionAU(name, k, asym) {
  const E = EXPRESSIONS[name] || {}, o = {};
  for (const key in E) {
    if (key === 'gazeY' || key === 'gazeX') continue;
    o[key] = E[key] * k;
  }
  if (asym) for (const key of Object.keys(o)) if (!/[LR]$/.test(key)) { o[key + 'L'] = o[key] * (1 + asym); o[key + 'R'] = o[key] * (1 - asym); delete o[key]; }
  return o;
}
function faceClip(id, opts) {
  const k = opts.intensity ?? 1;
  const base = Object.assign({}, opts.hold || {});
  if (id.startsWith('expr:')) {
    const name = id.slice(5), au = expressionAU(name, k, opts.asym || 0), E = EXPRESSIONS[name] || {};
    return { dur: 1.1, loop: false, at: t => ({ au: mixAU(base, au, ss((t - .12) / .3)), gazeY: (E.gazeY || 0) * ss((t - .12) / .3), blink: 0 }) };
  }
  if (id === 'blink') return { dur: .5, loop: false, at: t => ({ au: base, blink: t > .1 && t < .22 ? 1 : 0 }) };
  if (id === 'look') {
    const pts = [[0, 0], [.75, .1], [.8, -.35], [-.7, -.2], [-.75, .4], [0, .6], [0, -.5], [0, 0]];
    return { dur: 3.2, loop: true, at: t => { const i = Math.min(pts.length - 1, Math.floor(t / .4)); return { au: base, gazeX: pts[i][0], gazeY: pts[i][1], blink: (t > 1.48 && t < 1.6) ? 1 : 0 }; } };
  }
  if (id === 'talk') {
    const v = textToVisemes(opts.text || 'Hello there, traveller.');
    return { dur: v.dur, loop: false, at: t => {
      let cur = {}; for (const s of v.seq) if (t >= s.t && t < s.t + s.d) cur = s.v;
      return { au: mixAU(base, cur, 1), blink: (t % 2.7) > 2.55 ? 1 : 0, gazeX: .05 * Math.sin(t * 1.3) };
    } };
  }
  if (id === 'turn') return { dur: 2.4, loop: true, at: t => ({ au: base, headYaw: Math.sin(t / 2.4 * 2 * Math.PI) * 80 * DEG, gazeX: -Math.cos(t / 2.4 * 2 * Math.PI) * .3 }) };
  if (id === 'shake') return { dur: 1.6, loop: false, at: t => ({ au: base, headYaw: t < 1.1 ? Math.sin(t * 18) * 26 * DEG * (1 - t / 1.1) : 0, gazeX: 0 }) };
  if (id === 'nod') return { dur: 1.6, loop: false, at: t => ({ au: base, headPitch: t < 1.1 ? Math.sin(t * 14) * 18 * DEG * (1 - t / 1.1) : 0 }) };
  if (id === 'chew') return { dur: 1.2, loop: true, at: t => ({ au: mixAU(base, { jawOpen: .18 * (1 + Math.sin(t / 1.2 * 6 * Math.PI)) / 2, jawSide: .4 * Math.sin(t / 1.2 * 6 * Math.PI + 1), masseter: (1 - Math.sin(t / 1.2 * 6 * Math.PI)) / 2, press: .3 }, 1) }) };
  return { dur: 1, loop: false, at: () => ({ au: base }) };
}
function mixAU(a, b, k) { const o = Object.assign({}, a); for (const key in b) o[key] = (a[key] || 0) * (1 - k) + b[key] * k; return o; }
/* simulate a clip; returns per-frame snapshots (positions, activations, gaze, head) at fps */
function simFaceClip(M, clip, fps, warm) {
  const S = newFaceState(M), dt = 1 / 240;
  const c0 = clip.at(0);
  for (let i = 0; i < (warm ?? 60); i++) faceStep(M, S, c0, dt); // settle
  const frames = [], n = Math.max(1, Math.round(clip.dur * fps));
  let t = 0;
  if (clip.loop) for (let tt = 0; tt < clip.dur; tt += dt) faceStep(M, S, clip.at(tt % clip.dur), dt);
  for (let i = 0; i < n; i++) {
    const tEnd = i / fps;
    while (t < tEnd - 1e-9) { faceStep(M, S, clip.at(t), dt); t += dt; }
    const c = clip.at(t);
    frames.push({ X: Float32Array.from(S.X), act: Object.assign({}, S.act), gaze: Object.assign({}, S.gaze), head: { yaw: S.head.yaw, pitch: S.head.pitch, roll: S.head.roll, w: [0, 0, 0] }, ctrl: c });
  }
  return frames;
}
/* ---------- the face during body moves ---------- */
const FIGHT = new Set(['punch', 'kick', 'overhead', 'palm', 'sidekick', 'flyknee', 'sweep', 'flurry']);
function bodyFaceCtrl(id, fr, t, mode, pose) {
  const ph = fr.phase || '', au = {};
  const set = o => Object.assign(au, o);
  if (mode && mode !== 'auto' && mode !== 'pose') set(expressionAU(mode, 1, 0));
  else if (mode === 'pose') set(pose || {});
  else if (FIGHT.has(id)) {
    if (/strike|impact|launch|spin|punch/.test(ph)) set({ corrugator: 1, procerus: .6, lidTight: .6, llsan: .5, lls: .8, part: 1, jawOpen: .5, risorius: .35 });
    else if (/recover|retract|plant|shift back|rise|settle|land|descend/.test(ph)) set({ corrugator: .55, lidTight: .35, press: .35, part: .25 });
    else set({ corrugator: .6, lidTight: .4, press: .45, masseter: .5 });
  } else if (id === 'run') set({ part: .7, jawOpen: .12, frontalisM: .15, lidTight: .15 });
  else if (id === 'jump' || id === 'runjump') {
    if (/push|take-off|down/.test(ph)) set({ tighten: .7, press: .55, corrugator: .5, lidTight: .4, masseter: .7 });
    else if (/flight|reach/.test(ph)) set({ part: .8, jawOpen: .22, frontalisM: .5, frontalisL: .3, lidRaise: .35 });
    else if (/land|absorb/.test(ph)) set({ lidTight: .6, corrugator: .5, part: .4, jawOpen: .1 });
  } else if (id === 'dance') set({ orbOculi: .75, zygMajor: 1, part: 1, jawOpen: .32, levAnguli: .25 });
  else if (id === 'roll') { if (/dive|roll/.test(ph)) set({ blink: .95, corrugator: .7, press: .6, tighten: .4 }); }
  else if (id === 'fire') { if (/aim|fire|recoil|hold|raise/.test(ph)) set({ lidTightR: .95, blinkR: .5, orbOculiR: .4, press: .4, corrugator: .4 }); }
  const blink = (t % 3.3) > 3.15 && !/strike|impact|fire/.test(ph) ? 1 : 0;
  return { au, blink };
}
function simFaceForAnim(R, M, anim, id, mode, pose) {
  const S = newFaceState(M), dt = 1 / 240, n = anim.frames.length, out = [], fps = 30;
  const heads = anim.frames.map(f => { const F = fk(R, f), g = F.S[SI.head]; return { a: g.a, x: g.ox, y: g.oy }; });
  const hk = M.p.headL * .13 * R.H; // metres per face unit
  const ctrlAt = (i, t) => {
    const f = anim.frames[i], h = heads[i], hp = heads[Math.max(0, i - 1)], hn = heads[Math.min(n - 1, i + 1)];
    const c = bodyFaceCtrl(id, f, t, mode, pose);
    c.headPitch = Math.PI / 2 - h.a;
    // linear acceleration of the head, into face units / s² along the head's up and forward axes
    const ax = (hn.x - 2 * h.x + hp.x) * 14400, ay = (hn.y - 2 * h.y + hp.y) * 14400;
    const dx = Math.cos(h.a), dy = Math.sin(h.a), up = (ax * dx + ay * dy) / hk, fw = (ax * dy - ay * dx) / hk;
    c.headAcc = [clamp(fw, -300, 300), clamp(up, -300, 300)];
    c.gazeY = clamp(c.headPitch / (24 * DEG), -.8, .8);
    if (f.yaw) c.gazeX = clamp(Math.sin(f.yaw) * .6, -.6, .6);
    return c;
  };
  const c0 = ctrlAt(0, 0);
  for (let k = 0; k < 40; k++) faceStep(M, S, c0, dt);
  const passes = anim.loop ? 2 : 1;
  for (let pass = 0; pass < passes; pass++) for (let i = 0; i < n; i++) {
    const t = i / 120, c = ctrlAt(i, t);
    faceStep(M, S, c, dt); faceStep(M, S, c, dt);
    if (pass === passes - 1 && i % 4 === 0) out.push({ X: Float32Array.from(S.X), act: Object.assign({}, S.act), gaze: Object.assign({}, S.gaze), head: { yaw: 0, pitch: 0, roll: 0, w: [0, 0, 0] }, ctrl: c });
  }
  return { fps, frames: out };
}
function faceAt(anim, fa, t) { const n = fa.frames.length; let i = Math.round(t * fa.fps); i = anim.loop ? ((i % n) + n) % n : clamp(i, 0, n - 1); return fa.frames[i]; }
function frameState(M, fr) { return { X: fr.X, V: null, act: fr.act, gaze: fr.gaze, head: fr.head }; }
if (typeof DEFAULTS !== 'undefined') Object.assign(DEFAULTS, FACE_DEFAULTS);
export { DEFAULTS, WEAR_DEFAULTS, OUTFITS, HAIR_STYLES, HAIR_COLORS, FACE_DEFAULTS, NOSE_STYLES, MOVES, MOVE_NAME, buildRig, simMove, frameAt, renderSprite, simWear, wearAt, buildFace, simFaceForAnim, faceAt };
