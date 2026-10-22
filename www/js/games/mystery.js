// Top-down manor mystery: talk to the suspects and the house animals, search the
// furniture, work out who did it and accuse them. Tap a spot to walk there, tap a
// person or a piece of furniture to go and interact.
import { Game, W, H, drawFit, ready } from './engine.js';
import { creatureName } from './creature.js';
import { Actor, S as CS, dirOf } from '../crystal/sprites.js';

const T = 24, RG = 3, RS = 9, N = RG * RS + 1;
const ROOMS = ['Library', 'Conservatory', 'Kitchen', 'Ballroom', 'Study', 'Cellar', 'Billiard Room', 'Greenhouse', 'Observatory', 'Chapel', 'Trophy Room', 'Pantry', 'Music Room', 'Taxidermy Parlour', 'Map Room'];
const CRIMES = [
  ['the Duchess’s prize marrow', 'was stolen'], ['Colonel Mustard’s toupee', 'has vanished'], ['the household oracle-goat', 'was kidnapped'], ['the last jar of 1887 marmalade', 'was eaten'],
  ['the family ghost', 'was exorcised without permission'], ['the Baron’s pet lobster', 'was set free'], ['the cursed grandfather clock', 'was wound backwards'], ['the will', 'was rewritten in crayon'],
  ['the séance table', 'was sawn in half'], ['the dowager’s false teeth', 'were swapped for a badger’s']
];
const TRAITS = [
  ['reeks of turpentine', 'a rag that reeks of turpentine'], ['has ink-stained fingers', 'a smudged inky thumbprint'], ['wears a cracked monocle', 'a sliver of monocle glass'],
  ['tracks in pond mud', 'muddy footprints that smell of pond'], ['hums sea shanties', 'a scrawled shanty lyric'], ['is covered in cat hair', 'a tuft of ginger cat hair'],
  ['chews liquorice', 'a half-chewed liquorice whip'], ['wears one red glove', 'a single red glove'], ['smells of brimstone', 'a scorched sulphur match'], ['jingles with keys', 'a key that fits nothing']
];
const ALIBIS = ['was napping in the', 'was reading poetry aloud in the', 'was hiding from the vicar in the', 'was teaching the parrot Latin in the', 'was polishing spoons in the', 'was weeping softly in the'];
const DUST = ['Just dust and a dead moth.', 'A love letter to a turnip. Not relevant.', 'Three buttons and a sense of dread.', 'A taxidermied vole stares back.', 'Nothing. Suspiciously nothing.', 'A tin of humbugs, long expired.', 'A map of the house with a room you’ve never seen.'];
// suspects' temperaments: the emote they react with, and the one they fidget with
const MOODS = { nervous: ['surprise', 'think'], haughty: ['laugh', 'shake'], gloomy: ['sad', 'sad'], cheery: ['laugh', 'wave'], smitten: ['love', 'love'], prickly: ['angry', 'angry'] };
const D4 = ['S', 'W', 'N', 'E'];
const TITLES = ['Lady', 'Sir', 'Reverend', 'Doctor', 'Madame', 'Professor', 'Captain', 'Count', 'Nurse', 'Archduke'];

export class Mystery extends Game {
  static noMods = ['mirror', 'lowg', 'heavy', 'wobble', 'swarm'];
  setup() { this.cases = 0; this.newCase(); }
  newCase() {
    this.cases++;
    const R = () => this.rng();
    const pickN = (a, n) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b.slice(0, n); };
    // rooms on a 3×3 grid, joined by a spanning tree of doors plus a couple of extras
    this.map = new Uint8Array(N * N).fill(1);
    this.roomOf = new Int8Array(N * N).fill(-1);
    this.rooms = pickN(ROOMS, RG * RG).map((name, k) => ({ name, k, x: (k % RG) * RS + 1, y: Math.floor(k / RG) * RS + 1, w: RS - 1, h: RS - 1, tex: this.skin.texFor?.(k + this.cases * 3) || this.skin.slots.tile[k % this.skin.slots.tile.length] }));
    for (const r of this.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { this.map[y * N + x] = 0; this.roomOf[y * N + x] = r.k; }
    const linked = new Set([0]), edges = [];
    while (linked.size < RG * RG) {
      const a = [...linked][Math.floor(R() * linked.size)], ax = a % RG, ay = Math.floor(a / RG);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [ax + dx, ay + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < RG && y < RG).map(([x, y]) => y * RG + x).filter((b) => !linked.has(b));
      if (!nb.length) continue;
      const b = nb[Math.floor(R() * nb.length)]; linked.add(b); edges.push([a, b]);
    }
    for (let k = 0; k < 2; k++) { const a = Math.floor(R() * 8); edges.push([a, a % RG < RG - 1 ? a + 1 : a + RG > 8 ? a - RG : a + RG]); }
    for (const [a, b] of edges) {
      const A = this.rooms[a], B = this.rooms[b];
      if (Math.abs(a - b) === 1) { const x = Math.max(A.x, B.x) - 1, y = A.y + 2 + Math.floor(R() * (RS - 5)); this.map[y * N + x] = 0; }
      else { const y = Math.max(A.y, B.y) - 1, x = A.x + 2 + Math.floor(R() * (RS - 5)); this.map[y * N + x] = 0; }
    }
    // furniture: theme PNGs along the walls
    this.props = [];
    const free = (x, y) => !this.map[y * N + x] && !this.props.some((p) => p.x === x && p.y === y) && ![[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => this.map[(y + dy) * N + x + dx] === 0 && this.roomOf[(y + dy) * N + x + dx] < 0);
    const items = this.skin.list('furniture', 12, 'item', 'prop', 'deco', 'block');
    for (const r of this.rooms) for (let k = 0; k < 2; k++) {
      for (let tries = 0; tries < 20; tries++) {
        const x = r.x + 1 + Math.floor(R() * (r.w - 2)), y = r.y + (R() < 0.5 ? 0 : r.h - 1);
        if (free(x, y)) { this.props.push({ x, y, i: items[(r.k * 2 + k) % items.length], room: r.k, searched: false }); break; }
      }
    }
    // the case
    const [thing, verb] = CRIMES[Math.floor(R() * CRIMES.length)];
    this.crime = `${thing[0].toUpperCase()}${thing.slice(1)} ${verb}!`;
    const traits = pickN(TRAITS, 4), alibiRooms = pickN(this.rooms, 4);
    const S = (this.post.seed || 1) + this.cases * 101;
    // mostly a modern country-house job; some seeds play it in a castle or on a starship
    if (!this.era) { const e = (this.post.seed || 1) % 5; this.era = e === 3 ? 'Fantasy' : e === 4 ? 'Sci-fi' : 'Present day'; }
    const actor = this.me?.actor || new Actor(this.skin.crystal(0, this.era, D4), { mode: 'four', walkSpeed: 20, runSpeed: 130, walkStride: 7, runStride: 12 });
    this.me = { x: this.rooms[4].x + 3, y: this.rooms[4].y + 4, fx: 0, fy: 0, path: [], actor, emq: [], kneelT: 0 };
    this.me.fx = this.me.x; this.me.fy = this.me.y;
    this.suspects = traits.map((tr, k) => {
      const room = this.rooms[(k * 2 + 1 + this.cases) % 9];
      return { kind: 'suspect', k, name: `${TITLES[Math.floor(R() * TITLES.length)]} ${creatureName(S + k * 7)}`, trait: tr, alibi: `${ALIBIS[Math.floor(R() * ALIBIS.length)]} ${alibiRooms[k].name}`,
        actor: new Actor(this.skin.crystal(1 + k + this.cases * 4, this.era, D4), { mode: 'four', walkSpeed: 20, runSpeed: 999, walkStride: 5, dir: D4[Math.floor(R() * 4)] }),
        mood: Object.keys(MOODS)[Math.floor(R() * 6)], emq: [], greeted: false, room: room.k, ...this.spot(room) };
    });
    this.culprit = Math.floor(R() * 4);
    const innocents = [0, 1, 2, 3].filter((k) => k !== this.culprit);
    this.evidence = this.props[Math.floor(R() * this.props.length)];
    this.witnesses = [0, 1].map((k) => {
      const room = this.rooms[(k * 4 + 2 + this.cases) % 9], cr = this.skin.creatures[k + 2];
      const clear = innocents[(k + this.cases) % 3];
      return { kind: 'witness', name: `${creatureName(S + 50 + k)} the ${['goat', 'parrot', 'tortoise', 'hound', 'owl', 'eel'][Math.floor(R() * 6)]}`, clears: clear,
        line: k ? `${this.suspects[clear].name}? Was with me all evening, arguing about soup. ${this.rooms[this.evidence.room].name}… I heard rummaging there.` : `${this.suspects[clear].name} couldn’t have. I watched them the whole time. Not that anyone asks the animals.`,
        art: cr, room: room.k, ...this.spot(room) };
    });
    this.npcs = [...this.suspects, ...this.witnesses];
    this.known = { traits: new Set(), cleared: new Set(), evidence: false, talked: new Set() };
    this.say = { who: 'The Butler', s: `${this.crime} Find out who did it.`, t: 3.5 };
    this.solved = false; this.target = null; this.caseT = 0;
  }
  spot(room) { for (let i = 0; i < 40; i++) { const x = room.x + 1 + Math.floor(this.rng() * (room.w - 2)), y = room.y + 1 + Math.floor(this.rng() * (room.h - 2)); if (!this.blocked(x, y)) return { x, y, fx: x, fy: y, wt: this.r(1, 3) }; } return { x: room.x + 2, y: room.y + 2, fx: room.x + 2, fy: room.y + 2, wt: 2 }; }
  blocked(x, y, ignore) {
    if (x < 0 || y < 0 || x >= N || y >= N || this.map[y * N + x]) return true;
    if (this.props?.some((p) => p.x === x && p.y === y)) return true;
    return (this.npcs || []).some((n) => n !== ignore && n.x === x && n.y === y);
  }
  path(tx, ty) {
    const s = this.me.y * N + this.me.x, prev = new Int32Array(N * N).fill(-1), q = [s]; prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (i === ty * N + tx) break;
      const x = i % N, y = Math.floor(i / N);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, j = Y * N + X; if (prev[j] < 0 && (!this.blocked(X, Y) || (X === tx && Y === ty))) { prev[j] = i; q.push(j); } }
    }
    if (prev[ty * N + tx] < 0) return null;
    const out = []; for (let i = ty * N + tx; i !== s; i = prev[i]) out.unshift([i % N, Math.floor(i / N)]);
    return out;
  }
  // walk next to a target (an NPC or a prop), then interact
  goTo(t) {
    const tx = t.x, ty = t.y;
    let p = this.path(tx, ty);
    if (!p) return false;
    p.pop(); // stop beside it
    this.me.path = p; this.target = t;
    return true;
  }
  interact(t) {
    this.target = null;
    const k = this.known, m = this.me;
    // turn to face each other
    m.actor.face(dirOf(t.x - m.x, t.y - m.y, 'four'));
    t.actor?.face(dirOf(m.x - t.x, m.y - t.y, 'four'));
    if (t.kind === 'suspect') {
      const first = !k.talked.has(t.k), caught = k.evidence && t.k === this.culprit;
      const mood = /weeping/.test(t.alibi) ? 'sad' : MOODS[t.mood][0];
      this.react(t, caught ? [['surprise', 0.9], ['shake', 0.9], ['angry', 1.2]] // "What of it?!"
        : first ? [['wave', 0.8], [mood, 1.2], ['nod', 0.9]] // hello, the alibi, yes I do
        : [['think', 0.9], ['nod', 0.8], [MOODS[t.mood][1], 1]]);
      this.react(m, [['think', 1.6], ['nod', 0.8]]);
      k.talked.add(t.k); k.traits.add(t.k);
      const ready = this.deduce() === t.k;
      this.say = { who: t.name, s: `I ${t.alibi}. And yes, ${t.name} ${t.trait[0]}, everyone knows. What of it?`, t: 3.2, accuse: t, hint: ready };
      if (this.auto && ready) { this.say.t = 1.6; this.pendingAccuse = t; }
    } else if (t.kind === 'witness') {
      k.cleared.add(t.clears); k.talked.add(t.name);
      this.say = { who: t.name, s: t.line, t: 3.5 };
      this.react(m, [['think', 1.4], ['nod', 1]]);
    } else {
      t.searched = true;
      this.react(m, []); m.kneelT = 0.9; // kneel to rummage, then react
      m.emq = t === this.evidence ? [['surprise', 1.2], ['cheer', 0.8]] : [[this.rng() < 0.5 ? 'shake' : 'think', 0.9]];
      if (t === this.evidence) { k.evidence = true; this.say = { who: 'You', s: `Hidden in here: ${this.suspects[this.culprit].trait[1]}!`, t: 3, found: true }; this.burst(W / 2, H / 2, this.col(1), 20, 140); }
      else this.say = { who: 'You', s: DUST[Math.floor(this.rng() * DUST.length)], t: 1.6 };
    }
  }
  // who it must be, if the clues so far are enough (otherwise -1)
  deduce() {
    const k = this.known, c = this.culprit;
    if (k.evidence && k.traits.has(c)) return c;
    const left = [0, 1, 2, 3].filter((i) => !k.cleared.has(i) && !(k.evidence && k.traits.has(i) && i !== c));
    return left.length === 1 ? left[0] : -1;
  }
  accuse(s) {
    this.say = null; this.pendingAccuse = null;
    if (s.k === this.culprit) {
      const pts = Math.max(200, 1500 - Math.floor(this.caseT) * 10);
      this.score += pts; this.solved = true; this.burst(W / 2, H / 2, this.col(0), 40, 240);
      this.say = { who: 'The Butler', s: `Case closed! ${s.name} ${s.trait[0]} and confesses everything. +${pts}`, t: 3, next: true };
      this.react(s, [['surprise', 0.8], ['angry', 1.2], ['sad', 1.2]]); // caught, furious, then confesses
      this.react(this.me, [['cheer', 2.4]]);
      for (const o of this.suspects) if (o !== s) this.react(o, [[o.mood === 'smitten' ? 'love' : 'cheer', 1.6]]);
    } else {
      this.score = Math.max(0, this.score - 200); this.say = { who: s.name, s: 'Me?! Preposterous. I’m telling Mother.', t: 2.2 };
      this.react(s, [['surprise', 0.6], ['angry', 1.6]]);
      this.react(this.me, [['sad', 1.8]]);
    }
    const m = this.me; m.actor.face(dirOf(s.x - m.x, s.y - m.y, 'four')); s.actor.face(dirOf(m.x - s.x, m.y - s.y, 'four'));
  }
  // replace what someone is emoting with a new sequence of [emote, seconds]
  react(o, seq) {
    if (!o.actor) return;
    o.emq = seq.slice();
    if (CS.animations[o.actor.a.action]?.emote) o.actor.a.revive(); // cut the current emote short
  }
  // feed a character its movement, playing queued emotes while it stands still
  act(o, vx, vy, dt) {
    const a = o.actor, moving = Math.abs(vx) + Math.abs(vy) > 0;
    if (moving) { if (o.emq.length || CS.animations[a.a.action]?.emote) this.react(o, []); }
    else if (o.emq.length && !a.a.action && !(o.kneelT > 0)) { const [n, s] = o.emq.shift(); a.emote(n, s); }
    a.update(dt, { vx, vy, lowHealth: o.kneelT > 0 });
  }
  autopilot(dt) {
    if (this.say || this.me.path.length || this.target) return;
    const d = this.deduce();
    if (d >= 0) { this.goTo(this.suspects[d]); return; }
    const hintRoom = this.known.talked.has(this.witnesses[1].name) ? this.evidence.room : -1;
    const todo = [...this.npcs.filter((n) => !this.known.talked.has(n.kind === 'suspect' ? n.k : n.name)), ...this.props.filter((p) => !p.searched && (hintRoom < 0 || p.room === hintRoom))];
    todo.sort((a, b) => Math.abs(a.x - this.me.x) + Math.abs(a.y - this.me.y) - Math.abs(b.x - this.me.x) - Math.abs(b.y - this.me.y));
    for (const t of todo) if (this.goTo(t)) return;
  }
  screenToTile(x, y) { return [Math.floor((x + this.camX) / T), Math.floor((y + this.camY) / T)]; }
  down(x, y) {
    if (this.say) {
      if (this.say.accuse && y > H - 64 && y < H - 30 && x > W - 120) { this.accuse(this.say.accuse); return; }
      if (this.say.t < 2.6 || !this.say.accuse) { const n = this.say.next; this.say = null; if (n) this.newCase(); }
      return;
    }
    const [tx, ty] = this.screenToTile(x, y);
    const t = this.npcs.find((n) => n.x === tx && n.y === ty) || this.props.find((p) => p.x === tx && p.y === ty);
    if (t) { if (Math.abs(t.x - this.me.x) + Math.abs(t.y - this.me.y) === 1) this.interact(t); else this.goTo(t); return; }
    const p = this.path(tx, ty); if (p) { this.me.path = p; this.target = null; }
  }
  step(dt) {
    this.caseT += dt;
    const m = this.me;
    if (this.say) {
      this.say.t -= dt;
      if (this.say.t <= 0) {
        if (this.pendingAccuse) { this.accuse(this.pendingAccuse); return; }
        const n = this.say.next; if (this.auto || !this.say.accuse || n) { this.say = null; if (n) this.newCase(); }
      }
    }
    // smooth tile-to-tile walking: run on long trips, slow to a walk for the last few tiles
    let at = Math.abs(m.x - m.fx) + Math.abs(m.y - m.fy) <= 0.01;
    if (at && m.path.length) {
      const [nx, ny] = m.path[0];
      if (this.blocked(nx, ny)) { m.path = []; if (this.target) this.goTo(this.target); }
      else { m.path.shift(); m.x = nx; m.y = ny; at = false; }
    }
    const tps = m.path.length > 2 ? 6.5 : 4, sp = tps * dt;
    const dx = m.x - m.fx, dy = m.y - m.fy;
    let mvx = 0, mvy = 0;
    if (!at) { m.fx += Math.sign(dx) * Math.min(Math.abs(dx), sp); m.fy += Math.sign(dy) * Math.min(Math.abs(dy), sp); mvx = Math.sign(dx) * tps * T; mvy = Math.sign(dy) * tps * T; }
    else if (this.target && !this.say) {
      if (Math.abs(this.target.x - m.x) + Math.abs(this.target.y - m.y) === 1) this.interact(this.target); else this.goTo(this.target) || (this.target = null);
    }
    if (m.kneelT > 0) m.kneelT -= dt;
    this.act(m, mvx, mvy, dt);
    // NPCs potter about their room
    for (const n of this.npcs) {
      const ex = n.x - n.fx, ey = n.y - n.fy;
      let vx = 0, vy = 0;
      if (Math.abs(ex) + Math.abs(ey) > 0.01) { n.fx += Math.sign(ex) * Math.min(Math.abs(ex), 2 * dt); n.fy += Math.sign(ey) * Math.min(Math.abs(ey), 2 * dt); vx = Math.sign(ex) * 2 * T; vy = Math.sign(ey) * 2 * T; }
      else if (this.target !== n && !(this.say && this.say.accuse === n) && !(n.actor && (n.emq.length || n.actor.a.action))) {
        // a suspect who spots the detective in their room turns and waves hello
        if (n.actor && !n.greeted && this.roomOf[m.y * N + m.x] === n.room && Math.abs(m.x - n.x) + Math.abs(m.y - n.y) <= 4) {
          n.greeted = true; n.actor.face(dirOf(m.x - n.x, m.y - n.y, 'four')); this.react(n, [['wave', 1.2]]);
        } else if ((n.wt -= dt) <= 0) {
          n.wt = this.r(1.5, 4);
          const roll = this.rng();
          if (n.actor && roll < 0.25) this.react(n, [[MOODS[n.mood][1], this.r(1, 2)]]); // fidget
          else if (n.actor && roll < 0.4) n.actor.face(D4[Math.floor(this.rng() * 4)]); // look around
          else {
            const [ddx, ddy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(this.rng() * 4)], X = n.x + ddx, Y = n.y + ddy;
            if (!this.blocked(X, Y, n) && !(X === m.x && Y === m.y) && this.roomOf[Y * N + X] === n.room) { if (ddx) n.face = ddx; n.x = X; n.y = Y; }
          }
        }
      }
      if (n.actor) this.act(n, vx, vy, dt);
    }
    const r = this.roomOf[m.y * N + m.x];
    if (r >= 0 && r !== this.lastRoom) { this.lastRoom = r; this.roomLabel = { s: this.rooms[r].name, t: 1.5 }; }
    if (this.roomLabel && (this.roomLabel.t -= dt) <= 0) this.roomLabel = null;
  }
  draw(c) {
    const m = this.me;
    this.camX = Math.max(0, Math.min(N * T - W, m.fx * T + T / 2 - W / 2)); this.camY = Math.max(-40, Math.min(N * T - H + 60, m.fy * T + T / 2 - H / 2));
    c.fillStyle = this.pal.bg; c.fillRect(0, 0, W, H);
    c.save(); c.translate(-Math.round(this.camX), -Math.round(this.camY));
    const x0 = Math.max(0, Math.floor(this.camX / T)), y0 = Math.max(0, Math.floor(this.camY / T)), x1 = Math.min(N, x0 + W / T + 2), y1 = Math.min(N, y0 + H / T + 2);
    // floors per room, textured with photos
    for (const r of this.rooms) {
      c.fillStyle = this.col(r.k); c.globalAlpha = 0.25; c.fillRect(r.x * T, r.y * T, r.w * T, r.h * T); c.globalAlpha = 1;
      if (ready(r.tex)) { c.save(); c.globalAlpha = 0.5; c.beginPath(); c.rect(r.x * T, r.y * T, r.w * T, r.h * T); c.clip(); const pat = c.createPattern(r.tex, 'repeat'); c.fillStyle = pat; c.fillRect(r.x * T, r.y * T, r.w * T, r.h * T); c.restore(); }
    }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!this.map[y * N + x]) { if (this.roomOf[y * N + x] < 0) { c.fillStyle = this.pal.bg2; c.fillRect(x * T, y * T, T, T); } continue; }
      c.fillStyle = this.pal.bg2; c.fillRect(x * T, y * T - 8, T, T);
      if (y + 1 < N && !this.map[(y + 1) * N + x]) { c.fillStyle = this.col(5); c.globalAlpha = 0.45; c.fillRect(x * T, y * T + T - 8, T, 8); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x * T, y * T + T, T, 4); }
    }
    // sort sprites by row so things overlap sensibly
    const spr = [
      ...this.props.map((p) => ({ y: p.y, f: () => { if (!drawFit(c, p.i, p.x * T + T / 2, p.y * T + T / 2 - 4, T * 1.1, T * 1.1)) { c.fillStyle = this.col(3); c.fillRect(p.x * T + 3, p.y * T + 3, T - 6, T - 6); } if (p.searched) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(p.x * T + 2, p.y * T + T - 5, T - 4, 3); } } })),
      ...this.npcs.map((n) => ({ y: n.fy, f: () => {
        if (n.actor) this.person(c, n.actor, n.fx, n.fy);
        else drawFit(c, n.art.frames[Math.floor(this.t * 2) % 2], n.fx * T + T / 2, n.fy * T + T / 2 - 8, T * 1.1, T * 1.45, 0, n.face < 0);
        if (!this.known.talked.has(n.kind === 'suspect' ? n.k : n.name)) this.text(c, '?', n.fx * T + T / 2, n.fy * T - 18 + Math.sin(this.t * 4) * 2, 11, this.col(1));
      } })),
      { y: m.fy, f: () => this.person(c, m.actor, m.fx, m.fy) }
    ].sort((a, b) => a.y - b.y);
    for (const s of spr) s.f();
    if (m.path.length) { const [px, py] = m.path[m.path.length - 1]; c.strokeStyle = this.pal.ink; c.globalAlpha = 0.4; c.strokeRect(px * T + 3, py * T + 3, T - 6, T - 6); c.globalAlpha = 1; }
    c.restore();
    // lamplight around the detective
    const lx = m.fx * T + T / 2 - this.camX, ly = m.fy * T + T / 2 - this.camY, g = c.createRadialGradient(lx, ly, 40, lx, ly, 260);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,3,2,.72)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // notebook
    const k = this.known;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, H - 18, W, 18);
    this.text(c, this.suspects.map((s) => `${k.cleared.has(s.k) ? '✗' : k.talked.has(s.k) ? '•' : '?'} ${s.name.split(' ')[1]}`).join('  '), W / 2, H - 9, 9, this.pal.ink);
    if (k.evidence) this.text(c, `◆ ${this.suspects[this.culprit].trait[1]}`, W / 2, H - 27, 9, this.col(1));
    if (this.roomLabel) { c.globalAlpha = Math.min(1, this.roomLabel.t * 2); this.text(c, this.roomLabel.s.toUpperCase(), W / 2, 92, 13, this.pal.ink); c.globalAlpha = 1; }
    if (this.say) {
      c.fillStyle = 'rgba(10,7,5,.88)'; c.fillRect(8, H - 122, W - 16, 96); c.strokeStyle = this.col(0); c.lineWidth = 1.5; c.strokeRect(8, H - 122, W - 16, 96);
      this.text(c, this.say.who, 18, H - 110, 11, this.col(0), 'left');
      this.wrap(c, this.say.s, 18, H - 92, W - 40, 14);
      if (this.say.accuse) { c.fillStyle = this.say.hint ? this.col(0) : this.pal.bg2; c.fillRect(W - 116, H - 60, 100, 26); this.text(c, 'ACCUSE', W - 66, H - 47, 11, this.pal.ink); }
    }
  }
  // a Crystal character standing on tile (fx, fy), feet near the bottom of the tile
  person(c, a, fx, fy) {
    const x = fx * T + T / 2, y = fy * T + T - 3;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 8, 3, 0, 0, 7); c.fill();
    a.draw(c, x, y, 1);
  }
  wrap(c, s, x, y, w, lh) {
    c.font = '600 11px ui-monospace, monospace'; c.fillStyle = this.pal.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    let line = '', yy = y;
    for (const word of s.split(' ')) { const t = line ? `${line} ${word}` : word; if (c.measureText(t).width > w) { c.fillText(line, x, yy); yy += lh; line = word; } else line = t; }
    c.fillText(line, x, yy);
  }
  hud() { return `${this.score} · case ${this.cases}`; }
}
